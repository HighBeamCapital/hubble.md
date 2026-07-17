import { useCallback, useEffect, useRef, useState } from "react";
import { basename } from "./lib/filePath";
import { renderMarkdown } from "./lib/renderMarkdown";
import { tauriApi } from "./tauriApi";

const DEBOUNCE_MS = 500;

const btn =
	"rounded-full bg-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-700 active:bg-zinc-300 active:scale-95 transition dark:bg-zinc-700 dark:text-zinc-200 dark:active:bg-zinc-600";

export function App() {
	const [filePath, setFilePath] = useState<string | null>(null);
	const [content, setContent] = useState("");
	const [previewMode, setPreviewMode] = useState(false);
	const [previewHtml, setPreviewHtml] = useState("");
	const [showPicker, setShowPicker] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const contentRef = useRef(content);
	const filePathRef = useRef(filePath);
	contentRef.current = content;
	filePathRef.current = filePath;

	const fileName = filePath ? basename(filePath) : null;

	const flushSave = useCallback(async () => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		if (!filePathRef.current) return;
		try {
			await tauriApi.writeFileText(filePathRef.current, contentRef.current);
		} catch (e) {
			console.error("Auto-save failed:", e);
		}
	}, []);

	const scheduleSave = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			timerRef.current = null;
			flushSave();
		}, DEBOUNCE_MS);
	}, [flushSave]);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			flushSave();
			if (filePathRef.current) {
				tauriApi.stopScopedAccess(filePathRef.current);
			}
		};
	}, [flushSave]);

	const loadFile = useCallback(async (path: string) => {
		await tauriApi.startScopedAccess(path);
		const text = await tauriApi.readFileText(path);
		setFilePath(path);
		setContent(text);
		setPreviewMode(false);
		setShowPicker(false);
	}, []);

	useEffect(() => {
		setShowPicker(true);
	}, []);

	useEffect(() => {
		if (!showPicker) return;
		let cancelled = false;
		(async () => {
			try {
				const path = await tauriApi.openFilePicker();
				if (!cancelled && path) await loadFile(path);
				if (!cancelled && !path) setShowPicker(false);
			} catch (e) {
				console.error("Failed to open file:", e);
				if (!cancelled) setShowPicker(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [showPicker, loadFile]);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			setContent(e.target.value);
			scheduleSave();
		},
		[scheduleSave],
	);

	const handleClose = useCallback(async () => {
		await flushSave();
		if (filePathRef.current) {
			tauriApi.stopScopedAccess(filePathRef.current);
		}
		setFilePath(null);
		setContent("");
		setPreviewMode(false);
		setShowPicker(true);
	}, [flushSave]);

	const handleOpen = useCallback(() => {
		setShowPicker(true);
	}, []);

	const togglePreview = useCallback(async () => {
		if (!previewMode) {
			const html = await renderMarkdown(content);
			setPreviewHtml(html);
		}
		setPreviewMode((p) => !p);
	}, [previewMode, content]);

	if (!filePath) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-4 bg-zinc-50 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
				<p className="text-sm text-zinc-500">
					{showPicker ? "Opening file..." : "No file open"}
				</p>
				{!showPicker && (
					<button type="button" onClick={handleOpen} className={btn}>
						Open a file
					</button>
				)}
			</div>
		);
	}

	return (
		<div className="flex h-screen flex-col bg-zinc-50 pb-[env(safe-area-inset-bottom)] text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
			<div className="flex items-center gap-2 border-b border-zinc-200 px-3 pt-[env(safe-area-inset-top)] py-2 dark:border-zinc-700">
				<button type="button" onClick={handleClose} className={btn}>
					Close
				</button>
				<span className="flex-1 text-center text-sm text-zinc-500">
					{fileName}
				</span>
				<button type="button" onClick={togglePreview} className={btn}>
					{previewMode ? "Raw" : "Preview"}
				</button>
			</div>
			<div className="flex-1 overflow-auto">
				{previewMode ? (
					<div
						className="prose prose-zinc dark:prose-invert mx-auto max-w-3xl p-6"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: rendered from user's own markdown
						dangerouslySetInnerHTML={{ __html: previewHtml }}
					/>
				) : (
					<textarea
						value={content}
						onChange={handleChange}
						spellCheck={false}
						className="h-full w-full resize-none bg-transparent p-6 font-mono text-sm leading-relaxed outline-none"
						placeholder="Start typing..."
					/>
				)}
			</div>
		</div>
	);
}
