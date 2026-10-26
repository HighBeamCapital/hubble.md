import { classifyHref, EditorView, MarkdownSourceEditor } from "@hubble.md/ui";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderBrowser } from "./FolderBrowser";
import {
	basename,
	dirname,
	hasMarkdownExtension,
	withMarkdownExtension,
} from "./lib/filePath";
import {
	isInFolder,
	loadSavedBookmark,
	resolveRelativeLink,
	saveBookmark,
	wikiLinkCandidates,
} from "./lib/folder";
import { tauriApi } from "./tauriApi";

type EditorMode = "rich" | "source";
type Message = { text: string; type: "success" | "error" };

const MESSAGE_MS = 2500;
const PICK_FILE_ATTEMPTS = 5;
const PICK_FILE_RETRY_MS = 200;
const OPEN_FOLDER_FOR_LINKS = "Open this note's folder to follow its links";

const btn =
	"rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground active:scale-95 active:opacity-70 transition";

function pathFromOpenedUrl(url: string): string {
	return url.startsWith("file://") ? decodeURIComponent(url.slice(7)) : url;
}

function errorText(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function App() {
	const [launching, setLaunching] = useState(true);
	const [folder, setFolder] = useState<string | null>(null);
	const [dir, setDir] = useState<string | null>(null);
	const [filePath, setFilePath] = useState<string | null>(null);
	const [openingPath, setOpeningPath] = useState<string | null>(null);
	const [initialMarkdown, setInitialMarkdown] = useState("");
	const [mode, setMode] = useState<EditorMode>("rich");
	const [message, setMessage] = useState<Message | null>(null);
	const folderRef = useRef<string | null>(null);
	// The file being edited. Saves for any other path are dropped, since iOS
	// rejects writes once its access is released.
	const activePathRef = useRef<string | null>(null);
	const markdownRef = useRef("");
	// Last content known to be on disk; edits are pending while they differ.
	const baselineRef = useRef("");
	folderRef.current = folder;

	const showMessage = useCallback((text: string, type: Message["type"]) => {
		setMessage({ text, type });
	}, []);

	useEffect(() => {
		if (!message) return;
		const timer = setTimeout(() => setMessage(null), MESSAGE_MS);
		return () => clearTimeout(timer);
	}, [message]);

	const writeFile = useCallback(
		async (path: string, markdown: string) => {
			if (path !== activePathRef.current) return;
			try {
				await tauriApi.writeFileText(path, markdown);
				baselineRef.current = markdown;
			} catch (e) {
				console.error("Auto-save failed:", e);
				showMessage("Couldn't save changes", "error");
			}
		},
		[showMessage],
	);

	const flushSave = useCallback(async () => {
		const path = activePathRef.current;
		if (!path || markdownRef.current === baselineRef.current) return;
		await writeFile(path, markdownRef.current);
	}, [writeFile]);

	const handleLocalChange = useCallback((path: string, markdown: string) => {
		if (path !== activePathRef.current) return;
		markdownRef.current = markdown;
	}, []);

	const releaseActiveFile = useCallback(async () => {
		await flushSave();
		const path = activePathRef.current;
		activePathRef.current = null;
		// Files outside the folder hold their own security-scoped access. The
		// folder can't change while a file is open, so this matches loadFile.
		if (path && !isInFolder(path, folderRef.current)) {
			await tauriApi.stopScopedAccess(path);
		}
	}, [flushSave]);

	const loadFile = useCallback(
		async (path: string) => {
			setOpeningPath(path);
			try {
				await releaseActiveFile();
				const inFolder = isInFolder(path, folderRef.current);
				if (!inFolder) await tauriApi.startScopedAccess(path);
				let text: string;
				try {
					text = await tauriApi.readFileText(path);
				} catch (e) {
					if (!inFolder) await tauriApi.stopScopedAccess(path);
					throw e;
				}
				activePathRef.current = path;
				markdownRef.current = text;
				baselineRef.current = text;
				setFilePath(path);
				setInitialMarkdown(text);
				if (inFolder) setDir(dirname(path));
			} finally {
				setOpeningPath(null);
			}
		},
		[releaseActiveFile],
	);

	const openNote = useCallback(
		(path: string) => {
			loadFile(path).catch((e) =>
				showMessage(`Couldn't open ${basename(path)}: ${errorText(e)}`, "error"),
			);
		},
		[loadFile, showMessage],
	);

	const selectFolder = useCallback((path: string, bookmark: string) => {
		saveBookmark(bookmark);
		setFolder(path);
		setDir(path);
	}, []);

	// iOS can suspend or kill the app once it leaves the foreground, so persist
	// pending edits before the debounced save gets a chance to run.
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") void flushSave();
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, [flushSave]);

	useEffect(() => {
		return () => {
			void releaseActiveFile();
		};
	}, [releaseActiveFile]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const bookmark = loadSavedBookmark();
			if (bookmark) {
				try {
					const access = await tauriApi.resolveFolderBookmark(bookmark);
					if (cancelled) return;
					// Set the ref now so a launch file inside the folder skips its own scope.
					folderRef.current = access.path;
					selectFolder(access.path, access.bookmark);
				} catch (e) {
					saveBookmark(null);
					if (!cancelled) {
						showMessage(`Reopen your folder: ${errorText(e)}`, "error");
					}
				}
			}
			try {
				const urls = await invoke<string[]>("opened_urls");
				if (!cancelled && urls[0]) await loadFile(pathFromOpenedUrl(urls[0]));
			} catch (e) {
				console.error("[HUBBLE] Failed to open launch file:", e);
			}
			if (!cancelled) setLaunching(false);
		})();
		const unlisten = listen<string[]>("opened", (event) => {
			const url = event.payload[0];
			if (url) openNote(pathFromOpenedUrl(url));
		});
		return () => {
			cancelled = true;
			unlisten.then((fn) => fn());
		};
	}, [loadFile, openNote, showMessage, selectFolder]);

	const pickFile = useCallback(async () => {
		for (let attempt = 1; attempt <= PICK_FILE_ATTEMPTS; attempt++) {
			try {
				const picked = await tauriApi.pickFile();
				if (picked) openNote(picked.path);
				return;
			} catch (e) {
				console.error(`[HUBBLE] pickFile attempt ${attempt} failed:`, e);
				await new Promise((r) => setTimeout(r, PICK_FILE_RETRY_MS));
			}
		}
		showMessage("Couldn't show the file picker", "error");
	}, [openNote, showMessage]);

	const pickFolder = useCallback(async () => {
		try {
			const picked = await tauriApi.pickFolder();
			if (picked) selectFolder(picked.path, picked.bookmark);
		} catch (e) {
			showMessage(`Couldn't open folder: ${errorText(e)}`, "error");
		}
	}, [showMessage, selectFolder]);

	const handleClose = useCallback(async () => {
		await releaseActiveFile();
		setFilePath(null);
		setInitialMarkdown("");
	}, [releaseActiveFile]);

	const toggleMode = useCallback(() => {
		// Each editor only reads initialMarkdown on mount, so hand the incoming
		// editor the latest edits from the outgoing one.
		setInitialMarkdown(markdownRef.current);
		setMode((current) => (current === "rich" ? "source" : "rich"));
	}, []);

	const openLinkedNote = useCallback(
		async (path: string, label: string) => {
			if (!isInFolder(path, folderRef.current)) {
				showMessage(OPEN_FOLDER_FOR_LINKS, "error");
				return;
			}
			if (!(await tauriApi.pathExists(path))) {
				showMessage(`Note not found: ${label}`, "error");
				return;
			}
			openNote(path);
		},
		[openNote, showMessage],
	);

	const openLink = useCallback(
		async (href: string) => {
			if (classifyHref(href) === "external") {
				try {
					await tauriApi.openExternalUrl(href);
				} catch (e) {
					console.error("Failed to open link:", e);
					showMessage("Couldn't open link", "error");
				}
				return;
			}
			const current = activePathRef.current;
			if (!current) return;
			const path = resolveRelativeLink({
				href,
				currentFilePath: current,
				folderPath: folderRef.current,
			});
			if (!hasMarkdownExtension(path)) {
				showMessage("Only links to notes open on iOS", "error");
				return;
			}
			await openLinkedNote(path, basename(path));
		},
		[openLinkedNote, showMessage],
	);

	const openWikiLink = useCallback(
		async (target: string) => {
			const root = folderRef.current;
			const current = activePathRef.current;
			if (!root || !current || !isInFolder(current, root)) {
				showMessage(OPEN_FOLDER_FOR_LINKS, "error");
				return;
			}
			for (const candidate of wikiLinkCandidates({
				target,
				currentFilePath: current,
				folderPath: root,
			})) {
				if (await tauriApi.pathExists(candidate)) {
					openNote(candidate);
					return;
				}
			}
			const name = basename(withMarkdownExtension(target.split("#", 1)[0] ?? target));
			const found = await tauriApi.findMarkdownFile(root, name);
			if (found) openNote(found);
			else showMessage(`Note not found: ${target}`, "error");
		},
		[openNote, showMessage],
	);

	return (
		<div className="relative h-full bg-background text-foreground">
			{launching ? null : filePath ? (
				<div className="flex h-full flex-col [padding-block-end:env(safe-area-inset-bottom)]">
					<div className="flex items-center gap-2 border-b border-border px-3 [padding-block:calc(env(safe-area-inset-top)+0.5rem)_0.5rem]">
						<button type="button" onClick={handleClose} className={btn}>
							{folder ? "‹ Back" : "Close"}
						</button>
						<span className="flex-1 truncate text-center text-sm text-muted-foreground">
							{basename(filePath)}
						</span>
						<button type="button" onClick={toggleMode} className={btn}>
							{mode === "rich" ? "Source" : "Rich"}
						</button>
					</div>
					<div className="min-h-0 flex-1">
						{mode === "rich" ? (
							<EditorView
								key={filePath}
								path={filePath}
								initialMarkdown={initialMarkdown}
								onLocalChange={handleLocalChange}
								onSave={writeFile}
								onOpenExternalLink={(href) =>
									openLink(href).catch((e) => showMessage(errorText(e), "error"))
								}
								onOpenWikiLink={(target) =>
									openWikiLink(target).catch((e) => showMessage(errorText(e), "error"))
								}
								onMessage={showMessage}
							/>
						) : (
							<MarkdownSourceEditor
								key={filePath}
								path={filePath}
								initialMarkdown={initialMarkdown}
								onLocalChange={handleLocalChange}
								onSave={writeFile}
								// Tiptap's deferred focus("end") hangs the WKWebView's JS thread
								// on device once the keyboard comes up; let the user tap in.
								autoFocus={false}
							/>
						)}
					</div>
				</div>
			) : folder && dir ? (
				<FolderBrowser
					folderPath={folder}
					dir={dir}
					openingPath={openingPath}
					onNavigate={setDir}
					onOpenNote={openNote}
					onOpenFile={pickFile}
					onChangeFolder={pickFolder}
					onMessage={showMessage}
				/>
			) : (
				<div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center [padding-block:env(safe-area-inset-top)_env(safe-area-inset-bottom)]">
					<p className="text-lg font-semibold">Hubble</p>
					<p className="pb-2 text-sm text-muted-foreground">
						Open a folder of notes to browse them and follow links between
						them.
					</p>
					<button type="button" onClick={pickFolder} className={btn}>
						Open a folder
					</button>
					<button
						type="button"
						onClick={pickFile}
						className="text-sm text-muted-foreground active:opacity-50"
					>
						Open a single file
					</button>
				</div>
			)}
			{message && (
				<div
					role="status"
					className={`pointer-events-none absolute inset-x-4 z-20 [inset-block-end:calc(env(safe-area-inset-bottom)+1rem)] rounded-xl px-4 py-2 text-center text-sm shadow-lg ${
						message.type === "error"
							? "bg-destructive text-white"
							: "bg-foreground text-background"
					}`}
				>
					{message.text}
				</div>
			)}
		</div>
	);
}
