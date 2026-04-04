import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { loadPath, refreshFiles } from "./store/actions";
import { workspaceStore } from "./store/state";

export async function createNote() {
	const workspacePath = workspaceStore.get().workspacePath;
	if (!workspacePath) return;
	const picked = await save({
		defaultPath: workspacePath,
		title: "New Markdown file",
		filters: [{ name: "Markdown", extensions: ["md"] }],
	});
	if (typeof picked !== "string") return;
	const path = picked.endsWith(".md") ? picked : `${picked}.md`;
	await invoke("write_file_text", { path, content: "" });
	await refreshFiles();
	await loadPath(path);
}
