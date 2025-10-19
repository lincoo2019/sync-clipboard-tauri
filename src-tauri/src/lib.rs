extern crate alloc;

use alloc::format;
use alloc::string::String;

mod webdav;
use webdav::{WebDAVState, webdav_test_connection, webdav_upload_clipboard, webdav_download_clipboard, get_default_webdav_config};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sharetarget::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_toast::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        // .plugin(tauri_plugin_quicktile::init()) // Temporarily disabled due to compilation errors
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_deep_link::init())
        .manage(WebDAVState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            webdav_test_connection,
            webdav_upload_clipboard,
            webdav_download_clipboard,
            get_default_webdav_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
