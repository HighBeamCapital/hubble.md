// Tauri iOS entry point - file system bridge for sandboxed iOS
// Commands use std::fs with granted paths via Tauri's security model

use serde::Serialize;

#[derive(Serialize, Clone)]
struct FileEntry {
    path: String,
    modified_at: u64,
}

#[derive(Serialize, Clone)]
struct FolderEntry {
    path: String,
    modified_at: u64,
}

#[derive(Serialize, Clone)]
struct DirectoryListing {
    files: Vec<FileEntry>,
    folders: Vec<FolderEntry>,
}

fn normalize_slashes(path: String) -> String {
    path.replace('\\', "/")
}

// Directory listing command
#[tauri::command]
fn list_directory(path: String) -> Result<DirectoryListing, String> {
    let mut files = Vec::new();
    let mut folders = Vec::new();
    
    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let path_str = normalize_slashes(entry_path.to_string_lossy().to_string());
        
        if entry_path.is_dir() {
            folders.push(FolderEntry { path: path_str, modified_at: 0 });
        } else {
            files.push(FileEntry { path: path_str, modified_at: 0 });
        }
    }
    
    Ok(DirectoryListing { files, folders })
}

// Read file command
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

// Write file command
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_directory, read_file, write_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
