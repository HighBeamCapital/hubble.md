// iOS entry - imports the shared desktop renderer
// Desktop App.tsx detects __TAURI__ and disables terminal/UI accordingly
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@hubble.md/desktop/App";

// Theme init
const storedTheme = localStorage.getItem("hubble:theme");
if (storedTheme === "dark" || (!storedTheme && matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
