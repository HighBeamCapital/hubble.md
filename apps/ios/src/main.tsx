// Hubble iOS - Tauri mobile entry point
import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

// Theme init
const storedTheme = localStorage.getItem("hubble:theme");
const isDark = storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
if (isDark) {
    document.documentElement.classList.add("dark");
}

function MobileApp() {
    return (
        <main className="flex flex-col h-dvh bg-white dark:bg-gray-900 text-black dark:text-white">
            <div className="flex-1 p-4">
                <h1 className="text-2xl font-bold mb-4">Hubble for iOS</h1>
                <p className="text-gray-600">iOS version in development</p>
            </div>
        </main>
    );
}

// Mount React app
const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(
    <React.StrictMode>
        <MobileApp />
    </React.StrictMode>,
);

// Fix: Show window after mount (Tauri iOS needs this)
try {
    const { getCurrentWebviewWindow } = require("@tauri-apps/api/webviewWindow");
    if (getCurrentWebviewWindow) {
        getCurrentWebviewWindow().show();
    }
} catch (e) {
    // Tauri API not available in dev mode
}
