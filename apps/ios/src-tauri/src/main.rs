// Tauri iOS entry point - file system bridge for sandboxed iOS
// Users grant access via document picker; we read/write within granted locations

#![cfg_attr(target_os = "ios", ios::app_delegate::ClassName = "App")]

use std::fs;
use std::path::Path;
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct FileEntry {
    path: String,
    modified_at: u64,
}

#[derive(Serialize)]
struct FolderEntry {
    path: String,
    modified_at: u64,
}

#[derive(Serialize)]
struct DirectoryListing {
    files: Vec<FileEntry>,
    folders: Vec<FolderEntry>,
}

fn modified_timestamp(path: &Path) -> u64 {
    fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0)
        })
        .unwrap_or(0)
}

fn normalize_slashes(path: String) -> String {
    path.replace('\\', "/")
}

#[tauri::command]
async fn list_directory(path: String) -> Result<DirectoryListing, String> {
    let mut files = Vec::new();
    let mut folders = Vec::new();

    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let path_str = normalize_slashes(path.to_string_lossy().to_string());
        let modified = modified_timestamp(&path);

        if path.is_dir() {
            folders.push(FolderEntry { path: path_str, modified_at: modified });
        } else {
            files.push(FileEntry { path: path_str, modified_at: modified });
        }
    }

    Ok(DirectoryListing { files, folders })
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri::window::Window::default())
        .invoke_handler(tauri::generate_handler![list_directory])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
