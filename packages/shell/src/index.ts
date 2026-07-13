/**
 * Shell API types shared between desktop (Electron) and mobile (Tauri) platforms
 */

export type FileEntry = {
	path: string;
	modified_at: number;
};

export type FolderEntry = FileEntry;

export type DirectoryListing = {
	files: FileEntry[];
	folders: FolderEntry[];
};

export type HtmlAppFileEntry = {
	name: string;
	path: string;
	modified_at: number;
	size: number;
};

export type PersistPastedImageInput = {
	filePath: string;
	bytes: number[];
	mimeType: string | null;
};

export type PersistPastedImageOutput = {
	relativeMarkdownPath: string;
	deduped: boolean;
};

export type OpenPathFromLinkResult =
	| { kind: "markdown"; path: string }
	| { kind: "opened" };

export type WatchOptions = {
	recursive: boolean;
};

export type Unsubscribe = () => void;

export type MenuState = {
	hasWorkspace: boolean;
	hasMarkdownNoteOpen: boolean;
	isSourceMode: boolean;
};

export type UpdateStatus =
	| "idle"
	| "checking"
	| "up-to-date"
	| "downloading"
	| "ready"
	| "error";

export type UpdateState = {
	isSupported: boolean;
	status: UpdateStatus;
	currentVersion: string;
	availableVersion: string | null;
	progressPercent: number | null;
	message: string | null;
	lastCheckedAt: number | null;
};

export type WorkspaceConfig = {
	version: 1;
	pinnedNotes: string[];
};

/**
 * Platform-agnostic shell API for OS interactions
 */
export type ShellApi = {
	// Platform info
	platform: "desktop" | "mobile-ios";
	homeDir: string;

	// File operations
	listDirectory(path: string): Promise<DirectoryListing>;
	listHtmlAppFiles(
		workspacePath: string,
		glob: string,
	): Promise<HtmlAppFileEntry[]>;
	readWorkspaceConfig(workspacePath: string): Promise<WorkspaceConfig>;
	writeWorkspaceConfig(
		workspacePath: string,
		config: WorkspaceConfig,
	): Promise<void>;
	readFileText(path: string): Promise<string>;
	writeFileText(path: string, content: string): Promise<void>;
	createFolder(path: string): Promise<void>;
	renameFile(fromPath: string, toPath: string): Promise<void>;
	pathExists(path: string): Promise<boolean>;
	persistPastedImage(
		input: PersistPastedImageInput,
	): Promise<PersistPastedImageOutput>;
	deleteFile(path: string, options?: { recursive?: boolean }): Promise<void>;
	readBinaryFile(path: string): Promise<number[]>;
	writeBinaryFile(path: string, bytes: number[]): Promise<void>;

	// Pickers
	openFilePicker(options?: { defaultPath?: string }): Promise<string | null>;
	openFolderPicker(): Promise<string | null>;
	createFolderPicker(): Promise<string | null>;
	saveMarkdownFilePicker(options?: {
		defaultPath?: string;
	}): Promise<string | null>;

	// Watching (optional on mobile)
	watchPath(
		path: string,
		options: WatchOptions,
		callback: (paths: string[]) => void,
	): Promise<Unsubscribe>;

	// External actions
	openExternalUrl(url: string): Promise<void>;
	openPathFromLink(path: string): Promise<OpenPathFromLinkResult>;
	revealFile(path: string): Promise<void>;
	resolvePath(path: string): Promise<string>;
	realPath(path: string): Promise<string>;
	toAssetUrl(path: string): string;

	// Launch handling
	getLaunchFilePath(): Promise<string | null>;
	getLaunchWorkspacePath(): Promise<string | null>;

	// UI
	setMenuState(state: MenuState): Promise<void>;

	// Events
	onOpenFile(callback: (path: string) => void): Unsubscribe;
	onWindowFocus(callback: () => void): Unsubscribe;

	// Terminal - only on desktop
	terminalStart?(
		cwd: string,
		options?: { notePath?: string; initialCommand?: string },
	): Promise<string>;
	terminalWrite?(sessionId: string, data: string): Promise<void>;
	terminalResize?(sessionId: string, cols: number, rows: number): Promise<void>;
	terminalStop?(sessionId: string): Promise<void>;
	onTerminalData?(
		sessionId: string,
		callback: (data: string) => void,
	): Unsubscribe;
	onTerminalExit?(sessionId: string, callback: () => void): Unsubscribe;

	// Updates - only on desktop (App Store on iOS)
	checkForUpdates?(): Promise<void>;
	getUpdateState?(): Promise<UpdateState>;
	installUpdate?(): Promise<void>;
	onUpdateStateChange?(callback: (state: UpdateState) => void): Unsubscribe;
	onMenuCreateMarkdownFile?(callback: () => void): Unsubscribe;
	onMenuCreateHtmlFile?(callback: () => void): Unsubscribe;
	onMenuOpenFile?(callback: () => void): Unsubscribe;
	onMenuOpenFolder?(callback: () => void): Unsubscribe;
	onMenuOpenSettings?(callback: () => void): Unsubscribe;
	onMenuCopyAsMarkdown?(callback: () => void): Unsubscribe;
	onMenuShowWorkspaceSwitcher?(callback: () => void): Unsubscribe;
	onMenuSyncWorkspace?(callback: () => void): Unsubscribe;
	onMenuToggleTerminal?(callback: () => void): Unsubscribe;
	onMenuToggleSourceMode?(callback: () => void): Unsubscribe;
	onFullScreenChange?(callback: (isFullScreen: boolean) => void): Unsubscribe;
};
