use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

/// Shared backend port state
pub struct BackendPortState(pub Mutex<Option<u16>>);

// ─────────────────────────────────────────────────────────────────────────────
// IPC Commands — typed mutations
// ─────────────────────────────────────────────────────────────────────────────

/// Set the backend port (called by sidecar manager after startup)
#[tauri::command]
fn set_backend_port(port: u16, state: State<'_, BackendPortState>) {
    let mut backend_port = state.0.lock().unwrap();
    *backend_port = Some(port);
}

/// Open a URL in the system's default browser
#[tauri::command]
async fn open_external(url: String, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<String>)
        .map_err(|e| e.to_string())
}

/// Set the window title
#[tauri::command]
async fn set_window_title(title: String, app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.set_title(&title).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC Queries — typed reads
// ─────────────────────────────────────────────────────────────────────────────

/// Get the backend WebSocket/HTTP port
#[tauri::command]
fn get_backend_port(state: State<'_, BackendPortState>) -> Option<u16> {
    *state.0.lock().unwrap()
}

/// Get the application version
#[tauri::command]
fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Get the application data directory
#[tauri::command]
fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    app.path()
        .app_data_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ─────────────────────────────────────────────────────────────────────────────
// Application Entry Point
// ─────────────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(BackendPortState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            // Commands
            set_backend_port,
            open_external,
            set_window_title,
            // Queries
            get_backend_port,
            get_app_version,
            get_app_data_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
