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
                    let fullname = info.get_fullname();
                    let remote_id = fullname
                        .split("._wickerly._tcp.local.")
                        .next()
                        .unwrap_or("")
                        .to_string();

                    if remote_id.is_empty() || remote_id == my_safe_id {
                        continue;
                    }

                    if let Some(addr) = info.get_addresses().iter().next() {
                        let base_url = format!("http://{}:{}", addr, info.get_port());
                        let mut list = peers.write().await;
                        if let Some(existing) = list.iter_mut().find(|p| p.peer_id == remote_id) {
                            // Peer restarted with a new port — update in place
                            existing.base_url = base_url;
                        } else {
                            list.push(PeerInfo { peer_id: remote_id, base_url });
                        }
                    }
                }
                ServiceEvent::ServiceRemoved(_, fullname) => {
                    let remote_id = fullname
                        .split("._wickerly._tcp.local.")
                        .next()
                        .unwrap_or("")
                        .to_string();

                    if !remote_id.is_empty() && remote_id != my_safe_id {
                        peers.write().await.retain(|p| p.peer_id != remote_id);
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
