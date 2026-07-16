import { Sidebar as SharedSidebar } from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import { tauriApi } from "../tauriApi";
import {
	createFolderInFolder,
	createMarkdownFileInFolder,
	deleteFolder,
	deleteMarkdownFile,
	renameFolder,
	renameMarkdownFile,
	setSidebarOpen,
	setSortMode,
} from "../store/actions";
import {
	currentPathStore,
	sidebarOpenStore,
	workspaceStore,
} from "../store/state";
import type { SortMode } from "../store/state";

type Props = {
	onSelectFile: (path: string) => void;
	onClose: () => void;
};

export function Sidebar({ onSelectFile, onClose }: Props) {
	const workspace = useStoreValue(workspaceStore);
	const sidebarOpen = useStoreValue(sidebarOpenStore);
	const currentPath = useStoreValue(currentPathStore);
	const { workspacePath, files, folders, sortMode } = workspace;

	if (!sidebarOpen) return null;
	if (!workspacePath) {
		return (
			<aside className="flex h-dvh w-64 flex-col border-e border-border bg-sidebar">
				<div className="flex items-center justify-between border-b border-border px-3 py-2">
					<p className="text-sm font-medium text-sidebar-foreground">No folder selected</p>
					<button
						type="button"
						onClick={onClose}
						className="rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent"
					>
						Close
					</button>
				</div>
				<div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-3 text-sm">
					<p className="text-sidebar-foreground/70">Open a folder to browse files.</p>
				</div>
			</aside>
		);
	}

	return (
		<aside className="flex h-dvh w-64 flex-col border-e border-border bg-sidebar">
			<div className="flex items-center justify-between border-b border-border px-3 py-2">
				<p className="truncate text-sm font-medium text-sidebar-foreground">
					{workspacePath.split("/").pop() ?? workspacePath}
				</p>
				<button
					type="button"
					onClick={onClose}
					className="rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent"
				>
					Close
				</button>
			</div>
			<div className="flex-1 overflow-y-auto">
				<SharedSidebar
					files={files.map((file) => ({
						path: file.path,
						modifiedAt: file.modified_at,
					}))}
					folders={folders.map((folder) => ({
						path: folder.path,
						modifiedAt: folder.modified_at,
					}))}
					currentPath={currentPath ?? null}
					sortMode={sortMode as SortMode}
					storageScope={workspacePath}
					onSortModeChange={setSortMode}
					onSelectFile={(path) => {
						onSelectFile(path);
						setSidebarOpen(false);
					}}
					onCreateMarkdownFile={() => createMarkdownFileInFolder(workspacePath)}
					onCreateFolder={() => createFolderInFolder(workspacePath)}
					onDeleteFile={deleteMarkdownFile}
					onDeleteFolder={deleteFolder}
					onRenameFile={renameMarkdownFile}
					onRenameFolder={renameFolder}
					emptyState={
						<p className="px-2.5 py-2 text-xs text-muted-foreground">
							No files yet. Use the + button to create one.
						</p>
					}
				/>
			</div>
		</aside>
	);
}
