// Hubble iOS entry point
// Uses shared UI components but with mobile-specific adjustments

import React from "react";
import ReactDOM from "react-dom/client";
import App from "@hubble.md/desktop/App";
import { Toaster } from "@hubble.md/desktop/components/Toaster";

// Theme init (iOS supports dark mode)
const storedTheme = localStorage.getItem("hubble:theme");
if (storedTheme === "dark" || (!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
}

// Signal mobile platform to renderer
window.__TAURI__ = true;

// Mount app
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
        <Toaster />
    </React.StrictMode>
);
