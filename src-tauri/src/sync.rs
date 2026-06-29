use std::{net::UdpSocket, sync::Arc, time::Duration};

use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use tauri::Emitter;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::{oneshot, Mutex, RwLock};

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PeerInfo {
    pub peer_id: String,
    pub base_url: String,
}

// ─────────────────────────────────────────────────────────────────────────────
// Managed state (lives for the app lifetime)
// ─────────────────────────────────────────────────────────────────────────────

struct SyncSession {
    docs_json:   Arc<RwLock<String>>,
    peers:       Arc<RwLock<Vec<PeerInfo>>>,
    port:        u16,
    peer_id:     String,
    shutdown_tx: oneshot::Sender<()>,
}

pub struct SyncState {
    session: Mutex<Option<SyncSession>>,
    mdns:    Mutex<Option<ServiceDaemon>>,
    client:  Client,
}

impl SyncState {
    pub fn new() -> Self {
        Self {
            session: Mutex::new(None),
            mdns:    Mutex::new(None),
            client:  Client::builder()
                .timeout(Duration::from_secs(5))
                .build()
                .expect("failed to build HTTP client"),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Axum server
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AxumState {
    docs_json:  Arc<RwLock<String>>,
    app_handle: tauri::AppHandle,
}

async fn handle_hello() -> StatusCode {
    StatusCode::OK
}

async fn handle_get_docs(State(s): State<AxumState>) -> impl IntoResponse {
    let json = s.docs_json.read().await.clone();
    (
        StatusCode::OK,
        [("content-type", "application/json")],
        json,
    )
}

async fn handle_push_docs(
    State(s): State<AxumState>,
    Json(docs): Json<serde_json::Value>,
) -> StatusCode {
    s.app_handle.emit("sync-incoming-docs", docs).ok();
    StatusCode::OK
}

async fn start_http_server(
    docs_json: Arc<RwLock<String>>,
    app_handle: tauri::AppHandle,
) -> Result<(u16, oneshot::Sender<()>), String> {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let axum_state = AxumState { docs_json, app_handle };
    let router = Router::new()
        .route("/api/sync/hello", get(handle_hello))
        .route("/api/sync/docs",  get(handle_get_docs))
        .route("/api/sync/push",  post(handle_push_docs))
        .with_state(axum_state);

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
    tokio::spawn(async move {
        let serve = axum::serve(listener, router);
        tokio::select! {
            _ = serve => {},
            _ = shutdown_rx => {},
        }
    });

    Ok((port, shutdown_tx))
}

// ─────────────────────────────────────────────────────────────────────────────
// mDNS peer-list helpers (extracted for testability)
// ─────────────────────────────────────────────────────────────────────────────

fn peer_id_from_fullname(fullname: &str) -> &str {
    fullname.split("._wickerly._tcp.local.").next().unwrap_or("")
}

async fn upsert_peer(peers: &Arc<RwLock<Vec<PeerInfo>>>, peer_id: String, base_url: String) {
    let mut list = peers.write().await;
    if let Some(existing) = list.iter_mut().find(|p| p.peer_id == peer_id) {
        existing.base_url = base_url;
    } else {
        list.push(PeerInfo { peer_id, base_url });
    }
}

async fn remove_peer(peers: &Arc<RwLock<Vec<PeerInfo>>>, peer_id: &str) {
    peers.write().await.retain(|p| p.peer_id != peer_id);
}

// ─────────────────────────────────────────────────────────────────────────────
// mDNS
// ─────────────────────────────────────────────────────────────────────────────

fn get_local_ip() -> Option<std::net::Ipv4Addr> {
    let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    match socket.local_addr().ok()? {
        std::net::SocketAddr::V4(addr) => Some(*addr.ip()),
        _ => None,
    }
}

fn start_mdns(
    peer_id: &str,
    port: u16,
    peers: Arc<RwLock<Vec<PeerInfo>>>,
) -> Result<ServiceDaemon, String> {
    let mdns = ServiceDaemon::new().map_err(|e| e.to_string())?;

    let local_ip = get_local_ip()
        .ok_or_else(|| "cannot determine local IP".to_string())?
        .to_string();

    // mDNS instance names must not contain dots; UUIDs (hyphens only) are safe
    let safe_id: String = peer_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .take(63)
        .collect();

    let host = format!("wk{}.local.", &safe_id.replace('-', "")[..8]);

    let service = ServiceInfo::new(
        "_wickerly._tcp.local.",
        &safe_id,
        &host,
        local_ip.as_str(),
        port,
        None,
    )
    .map_err(|e| e.to_string())?;

    mdns.register(service).map_err(|e| e.to_string())?;

    let browser = mdns
        .browse("_wickerly._tcp.local.")
        .map_err(|e| e.to_string())?;

    let my_safe_id = safe_id.clone();
    tokio::spawn(async move {
        while let Ok(event) = browser.recv_async().await {
            match event {
                ServiceEvent::ServiceResolved(info) => {
                    let remote_id = peer_id_from_fullname(info.get_fullname()).to_string();
                    if remote_id.is_empty() || remote_id == my_safe_id { continue; }
                    if let Some(addr) = info.get_addresses().iter().next() {
                        let base_url = format!("http://{}:{}", addr, info.get_port());
                        upsert_peer(&peers, remote_id, base_url).await;
                    }
                }
                ServiceEvent::ServiceRemoved(_, fullname) => {
                    let remote_id = peer_id_from_fullname(&fullname).to_string();
                    if !remote_id.is_empty() && remote_id != my_safe_id {
                        remove_peer(&peers, &remote_id).await;
                    }
                }
                _ => {}
            }
        }
    });

    Ok(mdns)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tauri commands
// ─────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn sync_start(
    app:     tauri::AppHandle,
    state:   tauri::State<'_, SyncState>,
    peer_id: String,
    docs:    String,
) -> Result<u16, String> {
    let docs_arc = Arc::new(RwLock::new(docs));
    let peers_arc: Arc<RwLock<Vec<PeerInfo>>> = Arc::new(RwLock::new(vec![]));

    let (port, shutdown_tx) =
        start_http_server(docs_arc.clone(), app).await?;

    let mdns = start_mdns(&peer_id, port, peers_arc.clone())?;

    *state.session.lock().await = Some(SyncSession {
        docs_json: docs_arc,
        peers: peers_arc,
        port,
        peer_id,
        shutdown_tx,
    });
    *state.mdns.lock().await = Some(mdns);

    Ok(port)
}

#[tauri::command]
pub async fn sync_stop(state: tauri::State<'_, SyncState>) -> Result<(), String> {
    *state.mdns.lock().await = None; // unregisters mDNS + stops browse
    if let Some(session) = state.session.lock().await.take() {
        session.shutdown_tx.send(()).ok(); // signals axum to stop
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_set_docs(
    state: tauri::State<'_, SyncState>,
    docs:  String,
) -> Result<(), String> {
    if let Some(session) = state.session.lock().await.as_ref() {
        *session.docs_json.write().await = docs;
    }
    Ok(())
}

#[tauri::command]
pub async fn sync_get_peers(
    state: tauri::State<'_, SyncState>,
) -> Result<Vec<PeerInfo>, String> {
    match state.session.lock().await.as_ref() {
        Some(s) => Ok(s.peers.read().await.clone()),
        None    => Ok(vec![]),
    }
}

#[tauri::command]
pub async fn sync_get_port(
    state: tauri::State<'_, SyncState>,
) -> Result<Option<u16>, String> {
    Ok(state.session.lock().await.as_ref().map(|s| s.port))
}

#[tauri::command]
pub async fn sync_fetch_peer_docs(
    state:    tauri::State<'_, SyncState>,
    base_url: String,
) -> Result<String, String> {
    let url = format!("{}/api/sync/docs", base_url);
    state
        .client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sync_push_to_peer(
    state:    tauri::State<'_, SyncState>,
    base_url: String,
    docs:     String,
) -> Result<(), String> {
    let url = format!("{}/api/sync/push", base_url);
    state
        .client
        .post(&url)
        .header("content-type", "application/json")
        .body(docs)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── peer_id_from_fullname ────────────────────────────────────────────────

    #[test]
    fn peer_id_extracted_from_wellformed_fullname() {
        assert_eq!(
            peer_id_from_fullname("abc123._wickerly._tcp.local."),
            "abc123"
        );
    }

    #[test]
    fn peer_id_from_name_without_suffix_returns_full_string() {
        // The is_empty() guard in the browse loop rejects this before any mutation
        assert_eq!(peer_id_from_fullname("not-a-wickerly-service"), "not-a-wickerly-service");
    }

    // ── Test 1: ServiceRemoved removes the peer immediately ─────────────────

    #[tokio::test]
    async fn service_removed_drops_peer_from_list() {
        let peers = Arc::new(RwLock::new(vec![
            PeerInfo {
                peer_id:  "peer-A".to_string(),
                base_url: "http://10.0.0.2:8080".to_string(),
            },
        ]));

        // Simulate ServiceRemoved firing for peer-A
        remove_peer(&peers, "peer-A").await;

        assert!(
            peers.read().await.is_empty(),
            "peer-A must be removed after ServiceRemoved"
        );
    }

    #[tokio::test]
    async fn service_removed_for_unknown_peer_is_noop() {
        let peers = Arc::new(RwLock::new(vec![
            PeerInfo {
                peer_id:  "peer-A".to_string(),
                base_url: "http://10.0.0.2:8080".to_string(),
            },
        ]));

        remove_peer(&peers, "peer-Z").await; // not in list

        assert_eq!(
            peers.read().await.len(), 1,
            "peer-A must survive when an unknown peer is removed"
        );
    }

    // ── Stale-port fix: ServiceResolved updates existing peer in place ───────

    #[tokio::test]
    async fn service_resolved_updates_port_without_duplicating() {
        let peers = Arc::new(RwLock::new(vec![
            PeerInfo {
                peer_id:  "peer-A".to_string(),
                base_url: "http://10.0.0.2:1111".to_string(),
            },
        ]));

        upsert_peer(&peers, "peer-A".to_string(), "http://10.0.0.2:2222".to_string()).await;

        let list = peers.read().await;
        assert_eq!(list.len(), 1,                      "no duplicate peer created");
        assert_eq!(list[0].base_url, "http://10.0.0.2:2222", "port updated in place");
    }

    #[tokio::test]
    async fn service_resolved_adds_previously_unknown_peer() {
        let peers: Arc<RwLock<Vec<PeerInfo>>> = Arc::new(RwLock::new(vec![]));

        upsert_peer(&peers, "peer-B".to_string(), "http://10.0.0.3:3333".to_string()).await;

        assert_eq!(peers.read().await.len(), 1);
    }
}
