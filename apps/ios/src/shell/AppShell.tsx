import { withMarkdownExtension } from "@hubble.md/editor";
import { AppShellFrame } from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import { useRef, useState } from "react";
import {
	createMarkdownFileInFolder,
	forceKeepLocalEdits,
	loadPath,
	refreshFiles,
	reloadFromDiskConflict,
	savePathContent,
} from "../store/actions";
import { viewerStore, workspaceStore } from "../store/state";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { EditorView } from "./EditorView";

type Props = {
	onSelectFile: (path: string) => void;
};

export function AppShell({ onSelectFile }: Props) {
	const viewer = useStoreValue(viewerStore);
	const workspace = useStoreValue(workspaceStore);
	const [newNoteName, setNewNoteName] = useState<string | null>(null);
	const [newNoteSubmitted, setNewNoteSubmitted] = useState(false);
	const newNoteInputRef = useRef<HTMLInputElement>(null);
	const [sidebarOpen, setSidebarOpen] = useState(false);

	const newNotePath = normalizeNotePath(newNoteName ?? "");
	const newNoteConflict = workspace.files.some(
		(file) => file.path === newNotePath,
	);
	const showNewNoteConflict = newNoteSubmitted && newNoteConflict;

	const handleNewNote = () => {
		setNewNoteName("");
		setNewNoteSubmitted(false);
	};

	const submitNewNote = async (event: React.FormEvent) => {
		event.preventDefault();
		setNewNoteSubmitted(true);
		const name = (newNoteName ?? "").trim();
		if (!name) return;
		const path = normalizeNotePath(name);
		if (workspace.files.some((file) => file.path === path)) return;
		await savePathContent(path, "");
		setNewNoteName(null);
		setNewNoteSubmitted(false);
		await refreshFiles();
		onSelectFile(path);
	};

	return (
		<AppShellFrame
			sidebar={
				sidebarOpen ? (
					<Sidebar
						onSelectFile={(path) => {
							onSelectFile(path);
							setSidebarOpen(false);
						}}
						onClose={() => setSidebarOpen(false)}
					/>
				) : undefined
			}
			toolbar={
				<Toolbar onNewNote={handleNewNote} />
			}
		>
			{newNoteName !== null && (
				<form
					onSubmit={submitNewNote}
					className="border-b border-border bg-muted/40 px-3 py-2"
				>
					<div className="mx-auto flex max-w-3xl items-center gap-2">
						<input
							ref={newNoteInputRef}
							type="text"
							required
							value={newNoteName}
							onChange={(e) => setNewNoteName(e.target.value)}
							placeholder="note-name.md"
							aria-invalid={showNewNoteConflict}
							aria-describedby={
								showNewNoteConflict ? "new-note-conflict" : undefined
							}
							className="flex-1 rounded-sm border border-border bg-background px-2 py-1 text-sm outline-none focus:border-ring"
						/>
						<button
							type="submit"
							className="rounded-sm bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
						>
							Create
						</button>
						<button
							type="button"
							onClick={() => setNewNoteName(null)}
							className="rounded-sm px-3 py-1 text-xs text-muted-foreground hover:bg-sidebar-accent"
						>
							Cancel
						</button>
					</div>
					{showNewNoteConflict && (
						<p
							id="new-note-conflict"
							className="mx-auto mt-2 max-w-3xl text-sm text-destructive"
						>
							A file named {newNotePath} already exists.
						</p>
					)}
				</form>
			)}
			{viewer.currentPath && (
				<div className="flex h-full min-h-0 flex-col">
					{viewer.externalChange.kind === "conflict" && (
						<div className="border-b border-border bg-muted/40">
							<div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
								<p className="m-0 text-sm text-muted-foreground">
									File changed on disk. Reload to accept.
								</p>
								<button
									type="button"
									onClick={reloadFromDiskConflict}
									className="rounded-sm border border-border bg-background px-3 py-1 text-xs hover:bg-sidebar-accent"
								>
									Reload
								</button>
							</div>
						</div>
					)}
					<EditorView
						path={viewer.currentPath}
						initialMarkdown={viewer.content}
					/>
				</div>
			)}
			{!viewer.currentPath && viewer.status === "loading" && (
				<p className="p-6 text-sm text-muted-foreground">Loading…</p>
			)}
			{!viewer.currentPath && viewer.status === "error" && (
				<p className="p-6 text-sm text-destructive">{viewer.error}</p>
			)}
			{!viewer.currentPath &&
				viewer.status !== "loading" &&
				viewer.status !== "error" &&
				workspace.files.length > 0 && (
					<div className="flex h-full items-center justify-center p-6">
						<p className="text-sm text-muted-foreground">
							Select a file, or create a new one with +.
						</p>
					</div>
				)}
			{!viewer.currentPath &&
				viewer.status !== "loading" &&
				viewer.status !== "error" &&
				workspace.files.length === 0 && (
					<div className="flex h-full items-center justify-center p-6">
						<p className="text-sm text-muted-foreground">
							No files in this folder. Use the + button to create one.
						</p>
					</div>
				)}
		</AppShellFrame>
	);
}

function normalizeNotePath(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) return "";
	return withMarkdownExtension(trimmed);
}
