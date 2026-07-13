// Shell bridge - provides platform-agnostic API to the renderer
// Desktop: uses Electron IPC via window.desktopApi
// Mobile: uses Tauri invoke via platform injection

// This file is a stub for future mobile support.
// Currently, desktopApi is directly imported from ./desktopApi

export { desktopApi } from "./desktopApi";
