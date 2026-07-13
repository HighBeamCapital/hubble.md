// Mobile (iOS) shell API implementation using Tauri
import type { ShellApi, DirectoryListing, WorkspaceConfig, HtmlAppFileEntry, WatchOptions, Unsubscribe } from "./index";

export function createMobileShellApi(): ShellApi {
    return {
        platform: "mobile-ios",
        homeDir: "/", // iOS doesn't expose home dir
        
        async listDirectory(path: string): Promise<DirectoryListing> {
            // Tauri invoke - implemented in Rust
            return invokeTauri("list_directory", { path });
        },
        
        async listHtmlAppFiles(workspacePath: string, glob: string): Promise<HtmlAppFileEntry[]> {
            return invokeTauri("list_html_app_files", { workspacePath, glob });
        },
        
        async readWorkspaceConfig(workspacePath: string): Promise<WorkspaceConfig> {
            return invokeTauri("read_workspace_config", { workspacePath });
        },
        
        async writeWorkspaceConfig(workspacePath: string, config: WorkspaceConfig): Promise<void> {
            return invokeTauri("write_workspace_config", { workspacePath, config });
        },
        
        async readFileText(path: string): Promise<string> {
            return invokeTauri("read_file_text", { path });
        },
        
        async writeFileText(path: string, content: string): Promise<void> {
            return invokeTauri("write_file_text", { path, content });
        },
        
        async createFolder(path: string): Promise<void> {
            return invokeTauri("create_folder", { path });
        },
        
        async renameFile(fromPath: string, toPath: string): Promise<void> {
            return invokeTauri("rename_file", { fromPath, toPath });
        },
        
        async pathExists(path: string): Promise<boolean> {
            return invokeTauri("path_exists", { path });
        },
        
        async persistPastedImage(_input: { filePath: string; bytes: number[]; mimeType: string | null }): Promise<{ relativeMarkdownPath: string; deduped: boolean }> {
            throw new Error("Not implemented - iOS image handling differs");
        },
        
        async deleteFile(path: string, options?: { recursive?: boolean }): Promise<void> {
            return invokeTauri("delete_file", { path, options });
        },
        
        async readBinaryFile(path: string): Promise<number[]> {
            return invokeTauri("read_binary_file", { path });
        },
        
        async writeBinaryFile(path: string, bytes: number[]): Promise<void> {
            return invokeTauri("write_binary_file", { path, bytes });
        },
        
        async openFilePicker(_options?: { defaultPath?: string }): Promise<string | null> {
            // iOS document picker via tauri-plugin-dialog
            return invokeTauri("open_file_picker", { options });
        },
        
        async openFolderPicker(): Promise<string | null> {
            // iOS folder picker
            return invokeTauri("open_folder_picker");
        },
        
        async createFolderPicker(): Promise<string | null> {
            // iOS: create folder then grant access
            return invokeTauri("create_folder_picker");
        },
        
        async saveMarkdownFilePicker(_options?: { defaultPath?: string }): Promise<string | null> {
            return invokeTauri("save_markdown_file_picker", { options });
        },
        
        async watchPath(_path: string, _options: WatchOptions, _callback: (paths: string[]) => void): Promise<Unsubscribe> {
            // iOS: optional - use polling or file system events
            return () => {};
        },
        
        async openExternalUrl(url: string): Promise<void> {
            return invokeTauri("open_external_url", { url });
        },
        
        async openPathFromLink(path: string): Promise<{ kind: "markdown"; path: string } | { kind: "opened" }> {
            return invokeTauri("open_path_from_link", { path });
        },
        
        async revealFile(_path: string): Promise<void> {
            // iOS: would open in Files app
            console.log("revealFile not available on iOS");
        },
        
        async resolvePath(path: string): Promise<string> {
            return invokeTauri("resolve_path", { path });
        },
        
        async realPath(path: string): Promise<string> {
            return invokeTauri("real_path", { path });
        },
        
        toAssetUrl(path: string): string {
            // iOS: use Tauri asset protocol
            return `tauri-asset://localhost?path=${encodeURIComponent(path)}`;
        },
        
        async getLaunchFilePath(): Promise<string | null> {
            return invokeTauri("get_launch_file_path");
        },
        
        async getLaunchWorkspacePath(): Promise<string | null> {
            return invokeTauri("get_launch_workspace_path");
        },
        
        async setMenuState(_state: MenuState): Promise<void> {
            // iOS: no menu bar, ignored
        },
        
        onOpenFile(_callback: (path: string) => void): Unsubscribe {
            return () => {};
        },
        
        onWindowFocus(_callback: () => void): Unsubscribe {
            return () => {};
        },
    };
}

// Placeholder - would import from @tauri-apps/api/core in actual implementation
async function invokeTauri<T>(command: string, args: Record<string, unknown>): Promise<T> {
    // This is a stub - real implementation imports invoke from Tauri
    throw new Error(`Tauri not available: ${command}`);
}
