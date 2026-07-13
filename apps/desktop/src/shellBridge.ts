// Shell bridge - provides platform-agnostic API to the renderer
// Desktop: uses Electron IPC via window.desktopApi
// Mobile: uses Tauri invoke via platform injection

import type { ShellApi } from "@hubble.md/shell";

let injectedShellApi: ShellApi | null = null;

export function injectShellApi(api: ShellApi) {
    injectedShellApi = api;
}

export function getShellApi(): ShellApi {
    if (injectedShellApi) {
        return injectedShellApi;
    }
    // Desktop uses Electron preload
    if (typeof window !== "undefined" && "desktopApi" in window) {
        return (window as unknown as { desktopApi: ShellApi }).desktopApi;
    }
    throw new Error("No shell API available. Did you forget to inject one?");
}

// For backward compatibility, export desktopApi directly when on desktop
export const desktopApi = getShellApi();
