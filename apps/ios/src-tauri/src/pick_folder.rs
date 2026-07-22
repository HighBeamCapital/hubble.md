use std::ffi::{c_void, CStr};
use std::panic::{self, AssertUnwindSafe};
use std::ptr;
use std::sync::{mpsc, Mutex, OnceLock};

use objc::declare::ClassDecl;
use objc::runtime::{Class, Object, Sel};
use objc::{class, msg_send, sel, sel_impl};

#[repr(C)]
struct DispatchObject {
    _priv: [u8; 0],
}

extern "C" {
    static _dispatch_main_q: DispatchObject;
    fn dispatch_async_f(
        queue: *const DispatchObject,
        context: *mut c_void,
        work: extern "C" fn(*mut c_void),
    );
    fn dispatch_after_f(
        when: u64,
        queue: *const DispatchObject,
        context: *mut c_void,
        work: extern "C" fn(*mut c_void),
    );
    fn dispatch_time(when: u64, delta: i64) -> u64;
}

const DISPATCH_TIME_NOW: u64 = 0;
const MAX_PRESENT_ATTEMPTS: usize = 25;
const PRESENT_RETRY_DELAY_NS: i64 = 150_000_000; // 150ms

enum PresentOutcome {
    Presented,
    NotReady,
    Failed,
}

static PICKER_TX: Mutex<Option<mpsc::Sender<Option<String>>>> = Mutex::new(None);
static DELEGATE_CLASS: OnceLock<Option<&'static Class>> = OnceLock::new();
struct RawObject(*mut Object);
unsafe impl Send for RawObject {}
unsafe impl Sync for RawObject {}

static DELEGATE_INSTANCE: Mutex<Option<RawObject>> = Mutex::new(None);

fn ensure_delegate_class() -> Option<&'static Class> {
    *DELEGATE_CLASS
        .get_or_init(|| {
            let superclass = class!(NSObject);
            let Some(mut decl) = ClassDecl::new("HubbleFolderDelegate", superclass) else {
                // Class already registered (e.g. re-entrant call); reuse it.
                return Class::get("HubbleFolderDelegate");
            };

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

            Some(decl.register())
        })
}

fn send_none() {
    if let Some(tx) = PICKER_TX
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
    {
        let _ = tx.send(None);
    }
}

fn cleanup_delegate() {
    if let Some(raw) = DELEGATE_INSTANCE
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
    {
        unsafe {
            let _: () = msg_send![&*(raw.0), release];
        }
    }
}

fn dismiss_controller(controller: *mut Object) {
    if controller.is_null() {
        return;
    }
    unsafe {
        let _: () = msg_send![controller, dismissViewControllerAnimated: true completion: ptr::null::<c_void>()];
    }
}

extern "C" fn did_pick_documents(_this: &Object, _sel: Sel, controller: *mut Object, urls: *mut Object) {
    if panic::catch_unwind(AssertUnwindSafe(|| did_pick_documents_inner(controller, urls))).is_err() {
        cleanup_delegate();
        dismiss_controller(controller);
        send_none();
    }
}

fn did_pick_documents_inner(controller: *mut Object, urls: *mut Object) {
    unsafe {
        let count: usize = msg_send![urls, count];

        if count > 0 {
            let url: *mut Object = msg_send![urls, objectAtIndex: 0];
            let path: *mut Object = msg_send![url, path];
            if !path.is_null() {
                let utf8: *const std::os::raw::c_char = msg_send![path, UTF8String];
                let s = CStr::from_ptr(utf8).to_string_lossy().to_string();
                cleanup_delegate();
                dismiss_controller(controller);
                if let Some(tx) = PICKER_TX.lock().unwrap_or_else(|e| e.into_inner()).take() {
                    let _ = tx.send(Some(s));
                }
                return;
            }
        }

        cleanup_delegate();
        dismiss_controller(controller);
        send_none();
    }
}

extern "C" fn was_cancelled(_this: &Object, _sel: Sel, controller: *mut Object) {
    let _ = panic::catch_unwind(AssertUnwindSafe(cleanup_delegate));
    dismiss_controller(controller);
    send_none();
}

extern "C" fn present_picker(ctx: *mut c_void) {
    let attempt = ctx as usize;
    let outcome = match panic::catch_unwind(present_picker_inner) {
        Ok(outcome) => outcome,
        Err(_) => PresentOutcome::Failed,
    };
    match outcome {
        PresentOutcome::Presented => {}
        PresentOutcome::Failed => send_none(),
        PresentOutcome::NotReady => {
            if attempt + 1 >= MAX_PRESENT_ATTEMPTS {
                send_none();
            } else {
                schedule_present_retry(attempt + 1);
            }
        }
    }
}

fn schedule_present_retry(attempt: usize) {
    unsafe {
        let when = dispatch_time(DISPATCH_TIME_NOW, PRESENT_RETRY_DELAY_NS);
        dispatch_after_f(when, &_dispatch_main_q, attempt as *mut c_void, present_picker);
    }
}

fn present_picker_inner() -> PresentOutcome {
    let Some(delegate_class) = ensure_delegate_class() else {
        return PresentOutcome::Failed;
    };

    unsafe {
        let app: *mut Object = msg_send![class!(UIApplication), sharedApplication];
        if app.is_null() {
            return PresentOutcome::NotReady;
        }

        let mut window_obj: *mut Object = ptr::null_mut();

        let scenes: *mut Object = msg_send![app, connectedScenes];
        if !scenes.is_null() {
            let all_obj: *mut Object = msg_send![scenes, allObjects];
            if !all_obj.is_null() {
                let count: usize = msg_send![all_obj, count];
                if count > 0 {
                    let window_scene: *mut Object = msg_send![all_obj, objectAtIndex: 0];
                    if !window_scene.is_null() {
                        window_obj = msg_send![window_scene, keyWindow];
                    }
                }
            }
        }

        if window_obj.is_null() {
            window_obj = msg_send![app, keyWindow];
        }

        if window_obj.is_null() {
            return PresentOutcome::NotReady;
        }

        let root_vc: *mut Object = msg_send![window_obj, rootViewController];
        if root_vc.is_null() {
            return PresentOutcome::NotReady;
        }

        let is_loaded: bool = msg_send![root_vc, isViewLoaded];
        if !is_loaded {
            return PresentOutcome::NotReady;
        }

        let vc_view: *mut Object = msg_send![root_vc, view];
        if vc_view.is_null() {
            return PresentOutcome::NotReady;
        }
        let superview: *mut Object = msg_send![vc_view, superview];
        if superview.is_null() {
            return PresentOutcome::NotReady;
        }

        let presenting: *mut Object = msg_send![root_vc, presentedViewController];
        if !presenting.is_null() {
            return PresentOutcome::NotReady;
        }

        let nsstring_cls = class!(NSString);
        let folder_type: *mut Object = msg_send![nsstring_cls, stringWithUTF8String: "public.folder\0".as_ptr()];
        let document_types: *mut Object = msg_send![class!(NSArray), arrayWithObject: folder_type];

        let Some(picker_cls) = Class::get("UIDocumentPickerViewController") else {
            return PresentOutcome::Failed;
        };
        let picker: *mut Object = msg_send![picker_cls, alloc];
        let picker: *mut Object = msg_send![picker, initWithDocumentTypes: document_types inMode: 0i64];

        let delegate: *mut Object = msg_send![delegate_class, alloc];
        let delegate: *mut Object = msg_send![delegate, init];
        *DELEGATE_INSTANCE.lock().unwrap_or_else(|e| e.into_inner()) = Some(RawObject(delegate));

        let _: () = msg_send![picker, setDelegate: delegate];

        let _: () = msg_send![root_vc, presentViewController: picker animated: true completion: ptr::null::<c_void>()];

        PresentOutcome::Presented
    }
}

fn try_present_picker() {
    unsafe {
        dispatch_async_f(&_dispatch_main_q, ptr::null_mut(), present_picker);
    }
}

#[tauri::command]
pub async fn pick_folder() -> Result<Option<String>, String> {
    let (tx, rx) = mpsc::channel();
    *PICKER_TX.lock().unwrap_or_else(|e| e.into_inner()) = Some(tx);

    try_present_picker();

    rx.recv().map_err(|_| "Channel closed".to_string())
}
