import { invoke } from "@tauri-apps/api/core";

export type DirectoryEntry = { name: string; path: string; is_dir: boolean };
export type FolderAccess = { path: string; bookmark: string };

export const tauriApi = {
	async listDirectory(path: string): Promise<DirectoryEntry[]> {
		return invoke<DirectoryEntry[]>("list_directory", { path });
	},

	async pickFolder(): Promise<FolderAccess | null> {
		return invoke<FolderAccess | null>("pick_folder");
	},

	async resolveFolderBookmark(bookmark: string): Promise<FolderAccess> {
		return invoke<FolderAccess>("resolve_folder_bookmark", { bookmark });
	},

	async findMarkdownFile(
		root: string,
		fileName: string,
	): Promise<string | null> {
		return invoke<string | null>("find_markdown_file", { root, fileName });
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
