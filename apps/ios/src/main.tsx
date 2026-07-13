// Hubble iOS - Tauri mobile entry point
import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";

// Error handling
window.addEventListener("error", (e) => {
    console.error("Global error:", e.error);
    const root = document.getElementById("root");
    if (root) {
        root.innerHTML = `<div style="padding: 20px; color: red;">
            <h2>Error Loading App</h2>
            <pre>${e.error?.message || "Unknown error"}</pre>
        </div>`;
    }
});

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

try {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <MobileApp />
        </React.StrictMode>,
    );
} catch (e) {
    console.error("Render error:", e);
    document.getElementById("root")!.innerHTML = `<div style="padding: 20px;">Failed: ${e}</div>`;
}
