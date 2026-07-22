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
    fn NSTemporaryDirectory() -> *mut Object;
}

const DISPATCH_TIME_NOW: u64 = 0;
const MAX_PRESENT_ATTEMPTS: usize = 25;
const PRESENT_RETRY_DELAY_NS: i64 = 150_000_000; // 150ms

enum PresentOutcome {
    Presented,
    NotReady,
    Failed,
}

#[derive(serde::Serialize)]
pub struct PickedFile {
    pub path: String,
}

static PICKER_TX: Mutex<Option<mpsc::Sender<Option<PickedFile>>>> = Mutex::new(None);
static DELEGATE_CLASS: OnceLock<Option<&'static Class>> = OnceLock::new();
struct RawObject(*mut Object);
unsafe impl Send for RawObject {}
unsafe impl Sync for RawObject {}

static DELEGATE_INSTANCE: Mutex<Option<RawObject>> = Mutex::new(None);

fn ensure_delegate_class() -> Option<&'static Class> {
    *DELEGATE_CLASS
        .get_or_init(|| {
            let superclass = class!(NSObject);
            let Some(mut decl) = ClassDecl::new("HubbleFileDelegate", superclass) else {
                // Class already registered (e.g. re-entrant call); reuse it.
                return Class::get("HubbleFileDelegate");
            };

            unsafe {
                decl.add_method(
                    sel!(documentBrowser:didPickDocumentsAtURLs:),
                    did_pick_documents as extern "C" fn(&Object, Sel, *mut Object, *mut Object),
                );
                decl.add_method(
                    sel!(documentBrowserWasCancelled:),
                    was_cancelled as extern "C" fn(&Object, Sel, *mut Object),
                );
                decl.add_method(
                    sel!(documentBrowser:didRequestDocumentCreationWithHandler:),
                    did_request_creation as extern "C" fn(&Object, Sel, *mut Object, *mut c_void),
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

extern "C" fn did_pick_documents(
    _this: &Object,
    _sel: Sel,
    controller: *mut Object,
    urls: *mut Object,
) {
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
                    let _ = tx.send(Some(PickedFile { path: s }));
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

// void (^)(NSURL * _Nullable url, UIDocumentBrowserViewController.ImportMode importMode)
#[repr(C)]
struct ImportHandlerBlock {
    isa: *mut c_void,
    flags: i32,
    reserved: i32,
    invoke: extern "C" fn(*mut ImportHandlerBlock, *mut Object, i64),
}
const IMPORT_MODE_NONE: i64 = 0;
const IMPORT_MODE_MOVE: i64 = 2;

struct PendingCreate {
    handler: *mut c_void,
    name: String,
}

extern "C" fn cancel_create(handler: *mut c_void) {
    let handler_addr = handler as usize;
    let _ = panic::catch_unwind(AssertUnwindSafe(move || unsafe {
        let handler = handler_addr as *mut c_void;
        let block = &mut *(handler as *mut ImportHandlerBlock);
        (block.invoke)(handler as *mut ImportHandlerBlock, ptr::null_mut(), IMPORT_MODE_NONE);
        let _: () = msg_send![handler as *mut Object, release];
    }));
}

extern "C" fn perform_create(ctx: *mut c_void) {
    let pending = unsafe { Box::from_raw(ctx as *mut PendingCreate) };
    let _ = panic::catch_unwind(AssertUnwindSafe(|| {
        create_and_import(pending.handler, &pending.name);
    }));
}

extern "C" fn did_request_creation(
    _this: &Object,
    _sel: Sel,
    controller: *mut Object,
    handler: *mut c_void,
) {
    let _ =
        panic::catch_unwind(AssertUnwindSafe(|| did_request_creation_inner(controller, handler)));
}

// Files picked via the browser only ever come with permission to access that
// single file, never its containing folder, so a file can't be renamed after
// the browser has moved it into the user's chosen location (any rename comes
// back "you don't have permission to access <folder>", regardless of which
// API issues it). Ask for the name up front instead, before ever touching the
// filesystem, so the file is written with its final name the first time.
fn did_request_creation_inner(controller: *mut Object, handler: *mut c_void) {
    // Copy the handler block to the heap: we're about to wait (indefinitely,
    // until the user responds to the alert) before calling it, well beyond the
    // scope of this delegate call, and the block we were handed isn't
    // guaranteed to stay valid that long unless we take our own reference.
    let handler: *mut c_void =
        unsafe { msg_send![handler as *mut Object, copy] };

    let Some(alert_cls) = Class::get("UIAlertController") else {
        create_and_import(handler, "Untitled.md");
        return;
    };
    let Some(action_cls) = Class::get("UIAlertAction") else {
        create_and_import(handler, "Untitled.md");
        return;
    };

    unsafe {
        let title: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: "New File\0".as_ptr()];
        let alert: *mut Object = msg_send![alert_cls, alertControllerWithTitle: title message: ptr::null::<c_void>() preferredStyle: 1i64 /* Alert */];

        let _: () = msg_send![alert, addTextFieldWithConfigurationHandler: ptr::null::<c_void>()];
        let fields: *mut Object = msg_send![alert, textFields];
        if !fields.is_null() {
            let field: *mut Object = msg_send![fields, firstObject];
            if !field.is_null() {
                let placeholder: *mut Object =
                    msg_send![class!(NSString), stringWithUTF8String: "Untitled\0".as_ptr()];
                let _: () = msg_send![field, setText: placeholder];
                let _: () = msg_send![field, selectAll: ptr::null::<c_void>()];
            }
        }

        let handler_addr = handler as usize;
        let cancel_title: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: "Cancel\0".as_ptr()];
        let cancel_block = block2::RcBlock::new(
            move |_action: std::ptr::NonNull<objc2::runtime::AnyObject>| unsafe {
                // Deferred: invoking the browser's completion handler synchronously
                // here, while we're still inside the alert's own dismissal-animation
                // callback, re-enters UIKit's animation machinery and crashes.
                dispatch_async_f(&_dispatch_main_q, handler_addr as *mut c_void, cancel_create);
            },
        );
        let cancel_action: *mut Object = msg_send![
            action_cls,
            actionWithTitle: cancel_title
            style: 1i64 /* Cancel */
            handler: &*cancel_block as *const _ as *mut c_void
        ];
        let _: () = msg_send![alert, addAction: cancel_action];

        let alert_addr = alert as usize;
        let create_title: *mut Object =
            msg_send![class!(NSString), stringWithUTF8String: "Create\0".as_ptr()];
        let create_block = block2::RcBlock::new(
            move |_action: std::ptr::NonNull<objc2::runtime::AnyObject>| unsafe {
                let alert = alert_addr as *mut Object;
                let handler = handler_addr as *mut c_void;

                let mut name = "Untitled".to_string();
                let fields: *mut Object = msg_send![alert, textFields];
                if !fields.is_null() {
                    let field: *mut Object = msg_send![fields, firstObject];
                    if !field.is_null() {
                        let text: *mut Object = msg_send![field, text];
                        if !text.is_null() {
                            let utf8: *const std::os::raw::c_char = msg_send![text, UTF8String];
                            if !utf8.is_null() {
                                let s = CStr::from_ptr(utf8).to_string_lossy().trim().to_string();
                                if !s.is_empty() {
                                    name = s;
                                }
                            }
                        }
                    }
                }
                if !name.to_lowercase().ends_with(".md") {
                    name.push_str(".md");
                }
                // Deferred for the same reason as the cancel action: this is still
                // running inside the alert's dismissal-animation callback, and
                // create_and_import triggers further UIKit transitions of its own.
                let pending = Box::new(PendingCreate { handler, name });
                dispatch_async_f(
                    &_dispatch_main_q,
                    Box::into_raw(pending) as *mut c_void,
                    perform_create,
                );
            },
        );
        let create_action: *mut Object = msg_send![
            action_cls,
            actionWithTitle: create_title
            style: 0i64 /* Default */
            handler: &*create_block as *const _ as *mut c_void
        ];
        let _: () = msg_send![alert, addAction: create_action];

        let _: () = msg_send![controller, presentViewController: alert animated: true completion: ptr::null::<c_void>()];

        // UIAlertAction retains its handler block for as long as the alert is
        // alive; leak our Rust-side RcBlock handle rather than dropping it
        // (dropping would release a block the alert still owns).
        std::mem::forget(cancel_block);
        std::mem::forget(create_block);
    }
}

fn create_and_import(handler: *mut c_void, file_name: &str) {
    unsafe {
        let Some(ns_str_cls) = Class::get("NSString") else {
            let _: () = msg_send![handler as *mut Object, release];
            return;
        };

        // Stage the new file in a scratch location, not the app's own Documents
        // directory: the browser is asked to *move* it into the user's chosen
        // location next, and that location may itself be exposed as a browsable
        // folder (via LSSupportsOpeningDocumentsInPlace), which confuses it if the
        // source and destination overlap.
        let temp_dir: *mut Object = NSTemporaryDirectory();
        let temp_dir_url: *mut Object = msg_send![class!(NSURL), fileURLWithPath: temp_dir isDirectory: true];

        let Ok(cname) = std::ffi::CString::new(file_name) else {
            let _: () = msg_send![handler as *mut Object, release];
            return;
        };
        let name: *mut Object = msg_send![ns_str_cls, stringWithUTF8String: cname.as_ptr()];
        let file_url: *mut Object = msg_send![temp_dir_url, URLByAppendingPathComponent: name];

        let content: *mut Object =
            msg_send![ns_str_cls, stringWithUTF8String: "\0".as_ptr()];
        const NSUTF8_STRING_ENCODING: usize = 4;
        let _: bool = msg_send![content, writeToURL: file_url atomically: true encoding: NSUTF8_STRING_ENCODING error: ptr::null_mut::<*mut Object>()];

        let block = &mut *(handler as *mut ImportHandlerBlock);
        (block.invoke)(handler as *mut ImportHandlerBlock, file_url, IMPORT_MODE_MOVE);
        let _: () = msg_send![handler as *mut Object, release];
    }
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

            let Some(delegate_class) = ensure_delegate_class() else {
                return PresentOutcome::Failed;
            };
            let Some(picker_cls) = Class::get("UIDocumentBrowserViewController") else {
                return PresentOutcome::Failed;
            };
            let Some(ut_type_cls) = Class::get("UTType") else {
                return PresentOutcome::Failed;
            };
            let item_uti: *mut Object =
                msg_send![class!(NSString), stringWithUTF8String: "public.item\0".as_ptr()];
            let item_type: *mut Object = msg_send![ut_type_cls, typeWithIdentifier: item_uti];
            let content_types: *mut Object = msg_send![class!(NSArray), arrayWithObject: item_type];
            let picker: *mut Object = msg_send![picker_cls, alloc];
            let picker: *mut Object = msg_send![picker, initForOpeningContentTypes: content_types];

            let delegate: *mut Object = msg_send![delegate_class, alloc];
            let delegate: *mut Object = msg_send![delegate, init];
            *DELEGATE_INSTANCE.lock().unwrap_or_else(|e| e.into_inner()) = Some(RawObject(delegate));

            let _: () = msg_send![picker, setDelegate: delegate];
            let _: () = msg_send![picker, setAllowsDocumentCreation: true];

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
pub async fn pick_file() -> Result<Option<PickedFile>, String> {
    let (tx, rx) = mpsc::channel();
    *PICKER_TX.lock().unwrap_or_else(|e| e.into_inner()) = Some(tx);

    try_present_picker();

    rx.recv().map_err(|_| "Channel closed".to_string())
}
