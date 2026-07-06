import { wikiDisplayNameForTarget } from "@hubble.md/editor";
import {
	Button,
	classifyHref,
	EditorView,
	Input,
	MarkdownSourceEditor,
	type WikiTarget,
} from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import { keymatch } from "keymatch";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import MingcutePencilLine from "~icons/mingcute/pencil-line";
import { HtmlAppEmptyState } from "./components/HtmlAppEmptyState";
import { SettingsDialog, SettingsSection } from "./components/SettingsDialog";
import { Sidebar } from "./components/Sidebar";
import { TerminalPanel } from "./components/TerminalPanel";
import { Toolbar } from "./components/Toolbar";
import {
	SidebarUpdateCallout,
	UpdatesSection,
} from "./components/UpdatesSection";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { desktopApi } from "./desktopApi";
import type { DesktopUpdateState } from "./desktopApi/types";
import { createEmbedExtension } from "./editor/EmbedExtension";
import { handleImageDrop, handleImagePaste } from "./editor/handleImagePaste";
import { IframeView, toAssetUrl } from "./editor/IframeView";
import { createImageExtension } from "./editor/ImageExtension";
import { createHtmlFile, createMarkdownFile } from "./fileActions";
import { copyText } from "./lib/clipboard";
import {
	hasHtmlExtension,
	hasMarkdownExtension,
	relativeWorkspacePath,
} from "./lib/filePath";
import { resolveRelativeLinkPath } from "./lib/relativeLinkPath";
import { resolveWikiPath } from "./lib/wikiPath";
import { SIDEBAR_NAV_SELECTOR } from "./selectors";
import {
	createWorkspaceWithSidebar,
	forceKeepLocalEdits,
	getPendingRenameTarget,
	handleExternalFileChange,
	loadPath,
	openWorkspace,
	openWorkspaceWithSidebar,
	refreshFiles,
	refreshFilesDebounced,
	reloadFromDiskConflict,
	requestChatAboutNote,
	savePathContent,
	setChatCommand,
	setSidebarOpen,
	setViewerMode,
	setWorkspaceSwitcherOpen,
	toggleTerminal,
	updateEditorContent,
} from "./store/actions";
import {
	chatCommandStore,
	sidebarOpenStore,
	uiStore,
	type ViewMode,
	viewerStore,
	workspacePathStore,
	workspaceStore,
} from "./store/state";

// Forces editor refresh when underlying TipTap extensions change
const HMR_REV = (() => {
	if (!import.meta.hot) return 0;
	const hotData = import.meta.hot.data as { __editorRev?: number };
	hotData.__editorRev = (hotData.__editorRev ?? 0) + 1;
	return hotData.__editorRev;
})();

function focusSidebarNav() {
	document.querySelector<HTMLElement>(SIDEBAR_NAV_SELECTOR)?.focus();
}

async function copyFilePath(path: string | null) {
	if (!path) return;
	await copyText(path, "File path");
}

async function revealPath(path: string | null) {
	if (!path) return;

	try {
		await desktopApi.revealFile(path);
	} catch {
		toast.error("Failed to reveal file");
	}
}

function App() {
	const state = useStoreValue(viewerStore);
	const workspacePath = useStoreValue(workspacePathStore);
	const sidebarOpen = useStoreValue(sidebarOpenStore);
	const hasWorkspace = workspacePath !== null;
	const [scrollContainerEl, setScrollContainerEl] =
		useState<HTMLDivElement | null>(null);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [copyAsMarkdownRequest, setCopyAsMarkdownRequest] = useState(0);
	const [updateState, setUpdateState] = useState<DesktopUpdateState | null>(
		null,
	);
	const [focusedSidebarPath, setFocusedSidebarPath] = useState<string | null>(
		null,
	);
	const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

	const readyVersion =
		updateState?.status === "ready"
			? (updateState.availableVersion ?? "__unknown__")
			: null;
	const showUpdateCallout = readyVersion !== dismissedVersion;

	const openSettings = useCallback(() => {
		setSettingsOpen(true);
	}, []);

	const installUpdate = useCallback(async () => {
		try {
			await desktopApi.installUpdate();
		} catch (error) {
			toast.error("Failed to install update", {
				description: error instanceof Error ? error.message : String(error),
			});
		}
	}, []);

	const triggerPrimaryUpdateAction = useCallback(async () => {
		if (!updateState?.isSupported) return;
		if (updateState.status === "ready") {
			await installUpdate();
			return;
		}
		await desktopApi.checkForUpdates();
	}, [installUpdate, updateState]);

	useEffect(() => {
		const currentPath = state.currentPath;
		if (!currentPath) return;

		let disposed = false;
		let unwatch: null | (() => void) = null;

		const handleChange = async (paths: string[]) => {
			if (!paths.includes(currentPath)) return;
			if (getPendingRenameTarget(currentPath)) return;
			try {
				const nextContent = await desktopApi.readFileText(currentPath);
				if (viewerStore.get().currentPath !== currentPath) return;
				handleExternalFileChange(currentPath, nextContent);
			} catch {
				if (viewerStore.get().currentPath !== currentPath) return;
				await loadPath(currentPath);
			}
		};

		const setup = async () => {
			unwatch = await desktopApi.watchPath(
				currentPath,
				{ recursive: false },
				(paths) => void handleChange(paths),
			);
			if (disposed && unwatch) {
				unwatch();
			}
		};

		void setup();
		return () => {
			disposed = true;
			if (unwatch) {
				unwatch();
			}
		};
	}, [state.currentPath]);

	const openFilePicker = useCallback(async () => {
		const defaultPath =
			viewerStore.get().currentPath ??
			workspaceStore.get().workspacePath ??
			undefined;
		const selected = await desktopApi.openFilePicker({ defaultPath });
		if (typeof selected === "string") {
			await loadPath(selected);
		}
	}, []);

	useEffect(() => {
		const currentPath = state.currentPath;
		void desktopApi.setMenuState({
			hasWorkspace,
			hasMarkdownNoteOpen:
				typeof currentPath === "string" && hasMarkdownExtension(currentPath),
			isSourceMode: state.viewMode === "source",
		});
	}, [hasWorkspace, state.currentPath, state.viewMode]);

	useEffect(() => {
		if (!sidebarOpen) setFocusedSidebarPath(null);
	}, [sidebarOpen]);

	useEffect(() => {
		const onKeyDown = async (event: KeyboardEvent) => {
			if (keymatch(event, "CmdOrCtrl+N")) {
				event.preventDefault();
				await createMarkdownFile();
			} else if (keymatch(event, "CmdOrCtrl+,")) {
				event.preventDefault();
				openSettings();
			} else if (keymatch(event, "CmdOrCtrl+Shift+O")) {
				if (!workspaceStore.get().workspacePath) return;
				event.preventDefault();
				setWorkspaceSwitcherOpen(true);
			} else if (keymatch(event, "CmdOrCtrl+Shift+N")) {
				event.preventDefault();
				await openWorkspaceWithSidebar();
			} else if (keymatch(event, "CmdOrCtrl+O")) {
				event.preventDefault();
				await openFilePicker();
			} else if (keymatch(event, "CmdOrCtrl+Shift+C")) {
				const path = focusedSidebarPath ?? viewerStore.get().currentPath;
				if (!path) return;
				event.preventDefault();
				await copyFilePath(path);
			} else if (keymatch(event, "CmdOrCtrl+Alt+R")) {
				const path = focusedSidebarPath ?? viewerStore.get().currentPath;
				if (!path) return;
				event.preventDefault();
				await revealPath(path);
			} else if (keymatch(event, "CmdOrCtrl+Shift+J")) {
				if (
					!viewerStore.get().currentPath ||
					!workspaceStore.get().workspacePath
				)
					return;
				event.preventDefault();
				requestChatAboutNote();
			} else if (keymatch(event, "CmdOrCtrl+Shift+E")) {
				event.preventDefault();
				const opening = !uiStore.get().sidebarOpen;
				setSidebarOpen(opening);
				if (opening) {
					requestAnimationFrame(() => focusSidebarNav());
				}
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [focusedSidebarPath, openFilePicker, openSettings]);

	useEffect(() => {
		let active = true;
		void desktopApi.getUpdateState().then((nextState) => {
			if (active) setUpdateState(nextState);
		});
		const unsubscribe = desktopApi.onUpdateStateChange((nextState) => {
			setUpdateState(nextState);
		});
		return () => {
			active = false;
			unsubscribe();
		};
	}, []);

	useEffect(() => {
		const unlisten = desktopApi.onOpenFile((path) => {
			void loadPath(path);
		});
		return () => {
			unlisten();
		};
	}, []);

	useEffect(() => {
		const disposers = [
			desktopApi.onMenuCreateMarkdownFile(() => void createMarkdownFile()),
			desktopApi.onMenuCreateHtmlFile(() => void createHtmlFile()),
			desktopApi.onMenuOpenFile(() => void openFilePicker()),
			desktopApi.onMenuOpenFolder(() => void openWorkspaceWithSidebar()),
			desktopApi.onMenuOpenSettings(() => openSettings()),
			desktopApi.onMenuCopyAsMarkdown(() =>
				setCopyAsMarkdownRequest((request) => request + 1),
			),
			desktopApi.onMenuShowWorkspaceSwitcher(() =>
				setWorkspaceSwitcherOpen(true),
			),
			desktopApi.onMenuSyncWorkspace(() => void refreshFiles()),
			desktopApi.onMenuToggleTerminal(() => toggleTerminal()),
			desktopApi.onMenuToggleSourceMode(() => {
				const current = viewerStore.get();
				if (
					!current.currentPath ||
					!hasMarkdownExtension(current.currentPath)
				) {
					return;
				}
				setViewerMode(current.viewMode === "source" ? "rich" : "source");
			}),
		];
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, [openFilePicker, openSettings]);

	useEffect(() => {
		// Window focus can fire in bursts when switching apps, so debounce the
		// sidebar refresh and keep the editor interactive while it runs.
		const dispose = desktopApi.onWindowFocus(() => refreshFilesDebounced());
		return () => {
			dispose();
		};
	}, []);

	useEffect(() => {
		let active = true;
		const init = async () => {
			const launchPath = await desktopApi.getLaunchFilePath();
			if (!active) return;

			if (typeof launchPath === "string" && launchPath.length > 0) {
				await loadPath(launchPath);
				return;
			}
			const launchWorkspacePath = await desktopApi.getLaunchWorkspacePath();
			if (!active) return;

			if (
				typeof launchWorkspacePath === "string" &&
				launchWorkspacePath.length > 0
			) {
				await openWorkspace(launchWorkspacePath);
				setSidebarOpen(true);
				return;
			}
			const nextState = viewerStore.get();
			const workspace = workspaceStore.get();
			const lastPath =
				nextState.lastOpenedPath ??
				(workspace.workspacePath
					? workspace.lastOpenedPaths[workspace.workspacePath]
					: undefined);
			if (lastPath) {
				await loadPath(lastPath);
			}
		};
		void init();
		return () => {
			active = false;
		};
	}, []);

	return (
		<main className="flex h-dvh flex-col bg-background text-foreground">
			<Toolbar
				scrollContainer={scrollContainerEl}
				showSidebarBadge={!sidebarOpen && showUpdateCallout}
			/>
			<div className="flex min-h-0 flex-1 overflow-hidden">
				<Sidebar
					onFocusedPathChange={setFocusedSidebarPath}
					footer={
						updateState?.status === "ready" && showUpdateCallout ? (
							<SidebarUpdateCallout
								onInstall={installUpdate}
								onDismiss={() =>
									setDismissedVersion(readyVersion ?? "__unknown__")
								}
							/>
						) : undefined
					}
				/>
				<section
					className="flex-1 flex flex-col overflow-hidden"
					aria-live="polite"
				>
					<div className="flex-1 min-h-0 relative">
						{state.status === "loading" && <p>Loading…</p>}
						{state.status === "error" && (
							<p>{state.error ?? "Failed to open file."}</p>
						)}
						{state.status !== "loading" &&
							state.status !== "error" &&
							!state.currentPath && (
								<div className="flex h-full items-center justify-center p-6">
									{hasWorkspace ? (
										<Button onClick={() => void openFilePicker()}>
											Open file
										</Button>
									) : (
										<WelcomeScreen
											onCreateFolder={() => void createWorkspaceWithSidebar()}
											onOpenFolder={() => void openWorkspaceWithSidebar()}
										/>
									)}
								</div>
							)}
						{state.status === "ready" && state.currentPath && (
							<div className="flex h-full min-h-0 flex-col">
								{state.externalChange.kind === "conflict" && (
									<ExternalChangeBanner
										onKeepMyEdits={() => void forceKeepLocalEdits()}
										onReloadFromDisk={reloadFromDiskConflict}
									/>
								)}
								<DocumentViewer
									path={state.currentPath}
									content={state.content}
									copyAsMarkdownRequest={copyAsMarkdownRequest}
									viewMode={state.viewMode}
									onScrollContainerChange={setScrollContainerEl}
								/>
							</div>
						)}
					</div>
					<TerminalPanel />
				</section>
			</div>
			<SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen}>
				<ChatAboutNoteSettingsSection />
				{updateState ? (
					<UpdatesSection
						state={updateState}
						onPrimaryAction={() => void triggerPrimaryUpdateAction()}
					/>
				) : null}
			</SettingsDialog>
		</main>
	);
}

function ChatAboutNoteSettingsSection() {
	const [draft, setDraft] = useState(() => chatCommandStore.get());

	return (
		<SettingsSection
			title="Chat about this note"
			description={`This command runs in a new terminal when you pick "Chat about this note" from a note's ⋯ menu. The shell replaces $HUBBLE_NOTE_PATH with the current note's file path.`}
		>
			<div className="relative">
				<Input
					className="font-mono pe-8"
					spellCheck={false}
					value={draft}
					onChange={(event) => {
						setDraft(event.currentTarget.value);
						setChatCommand(event.currentTarget.value);
					}}
				/>
				<MingcutePencilLine className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
			</div>
		</SettingsSection>
	);
}

function DocumentViewer({
	path,
	content,
	copyAsMarkdownRequest,
	viewMode,
	onScrollContainerChange,
}: {
	path: string;
	content: string;
	copyAsMarkdownRequest: number;
	viewMode: ViewMode;
	onScrollContainerChange?: (el: HTMLDivElement | null) => void;
}) {
	if (hasHtmlExtension(path)) {
		return (
			<HtmlDocumentViewer
				// Remount on content change so the iframe reloads the updated file
				// from disk and a stale load error clears.
				key={`${path}:${content}`}
				path={path}
				content={content}
				onScrollContainerChange={onScrollContainerChange}
			/>
		);
	}

	return (
		<>
			{viewMode === "source" ? (
				<MarkdownSourceEditor
					key={`${path}:source:${HMR_REV}`}
					path={path}
					initialMarkdown={content}
					onLocalChange={updateEditorContent}
					onSave={savePathContent}
					onScrollContainerChange={onScrollContainerChange}
				/>
			) : (
				<MarkdownEditor
					key={`${path}:rich:${HMR_REV}`}
					path={path}
					initialMarkdown={content}
					copyAsMarkdownRequest={copyAsMarkdownRequest}
					onScrollContainerChange={onScrollContainerChange}
				/>
			)}
		</>
	);
}

function HtmlDocumentViewer({
	path,
	content,
	onScrollContainerChange,
}: {
	path: string;
	content: string;
	onScrollContainerChange?: (el: HTMLDivElement | null) => void;
}) {
	const workspace = useStoreValue(workspaceStore);
	const [error, setError] = useState<string | null>(null);
	const isEmpty = content.trim().length === 0;

	useEffect(() => {
		onScrollContainerChange?.(null);
	}, [onScrollContainerChange]);

	// The open file's content updates live as the agent writes to disk, so swap
	// between the teaching empty state and the rendered app without reopening.
	if (isEmpty) {
		return (
			<HtmlAppEmptyState path={path} workspacePath={workspace.workspacePath} />
		);
	}

	return (
		<div className="flex h-full min-h-0 flex-1 overflow-hidden bg-background">
			{error ? (
				<p className="m-0 p-4 text-sm text-destructive">{error}</p>
			) : (
				<IframeView
					className="block min-h-0 flex-1 border-0 bg-card"
					onError={setError}
					src={toAssetUrl(path)}
					style={{ blockSize: "100%", inlineSize: "100%" }}
					title={relativeWorkspacePath(path, workspace.workspacePath)}
					workspacePath={workspace.workspacePath}
				/>
			)}
		</div>
	);
}

function ExternalChangeBanner({
	onReloadFromDisk,
	onKeepMyEdits,
}: {
	onReloadFromDisk: () => void;
	onKeepMyEdits: () => void;
}) {
	return (
		<div className="border-b border-border bg-muted/40">
			<div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
				<p className="m-0 text-sm text-muted-foreground">
					File changed on disk. Reload it or keep your editor edits.
				</p>
				<div className="flex shrink-0 items-center gap-2">
					<Button size="sm" variant="outline" onClick={onReloadFromDisk}>
						Reload from disk
					</Button>
					<Button size="sm" onClick={onKeepMyEdits}>
						Keep my edits
					</Button>
				</div>
			</div>
		</div>
	);
}

function MarkdownEditor({
	path,
	initialMarkdown,
	copyAsMarkdownRequest,
	onScrollContainerChange,
}: {
	path: string;
	initialMarkdown: string;
	copyAsMarkdownRequest: number;
	onScrollContainerChange?: (el: HTMLDivElement | null) => void;
}) {
	const workspace = useStoreValue(workspaceStore);
	const wikiTargets: WikiTarget[] = workspace.files.map((file) => {
		const target = relativeWorkspacePath(file.path, workspace.workspacePath);
		return {
			path: file.path,
			target,
			title: wikiDisplayNameForTarget(target),
		};
	});
	const openExternalLink = useCallback(
		async (href: string) => {
			if (classifyHref(href) === "external") {
				await desktopApi.openExternalUrl(href);
				return;
			}
			const resolved = resolveRelativeLinkPath({
				href,
				currentFilePath: path,
				workspacePath: workspace.workspacePath,
			});
			try {
				const result = await desktopApi.openPathFromLink(resolved);
				if (result.kind === "markdown") await loadPath(result.path);
			} catch (error) {
				if (
					error instanceof Error &&
					error.message.includes("Open cancelled")
				) {
					return;
				}
				if (
					hasMarkdownExtension(resolved) &&
					error instanceof Error &&
					error.message.includes("FILE_NOT_FOUND")
				) {
					toast.error(`File not found: ${href.split("#", 1)[0] ?? href}`);
					return;
				}
				throw error;
			}
		},
		[path, workspace.workspacePath],
	);
	return (
		<EditorView
			path={path}
			initialMarkdown={initialMarkdown}
			wikiTargets={wikiTargets}
			extensions={[
				createImageExtension(path),
				createEmbedExtension({
					workspacePath: workspace.workspacePath,
					filePath: path,
				}),
			]}
			onPaste={(editor, event) => handleImagePaste({ editor, event })}
			onDrop={(editor, event) => handleImageDrop({ editor, event })}
			onLocalChange={updateEditorContent}
			onSave={savePathContent}
			onScrollContainerChange={onScrollContainerChange}
			copyAsMarkdownRequest={copyAsMarkdownRequest}
			onOpenExternalLink={openExternalLink}
			onOpenWikiLink={(target) =>
				void loadPath(
					resolveWikiPath({
						target,
						files: workspace.files,
						workspacePath: workspace.workspacePath,
					}),
				)
			}
			onMessage={(message, kind) =>
				kind === "success" ? toast.success(message) : toast.error(message)
			}
		/>
	);
}

export default App;
