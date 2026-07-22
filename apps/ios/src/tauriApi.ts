import { invoke } from "@tauri-apps/api/core";

export type FileEntry = { path: string; modified_at: number };
export type FolderEntry = FileEntry;
export type DirectoryListing = { files: FileEntry[]; folders: FolderEntry[] };

export const tauriApi = {
	async listDirectory(path: string): Promise<DirectoryListing> {
		const result = await invoke<{
			entries: Array<{ name: string; path: string; is_dir: boolean }>;
		}>("list_directory", { path });
		const now = Date.now();
		const files: FileEntry[] = [];
		const folders: FolderEntry[] = [];
		for (const entry of result.entries) {
			const item = { path: entry.path, modified_at: now };
			if (entry.is_dir) {
				folders.push(item);
			} else {
				files.push(item);
			}
		}
		return { files, folders };
	},

	async readFileText(path: string): Promise<string> {
		return invoke<string>("read_file", { path });
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
		return invoke<boolean>("path_exists", { path });
	},

	async deleteFile(
		path: string,
		options?: { recursive?: boolean },
	): Promise<void> {
		await invoke("delete_file", { path, options: options ?? null });
	},

	async readBinaryFile(path: string): Promise<number[]> {
		return invoke<number[]>("read_binary_file", { path });
	},

	async writeBinaryFile(path: string, bytes: number[]): Promise<void> {
		await invoke("write_binary_file", { path, bytes });
	},

	async resolvePath(path: string): Promise<string> {
		return invoke<string>("resolve_path", { path });
	},

	async getLaunchFilePath(): Promise<string | null> {
		return invoke<string | null>("get_launch_file_path");
	},

	async getLaunchWorkspacePath(): Promise<string | null> {
		return invoke<string | null>("get_launch_workspace_path");
	},

	async openFilePicker(): Promise<string | null> {
		const { open } = await import("@tauri-apps/plugin-dialog");
		const result = await open({
			multiple: false,
			directory: false,
			fileAccessMode: "scoped",
			filters: [{ name: "Markdown", extensions: ["md", "txt"] }],
		});
		if (!result) return null;
		let path: string | null = null;
		if (Array.isArray(result)) {
			path = result[0] ?? null;
		} else if (typeof result === "string") {
			path = result;
		} else if ("path" in result && typeof result.path === "string") {
			path = result.path;
		}
		if (path?.startsWith("file://")) {
			path = decodeURIComponent(path.slice(7));
		}
		return path;
	},

	async pickFile(): Promise<{ path: string } | null> {
		return invoke<{ path: string } | null>("pick_file");
	},

	async startScopedAccess(path: string): Promise<void> {
		await invoke("start_scoped_access", { path });
	},

	async stopScopedAccess(path: string): Promise<void> {
		await invoke("stop_scoped_access", { path });
	},

	async openExternalUrl(url: string): Promise<void> {
		const { open } = await import("@tauri-apps/plugin-shell");
		await open(url);
	},
};
