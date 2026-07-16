use std::ffi::CStr;
use std::ptr;
use std::sync::{mpsc, Mutex, OnceLock};

use objc::declare::ClassDecl;
use objc::runtime::{Class, Object, Sel};
use objc::{class, msg_send, sel, sel_impl};

static PICKER_TX: Mutex<Option<mpsc::Sender<Option<String>>>> = Mutex::new(None);
static DELEGATE_CLASS: OnceLock<&'static Class> = OnceLock::new();
struct RawObject(*mut Object);
unsafe impl Send for RawObject {}
unsafe impl Sync for RawObject {}

static DELEGATE_INSTANCE: Mutex<Option<RawObject>> = Mutex::new(None);

fn ensure_delegate_class() -> &'static Class {
    *DELEGATE_CLASS.get_or_init(|| {
        let superclass = class!(NSObject);
        let mut decl = ClassDecl::new("HubbleFolderDelegate", superclass).unwrap();

        unsafe {
            decl.add_method(
                sel!(documentPicker:didPickDocumentsAtURLs:),
                did_pick_documents as extern "C" fn(&Object, Sel, *mut Object, *mut Object),
            );
            decl.add_method(
                sel!(documentPickerWasCancelled:),
                was_cancelled as extern "C" fn(&Object, Sel, *mut Object),
            );
        }

        decl.register()
    })
}

extern "C" fn did_pick_documents(_this: &Object, _sel: Sel, _controller: *mut Object, urls: *mut Object) {
    unsafe {
        let count: usize = msg_send![urls, count];

        if count > 0 {
            let url: *mut Object = msg_send![urls, objectAtIndex: 0];
            let path: *mut Object = msg_send![url, path];
            if !path.is_null() {
                let cstr: &CStr = msg_send![&*path, UTF8String];
                let s = cstr.to_string_lossy().to_string();
                // Release the delegate instance
                let _: () = msg_send![&*(DELEGATE_INSTANCE.lock().unwrap().take().unwrap().0), release];
                if let Some(tx) = PICKER_TX.lock().unwrap().take() {
                    let _ = tx.send(Some(s));
                }
                return;
            }
        }

        let _: () = msg_send![&*(DELEGATE_INSTANCE.lock().unwrap().take().unwrap().0), release];
        if let Some(tx) = PICKER_TX.lock().unwrap().take() {
            let _ = tx.send(None);
        }
    }
}

extern "C" fn was_cancelled(_this: &Object, _sel: Sel, _controller: *mut Object) {
    unsafe {
        let _: () = msg_send![&*(DELEGATE_INSTANCE.lock().unwrap().take().unwrap().0), release];
    }
    if let Some(tx) = PICKER_TX.lock().unwrap().take() {
        let _ = tx.send(None);
    }
}

#[tauri::command]
pub async fn pick_folder(window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    let (tx, rx) = mpsc::channel();
    *PICKER_TX.lock().unwrap() = Some(tx);

    let delegate_class = ensure_delegate_class();

    window.run_on_main_thread(move || unsafe {
        let app: *mut Object = msg_send![class!(UIApplication), sharedApplication];
        if app.is_null() { return; }

        let scenes: *mut Object = msg_send![app, connectedScenes];
        if scenes.is_null() { return; }

        let all_obj: *mut Object = msg_send![scenes, allObjects];
        if all_obj.is_null() { return; }

        let count: usize = msg_send![all_obj, count];
        if count == 0 { return; }

        let window_scene: *mut Object = msg_send![all_obj, objectAtIndex: 0];
        if window_scene.is_null() { return; }

        let window_obj: *mut Object = msg_send![window_scene, keyWindow];
        if window_obj.is_null() { return; }

        let root_vc: *mut Object = msg_send![window_obj, rootViewController];
        if root_vc.is_null() { return; }

        let nsstring_cls = class!(NSString);
        let folder_type: *mut Object = msg_send![nsstring_cls, stringWithUTF8String: "public.folder\0".as_ptr()];
        let document_types: *mut Object = msg_send![class!(NSArray), arrayWithObject: folder_type];

        let picker_cls = Class::get("UIDocumentPickerViewController").unwrap();
        let picker: *mut Object = msg_send![picker_cls, alloc];
        let picker: *mut Object = msg_send![picker, initWithDocumentTypes: document_types inMode: 0i64];

        let delegate: *mut Object = msg_send![delegate_class, alloc];
        let delegate: *mut Object = msg_send![delegate, init];
        *DELEGATE_INSTANCE.lock().unwrap() = Some(RawObject(delegate));

        let _: () = msg_send![picker, setDelegate: delegate];

        let _: () = msg_send![root_vc, presentViewController: picker animated: true completion: ptr::null::<std::ffi::c_void>()];
    })
    .map_err(|e| e.to_string())?;

    rx.recv().map_err(|_| "Channel closed".to_string())
}
