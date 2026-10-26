import { EditorView, MarkdownSourceEditor } from "@hubble.md/ui";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { basename } from "./lib/filePath";
import { tauriApi } from "./tauriApi";

type EditorMode = "rich" | "source";
type Message = { text: string; type: "success" | "error" };

const MESSAGE_MS = 2500;

const btn =
	"rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground active:scale-95 active:opacity-70 transition";

function pathFromOpenedUrl(url: string): string {
	return url.startsWith("file://") ? decodeURIComponent(url.slice(7)) : url;
}

export function App() {
	const [filePath, setFilePath] = useState<string | null>(null);
	const [initialMarkdown, setInitialMarkdown] = useState("");
	const [mode, setMode] = useState<EditorMode>("rich");
	const [showPicker, setShowPicker] = useState(false);
	const [message, setMessage] = useState<Message | null>(null);
	// The file the app currently holds security-scoped access to. Saves for any
	// other path are dropped, since iOS rejects writes once access is released.
	const activePathRef = useRef<string | null>(null);
	const markdownRef = useRef("");
	// Last content known to be on disk; edits are pending while they differ.
	const baselineRef = useRef("");

	const fileName = filePath ? basename(filePath) : null;

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
		if (path) await tauriApi.stopScopedAccess(path);
	}, [flushSave]);

	const loadFile = useCallback(
		async (path: string) => {
			await releaseActiveFile();
			await tauriApi.startScopedAccess(path);
			const text = await tauriApi.readFileText(path);
			activePathRef.current = path;
			markdownRef.current = text;
			baselineRef.current = text;
			setFilePath(path);
			setInitialMarkdown(text);
			setShowPicker(false);
		},
		[releaseActiveFile],
	);

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
			try {
				const urls = await invoke<string[]>("opened_urls");
				const path = urls[0] ? pathFromOpenedUrl(urls[0]) : null;
				if (!cancelled && path) {
					try {
						await loadFile(path);
					} catch (e) {
						console.error("[HUBBLE] Failed to load opened file:", e);
						if (!cancelled) setShowPicker(true);
					}
					return;
				}
				if (!cancelled) setShowPicker(true);
			} catch (e) {
				console.error("[HUBBLE] Failed to check launch URLs:", e);
				if (!cancelled) setShowPicker(true);
			}
		})();
		const unlisten = listen<string[]>("opened", async (event) => {
			const url = event.payload[0];
			if (!url) return;
			try {
				await loadFile(pathFromOpenedUrl(url));
			} catch (e) {
				console.error("[HUBBLE] Failed to load opened file from event:", e);
			}
		});
		return () => {
			cancelled = true;
			unlisten.then((fn) => fn());
		};
	}, [loadFile]);

	useEffect(() => {
		if (!showPicker) return;
		let cancelled = false;
		const MAX_ATTEMPTS = 5;
		const RETRY_MS = 200;
		(async () => {
			for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
				if (cancelled) return;
				try {
					const picked = await tauriApi.pickFile();
					if (!cancelled && picked) await loadFile(picked.path);
					if (!cancelled && !picked) setShowPicker(false);
					return;
				} catch (e) {
					console.error(`[HUBBLE] pickFile attempt ${attempt + 1} failed:`, e);
					if (attempt < MAX_ATTEMPTS - 1) {
						await new Promise((r) => setTimeout(r, RETRY_MS));
					}
				}
			}
			if (!cancelled) setShowPicker(false);
		})();
		return () => {
			cancelled = true;
		};
	}, [showPicker, loadFile]);

	const handleClose = useCallback(async () => {
		await releaseActiveFile();
		setFilePath(null);
		setInitialMarkdown("");
		setShowPicker(true);
	}, [releaseActiveFile]);

	const toggleMode = useCallback(() => {
		// Each editor only reads initialMarkdown on mount, so hand the incoming
		// editor the latest edits from the outgoing one.
		setInitialMarkdown(markdownRef.current);
		setMode((current) => (current === "rich" ? "source" : "rich"));
	}, []);

	const openExternalLink = useCallback(
		async (href: string) => {
			try {
				await tauriApi.openExternalUrl(href);
			} catch (e) {
				console.error("Failed to open link:", e);
				showMessage("Couldn't open link", "error");
			}
		},
		[showMessage],
	);

	const openWikiLink = useCallback(() => {
		showMessage("Linked files can't be opened yet on iOS", "error");
	}, [showMessage]);

	if (!filePath) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 bg-background text-foreground [padding-block:env(safe-area-inset-top)_env(safe-area-inset-bottom)]">
				<p className="text-sm text-muted-foreground">
					{showPicker ? "Opening file..." : "No file open"}
				</p>
				{!showPicker && (
					<button
						type="button"
						onClick={() => setShowPicker(true)}
						className={btn}
					>
						Open a file
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="relative flex h-full flex-col bg-background text-foreground [padding-block-end:env(safe-area-inset-bottom)]">
			<div className="flex items-center gap-2 border-b border-border px-3 [padding-block:calc(env(safe-area-inset-top)+0.5rem)_0.5rem]">
				<button type="button" onClick={handleClose} className={btn}>
					Close
				</button>
				<span className="flex-1 truncate text-center text-sm text-muted-foreground">
					{fileName}
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
						onOpenExternalLink={openExternalLink}
						onOpenWikiLink={openWikiLink}
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
			{message && (
				<div
					role="status"
					className={`pointer-events-none absolute inset-x-4 [inset-block-end:calc(env(safe-area-inset-bottom)+1rem)] rounded-xl px-4 py-2 text-center text-sm shadow-lg ${
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
