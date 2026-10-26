//! Folder access that outlives a single launch: security-scoped bookmarks for a
//! picked folder, iCloud-aware reads, and a markdown file search for links.

use std::ffi::CStr;
use std::fs;
use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::ptr;

use objc::runtime::{Object, BOOL, NO};
use objc::{class, msg_send, sel, sel_impl};
use serde::Serialize;

#[derive(Serialize)]
pub struct FolderAccess {
    pub path: String,
    pub bookmark: String,
}

unsafe fn ns_string(value: &str) -> Result<*mut Object, String> {
    let c = std::ffi::CString::new(value).map_err(|e| e.to_string())?;
    let s: *mut Object = msg_send![class!(NSString), stringWithUTF8String: c.as_ptr()];
    if s.is_null() {
        return Err(format!("Failed to create NSString from {value}"));
    }
    Ok(s)
}

unsafe fn rust_string(ns: *mut Object) -> Option<String> {
    if ns.is_null() {
        return None;
    }
    let utf8: *const std::os::raw::c_char = msg_send![ns, UTF8String];
    if utf8.is_null() {
        return None;
    }
    Some(CStr::from_ptr(utf8).to_string_lossy().into_owned())
}

/// Serializes a bookmark for `url` as base64 so the frontend can persist it.
/// Must be called while the URL's security scope is active.
pub unsafe fn bookmark_for_url(url: *mut Object) -> Result<String, String> {
    let keys: *mut Object = ptr::null_mut();
    let relative: *mut Object = ptr::null_mut();
    let data: *mut Object = msg_send![url,
        bookmarkDataWithOptions: 0usize
        includingResourceValuesForKeys: keys
        relativeToURL: relative
        error: ptr::null_mut::<*mut Object>()];
    if data.is_null() {
        return Err("Couldn't create a bookmark for the folder".into());
    }
    let encoded: *mut Object = msg_send![data, base64EncodedStringWithOptions: 0usize];
    rust_string(encoded).ok_or_else(|| "Couldn't encode the folder bookmark".into())
}

/// Resolves a saved folder bookmark and reacquires access to the folder.
#[tauri::command]
pub fn resolve_folder_bookmark(bookmark: String) -> Result<FolderAccess, String> {
    unsafe {
        let encoded = ns_string(&bookmark)?;
        let data: *mut Object = msg_send![class!(NSData), alloc];
        let data: *mut Object = msg_send![data, initWithBase64EncodedString: encoded options: 0usize];
        if data.is_null() {
            return Err("Saved folder bookmark is corrupt".into());
        }
        let mut stale: BOOL = NO;
        let relative: *mut Object = ptr::null_mut();
        let url: *mut Object = msg_send![class!(NSURL),
            URLByResolvingBookmarkData: data
            options: 0usize
            relativeToURL: relative
            bookmarkDataIsStale: &mut stale
            error: ptr::null_mut::<*mut Object>()];
        if url.is_null() {
            return Err("The saved folder is no longer available".into());
        }
        let started: BOOL = msg_send![url, startAccessingSecurityScopedResource];
        if started == NO {
            return Err("Access to the saved folder was revoked".into());
        }
        let path: *mut Object = msg_send![url, path];
        let path = rust_string(path).ok_or("Couldn't read the folder path")?;
        // A stale bookmark still resolves, but iOS asks for a fresh one so the
        // next launch keeps working after the folder moved or was renamed.
        let bookmark = if stale != NO {
            bookmark_for_url(url).unwrap_or(bookmark)
        } else {
            bookmark
        };
        Ok(FolderAccess { path, bookmark })
    }
}

/// Reads a text file through NSFileCoordinator, which makes the file provider
/// download iCloud files that are not yet on the device before handing them over.
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    use objc2::AnyThread;
    use objc2_foundation::{NSFileCoordinator, NSFileCoordinatorReadingOptions, NSString, NSURL};

    let ns_path = NSString::from_str(&path);
    let url = NSURL::fileURLWithPath(&ns_path);
    let coordinator = NSFileCoordinator::initWithFilePresenter(NSFileCoordinator::alloc(), None);

    let result: std::cell::RefCell<Option<Result<String, String>>> = std::cell::RefCell::new(None);
    let block = block2::StackBlock::new(|read_url: std::ptr::NonNull<NSURL>| {
        let read_path = unsafe { read_url.as_ref().path() }
            .map(|p| p.to_string())
            .unwrap_or_else(|| path.clone());
        *result.borrow_mut() = Some(fs::read_to_string(read_path).map_err(|e| e.to_string()));
    });

    let mut coordinator_error = None;
    coordinator.coordinateReadingItemAtURL_options_error_byAccessor(
        &url,
        NSFileCoordinatorReadingOptions::empty(),
        Some(&mut coordinator_error),
        &block,
    );
    if let Some(err) = coordinator_error {
        return Err(err.localizedDescription().to_string());
    }
    result
        .into_inner()
        .unwrap_or_else(|| Err(format!("Couldn't read {path}")))
}

#[derive(Serialize)]
pub struct DirectoryEntry {
    name: String,
    path: String,
    is_dir: bool,
}

/// Older iCloud Drive versions represent a file that is not downloaded as a
/// hidden `.<name>.icloud` stub. Returns the real file name for such a stub.
fn icloud_stub_name(name: &str) -> Option<&str> {
    name.strip_prefix('.')?.strip_suffix(".icloud")
}

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())?.flatten() {
        let raw_name = entry.file_name().to_string_lossy().into_owned();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        let (name, entry_path) = match icloud_stub_name(&raw_name) {
            Some(real) => (real.to_string(), Path::new(&path).join(real)),
            None => (raw_name, entry.path()),
        };
        entries.push(DirectoryEntry {
            name,
            path: entry_path.to_string_lossy().into_owned(),
            is_dir: file_type.is_dir(),
        });
    }
    Ok(entries)
}

/// Finds the first file named `file_name` (case-insensitive) under `root`,
/// skipping hidden folders and `.assets` folders. Used to resolve wiki links.
#[tauri::command]
pub async fn find_markdown_file(root: String, file_name: String) -> Option<String> {
    let wanted = file_name.to_lowercase();
    // Breadth-first, so the shallowest match wins.
    let mut queue = VecDeque::from([PathBuf::from(root)]);
    while let Some(dir) = queue.pop_front() {
        let Ok(read) = fs::read_dir(&dir) else {
            continue;
        };
        let mut subdirs = Vec::new();
        for entry in read.flatten() {
            let raw_name = entry.file_name().to_string_lossy().into_owned();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if file_type.is_dir() {
                if !raw_name.starts_with('.') && !raw_name.ends_with(".assets") {
                    subdirs.push(entry.path());
                }
                continue;
            }
            let name = icloud_stub_name(&raw_name).unwrap_or(&raw_name);
            if name.to_lowercase() == wanted {
                return Some(dir.join(name).to_string_lossy().into_owned());
            }
        }
        subdirs.sort();
        queue.extend(subdirs);
    }
    None
}
