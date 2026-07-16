mod pick_folder;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Serialize)]
struct DirectoryEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Serialize)]
struct DirectoryListing {
    entries: Vec<DirectoryEntry>,
}

#[tauri::command]
fn list_directory(path: String) -> Result<DirectoryListing, String> {
    let mut entries = Vec::new();
    let dir = fs::read_dir(&path).map_err(|e| e.to_string())?;
    for entry in dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        entries.push(DirectoryEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
        });
    }
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(DirectoryListing { entries })
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_folder(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_file(from_path: String, to_path: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::rename(&from_path, &to_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn path_exists(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).exists())
}

#[derive(Deserialize)]
struct DeleteOptions {
    recursive: Option<bool>,
}

#[tauri::command]
fn delete_file(path: String, options: Option<DeleteOptions>) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        let recursive = options.and_then(|o| o.recursive).unwrap_or(false);
        if recursive {
            fs::remove_dir_all(&path).map_err(|e| e.to_string())?;
        } else {
            fs::remove_dir(&path).map_err(|e| e.to_string())?;
        }
    } else {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn resolve_path(path: String) -> Result<String, String> {
    let canonical = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    Ok(canonical.to_string_lossy().to_string())
}

#[tauri::command]
fn real_path(path: String) -> Result<String, String> {
    let canonical = fs::canonicalize(&path).map_err(|e| e.to_string())?;
    Ok(canonical.to_string_lossy().to_string())
}

#[tauri::command]
fn get_launch_file_path() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::command]
fn get_launch_workspace_path() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::mobile_entry_point]
fn mobile_entry() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            list_directory,
            read_file,
            write_file,
            create_folder,
            rename_file,
            path_exists,
            delete_file,
            read_binary_file,
            write_binary_file,
            resolve_path,
            real_path,
            get_launch_file_path,
            get_launch_workspace_path,
            pick_folder::pick_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
