// iOS entry - injects mobile shell API into shared desktop renderer

import App from "@hubble.md/desktop/App";
import React from "react";
import ReactDOM from "react-dom/client";

// Theme init
const storedTheme = localStorage.getItem("hubble:theme");
if (
	storedTheme === "dark" ||
	(!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
	document.documentElement.classList.add("dark");
}

// Mobile shell API (will be replaced with Tauri invoke when plugins are ready)
// This allows the desktop App to detect __TAURI__ and disable terminal
window.__TAURI__ = true; // Signal mobile mode to renderer

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
