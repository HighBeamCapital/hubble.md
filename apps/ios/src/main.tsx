import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./style.css";

const storedTheme = localStorage.getItem("hubble:theme");
const isDark =
	storedTheme === "dark" ||
	(!storedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
if (isDark) {
	document.documentElement.classList.add("dark");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);

import("./tauriApi")
	.then(() =>
		import("@tauri-apps/api/webviewWindow").then(
			({ getCurrentWebviewWindow }) => {
				getCurrentWebviewWindow?.()?.show();
			},
		),
	)
	.catch(() => {});
