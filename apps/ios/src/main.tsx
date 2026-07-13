// Hubble iOS - Tauri mobile entry point

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

// TODO: Integrate @hubble.md/ui EditorView and MarkdownSourceEditor
// once file system bridge is implemented

function MobileApp() {
	return (
		<main className="flex h-dvh flex-col bg-background text-foreground">
			<div className="flex-1 p-4">
				<h1 className="text-2xl font-bold mb-4">Hubble for iOS</h1>
				<p className="text-muted-foreground">iOS version in development</p>
			</div>
		</main>
	);
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<MobileApp />
	</React.StrictMode>,
);
