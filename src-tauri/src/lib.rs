mod sync;
use sync::SyncState;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn export_note(title: String, content: String) -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    let safe_name: String = title
        .chars()
        .map(|c| match c {
            'a'..='z' | 'A'..='Z' | '0'..='9' | ' ' | '-' | '_' | '.' => c,
            _ => '-',
        })
        .collect::<String>();
    let safe_name = safe_name.trim().to_string();
    let filename = if safe_name.is_empty() {
        "Untitled".to_string()
    } else {
        safe_name
    };

    let path = std::path::Path::new(&home)
        .join("Downloads")
        .join(format!("{}.md", filename));

    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(SyncState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            export_note,
            sync::sync_start,
            sync::sync_stop,
            sync::sync_set_docs,
            sync::sync_get_peers,
            sync::sync_get_port,
            sync::sync_fetch_peer_docs,
            sync::sync_push_to_peer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
