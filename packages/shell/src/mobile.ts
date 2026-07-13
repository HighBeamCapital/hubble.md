// Mobile (iOS) shell API implementation using Tauri
// This file is imported only on mobile platforms

import { isTauri } from "@tauri-apps/api/core";
import type {
	DirectoryListing,
	HtmlAppFileEntry,
	ShellApi,
	Unsubscribe,
	WatchOptions,
	WorkspaceConfig,
} from "./index";

let tauriInvoke:
	| ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>)
	| null = null;

async function invoke<T>(
	cmd: string,
	args?: Record<string, unknown>,
): Promise<T> {
	if (!tauriInvoke && isTauri()) {
		const { invoke: tauriInvokeImpl } = await import("@tauri-apps/api/core");
		tauriInvoke = tauriInvokeImpl;
	}
	if (tauriInvoke) {
		return tauriInvoke<T>(cmd, args);
	}
	throw new Error(`Tauri not available for ${cmd}`);
}

export function createMobileShellApi(): ShellApi {
	return {
		platform: "mobile-ios",
		homeDir: "/",

		async listDirectory(path: string): Promise<DirectoryListing> {
			return invoke("list_directory", { path });
		},

		async listHtmlAppFiles(
			workspacePath: string,
			glob: string,
		): Promise<HtmlAppFileEntry[]> {
			return invoke("list_html_app_files", { workspacePath, glob });
		},

		async readWorkspaceConfig(workspacePath: string): Promise<WorkspaceConfig> {
			const content = await invoke<string>("read_file", {
				path: `${workspacePath}/.hubble/config.json`,
			});
			try {
				return JSON.parse(content);
			} catch {
				return { version: 1, pinnedNotes: [] };
			}
		},

		async writeWorkspaceConfig(
			workspacePath: string,
			config: WorkspaceConfig,
		): Promise<void> {
			await invoke("write_file", {
				path: `${workspacePath}/.hubble/config.json`,
				content: JSON.stringify(config),
			});
		},

		async readFileText(path: string): Promise<string> {
			return invoke("read_file", { path });
		},

		async writeFileText(path: string, content: string): Promise<void> {
			await invoke("write_file", { path, content });
		},

		async createFolder(path: string): Promise<void> {
			await invoke("create_folder", { path });
		},

		async renameFile(fromPath: string, toPath: string): Promise<void> {
			await invoke("rename_file", { fromPath, toPath });
		},

		async pathExists(path: string): Promise<boolean> {
			return invoke("path_exists", { path });
		},

		async persistPastedImage(_input: {
			filePath: string;
			bytes: number[];
			mimeType: string | null;
		}): Promise<{ relativeMarkdownPath: string; deduped: boolean }> {
			// iOS: save to temp directory or workspace
			throw new Error("Not implemented - use iOS pasteboard API");
		},

		async deleteFile(
			path: string,
			options?: { recursive?: boolean },
		): Promise<void> {
			await invoke("delete_file", { path, options });
		},

		async readBinaryFile(path: string): Promise<number[]> {
			return invoke("read_binary_file", { path });
		},

		async writeBinaryFile(path: string, bytes: number[]): Promise<void> {
			await invoke("write_binary_file", { path, bytes });
		},

		async openFilePicker(_options?: {
			defaultPath?: string;
		}): Promise<string | null> {
			const { open } = await import("@tauri-apps/plugin-dialog");
			const result = await open({
				multiple: false,
				directory: false,
			});
			return (result as string) || null;
		},

		async openFolderPicker(): Promise<string | null> {
			const { open } = await import("@tauri-apps/plugin-dialog");
			const result = await open({
				multiple: false,
				directory: true,
			});
			return (result as string) || null;
		},

		async createFolderPicker(): Promise<string | null> {
			// iOS: create + show document picker with create mode
			throw new Error("iOS workflow differs - use Files app");
		},

		async saveMarkdownFilePicker(_options?: {
			defaultPath?: string;
		}): Promise<string | null> {
			const { save } = await import("@tauri-apps/plugin-dialog");
			const result = await save({
				filters: [{ name: "Markdown", extensions: ["md"] }],
			});
			return (result as string) || null;
		},

		async watchPath(
			_path: string,
			_options: WatchOptions,
			_callback: (paths: string[]) => void,
		): Promise<Unsubscribe> {
			// iOS: use file system events or polling
			// Terminal skipped per requirements
			return () => {};
		},

		async openExternalUrl(url: string): Promise<void> {
			const { open } = await import("@tauri-apps/plugin-shell");
			await open(url);
		},

		async openPathFromLink(
			_path: string,
		): Promise<{ kind: "markdown"; path: string } | { kind: "opened" }> {
			throw new Error("iOS: open in Files app preview");
		},

		async revealFile(_path: string): Promise<void> {
			// iOS: no native reveal; could open in Files app
			console.log("revealFile not available on iOS");
		},

		async resolvePath(path: string): Promise<string> {
			return invoke("resolve_path", { path });
		},

		async realPath(path: string): Promise<string> {
			return invoke("real_path", { path });
		},

		toAssetUrl(path: string): string {
			// iOS: use tauri asset protocol
			return `hubble-asset://localhost?path=${encodeURIComponent(path)}`;
		},

		async getLaunchFilePath(): Promise<string | null> {
			return invoke("get_launch_file_path");
		},

		async getLaunchWorkspacePath(): Promise<string | null> {
			return invoke("get_launch_workspace_path");
		},

		async setMenuState(_state: {
			hasWorkspace: boolean;
			hasMarkdownNoteOpen: boolean;
			isSourceMode: boolean;
		}): Promise<void> {
			// iOS: no menu bar, ignored
		},

		onOpenFile(_callback: (path: string) => void): Unsubscribe {
			// iOS: handle from app open URL events
			return () => {};
		},

		onWindowFocus(_callback: () => void): Unsubscribe {
			// iOS: handle app resume
			return () => {};
		},
	};
}
