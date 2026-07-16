// Stubbed tauriApi for iOS - commands not yet implemented

export type FileEntry = { path: string; modified_at: number };
export type FolderEntry = FileEntry;
export type DirectoryListing = { files: FileEntry[]; folders: FolderEntry[] };

export const tauriApi = {
	async listDirectory(_path: string): Promise<DirectoryListing> {
		return { files: [], folders: [] };
	},
	async readFileText(_path: string): Promise<string> {
		return "";
	},
	async writeFileText(_path: string, _content: string): Promise<void> {},
	async createFolder(_path: string): Promise<void> {},
	async renameFile(_fromPath: string, _toPath: string): Promise<void> {},
	async pathExists(_path: string): Promise<boolean> {
		return false;
	},
	async deleteFile(_path: string): Promise<void> {},
	async readBinaryFile(_path: string): Promise<number[]> {
		return [];
	},
	async writeBinaryFile(_path: string, _bytes: number[]): Promise<void> {},
	async resolvePath(path: string): Promise<string> {
		return path;
	},
	async realPath(path: string): Promise<string> {
		return path;
	},
	async getLaunchFilePath(): Promise<string | null> {
		return null;
	},
	async getLaunchWorkspacePath(): Promise<string | null> {
		return null;
	},
	async openFolderPicker(): Promise<string | null> {
		return null;
	},
	async openExternalUrl(_url: string): Promise<void> {},
};
