// Tauri iOS entry point - library for mobile

#[tauri::command]
fn list_directory(path: String) -> Result<String, String> {
    Ok(format!("Would list: {}", path))
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_directory, read_file, write_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
