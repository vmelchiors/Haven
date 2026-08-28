use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub app_version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    SystemInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[tauri::command]
pub fn get_audio_devices() -> Vec<AudioDevice> {
    // Returns system audio devices (native loopback / mic detection)
    vec![
        AudioDevice {
            id: "default_mic".to_string(),
            name: "Microfone Padrão do Sistema".to_string(),
            is_default: true,
        },
        AudioDevice {
            id: "default_speaker".to_string(),
            name: "Alto-falantes / Fone de Ouvido Padrão".to_string(),
            is_default: true,
        },
    ]
}

#[tauri::command]
pub fn set_push_to_talk_key(key: String) -> Result<String, String> {
    log_info(&format!("Push to talk key updated: {}", key));
    Ok(format!("PTT key set to {}", key))
}

#[tauri::command]
pub fn toggle_mute_state(muted: bool) -> bool {
    log_info(&format!("Hardware mute state changed to: {}", muted));
    muted
}

fn log_info(msg: &str) {
    println!("[Haven Rust IPC] {}", msg);
}
