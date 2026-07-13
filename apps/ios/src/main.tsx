// iOS entry - shares renderer with desktop but uses mobile shell API
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@hubble.md/desktop/App";
import { Toaster } from "@hubble.md/desktop/components/Toaster";
import "@hubble.md/desktop/components/toast.css";
import "@hubble.md/desktop/index.css";

// Inject mobile shell API before app renders
// In production this would be set by the Tauri mobile plugin
// declare const __TAURI_INVOKE__: (cmd: string, args: unknown) => Promise<unknown>;
// const shellApi = createMobileShellApi(invoke);
// injectShellApi(shellApi);

// Theme init
const storedTheme = localStorage.getItem("hubble:theme");
if (storedTheme === "dark" || (!storedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
}

// Mount shared app
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
        <Toaster />
    </React.StrictMode>
);
