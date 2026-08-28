// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod ptt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            commands::get_system_info,
            commands::get_audio_devices,
            commands::set_push_to_talk_key,
            commands::toggle_mute_state,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Haven desktop application");
}
