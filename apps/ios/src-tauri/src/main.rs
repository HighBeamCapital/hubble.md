// Tauri iOS entry point - file system bridge for sandboxed iOS
// Users grant access via document picker; we read/write within granted locations

use serde::Serialize;
use tauri::Manager;

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

// Read directory listing using tauri-plugin-fs
#[tauri::command]
async fn list_directory(path: String) -> Result<DirectoryListing, String> {
    let fs = tauri::Manager::fs(&tauri::AppHandle::default());
    let entries = fs
        .read_dir(&path, None)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let (files, folders): (Vec<_>, Vec<_>) = entries
        .into_iter()
        .partition(|e| !e.is_dir.unwrap_or(false));

    Ok(DirectoryListing {
        files: files
            .into_iter()
            .map(|e| FileEntry {
                path: normalize_slashes(e.path),
                modified_at: 0, // iOS sandbox limits metadata access
            })
            .collect(),
        folders: folders
            .into_iter()
            .map(|e| FolderEntry {
                path: normalize_slashes(e.path),
                modified_at: 0,
            })
            .collect(),
    })
}

// Read file content
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    let fs = tauri::Manager::fs(&tauri::AppHandle::default());
    fs.read_file(&path, None)
        .await
        .map_err(|e| e.to_string())
}

// Write file content
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    let fs = tauri::Manager::fs(&tauri::AppHandle::default());
    fs.write_file(&path, content)
        .await
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![list_directory, read_file, write_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
