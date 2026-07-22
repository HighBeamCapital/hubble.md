mod pick_file;
mod pick_folder;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::ptr;
use std::sync::Mutex;

use objc::runtime::{Class, Object};
use objc::{class, msg_send, sel, sel_impl};
use tauri::Manager;

struct OpenedUrls(Mutex<Vec<tauri::Url>>);

#[tauri::command]
fn opened_urls(app: tauri::AppHandle) -> Vec<tauri::Url> {
    app.state::<OpenedUrls>()
        .0
        .lock()
        .unwrap()
        .clone()
}

#[tauri::command]
fn start_scoped_access(path: String) -> Result<(), String> {
    unsafe {
        let ns_url_cls = Class::get("NSURL").ok_or("NSURL class not found")?;
        let ns_str_cls = Class::get("NSString").ok_or("NSString class not found")?;

        let path_clone = path.clone();
        let utf8 = std::ffi::CString::new(path).map_err(|e| e.to_string())?;
        let ns_str: *mut Object = msg_send![ns_str_cls, stringWithUTF8String: utf8.as_ptr()];
        if ns_str == ptr::null_mut() {
            return Err(format!("Failed to create NSString from path: {}", path_clone));
        }
        let ns_url: *mut Object = msg_send![ns_url_cls, fileURLWithPath: ns_str];
        
        if ns_url == ptr::null_mut() {
            return Err(format!("Failed to create NSURL from path: {}", path_clone));
        }

        let result: bool = msg_send![ns_url, startAccessingSecurityScopedResource];
        if result {
            Ok(())
        } else {
            Err(format!("startAccessingSecurityScopedResource returned false for path: {}", path_clone))
        }
    }
}

#[tauri::command]
fn stop_scoped_access(path: String) -> Result<(), String> {
    unsafe {
        let ns_url_cls = Class::get("NSURL").ok_or("NSURL class not found")?;
        let ns_str_cls = Class::get("NSString").ok_or("NSString class not found")?;

        let path_clone = path.clone();
        let utf8 = std::ffi::CString::new(path).map_err(|e| e.to_string())?;
        let ns_str: *mut Object = msg_send![ns_str_cls, stringWithUTF8String: utf8.as_ptr()];
        if ns_str == ptr::null_mut() {
            return Err(format!("Failed to create NSString from path: {}", path_clone));
        }
        let ns_url: *mut Object = msg_send![ns_url_cls, fileURLWithPath: ns_str];
        
        if ns_url == ptr::null_mut() {
            return Err(format!("Failed to create NSURL from path: {}", path_clone));
        }

        let _: () = msg_send![ns_url, stopAccessingSecurityScopedResource];
        Ok(())
    }
}

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

    // Files backed by a document provider (iCloud Drive, etc.) reject both a raw
    // rename(2) syscall and an uncoordinated NSFileManager move with EPERM: the
    // provider itself has to perform the move. NSFileCoordinator is Apple's
    // documented mechanism for that — it hands the actual move to the provider
    // from inside the accessor block, rather than our sandboxed process doing it
    // directly.
    use objc2::AnyThread;
    use objc2_foundation::{
        NSFileCoordinator, NSFileCoordinatorWritingOptions, NSFileManager, NSString, NSURL,
    };

    let from_ns = NSString::from_str(&from_path);
    let to_ns = NSString::from_str(&to_path);
    let from_url = unsafe { NSURL::fileURLWithPath(&from_ns) };
    let to_url = unsafe { NSURL::fileURLWithPath(&to_ns) };

    let coordinator = NSFileCoordinator::alloc();
    let coordinator = unsafe { NSFileCoordinator::initWithFilePresenter(coordinator, None) };

    let move_error: std::cell::RefCell<Option<String>> = std::cell::RefCell::new(None);
    let block = block2::StackBlock::new(
        |new_from: std::ptr::NonNull<NSURL>, new_to: std::ptr::NonNull<NSURL>| {
            let fm = NSFileManager::defaultManager();
            let from_ref = unsafe { new_from.as_ref() };
            let to_ref = unsafe { new_to.as_ref() };
            if let Err(e) = unsafe { fm.moveItemAtURL_toURL_error(from_ref, to_ref) } {
                *move_error.borrow_mut() = Some(e.localizedDescription().to_string());
            }
        },
    );

    let mut coordinator_error = None;
    unsafe {
        coordinator.coordinateWritingItemAtURL_options_writingItemAtURL_options_error_byAccessor(
            &from_url,
            NSFileCoordinatorWritingOptions::ForMoving,
            &to_url,
            NSFileCoordinatorWritingOptions::ForReplacing,
            Some(&mut coordinator_error),
            &block,
        );
    }

    if let Some(err) = coordinator_error {
        return Err(err.localizedDescription().to_string());
    }
    if let Some(msg) = move_error.into_inner() {
        return Err(msg);
    }
    Ok(())
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
fn get_launch_file_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let urls = app.state::<OpenedUrls>().0.lock().unwrap().clone();
    for url in &urls {
        if url.scheme() == "file" {
            if let Ok(path) = url.to_file_path() {
                // Convert to absolute path for iOS compatibility
                return Ok(Some(path.to_string_lossy().to_string()));
            }
        }
    }
    Ok(None)
}

#[tauri::command]
fn get_launch_workspace_path() -> Result<Option<String>, String> {
    Ok(None)
}

#[tauri::mobile_entry_point]
fn mobile_entry() {
    std::panic::set_hook(Box::new(|info| {
        if let Ok(home) = std::env::var("HOME") {
            let path = Path::new(&home).join("Documents").join("hubble_panic.log");
            let _ = fs::write(path, format!("{}", info));
        }
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(OpenedUrls(Mutex::new(vec![])))
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
            get_launch_file_path,
            get_launch_workspace_path,
            pick_file::pick_file,
            pick_folder::pick_folder,
            start_scoped_access,
            stop_scoped_access,
            opened_urls,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            #[cfg(target_os = "ios")]
            if let tauri::RunEvent::Opened { urls } = event {
                use tauri::Emitter;
                app.state::<OpenedUrls>()
                    .0
                    .lock()
                    .unwrap()
                    .extend(urls.clone());
                let _ = app.emit("opened", urls);
            }
        });
}
