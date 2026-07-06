import type { Editor } from "@tiptap/core";
import Document from "@tiptap/extension-document";
import { EditorContent, type JSONContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef } from "react";
import { HubbleCodeBlock } from "./CodeBlockExtension";
import "./EditorView.css";

const DEFAULT_SAVE_DEBOUNCE_MS = 120;
const SourceDocument = Document.extend({ content: "codeBlock" });

export type MarkdownSourceEditorProps = {
	path: string;
	initialMarkdown: string;
	saveDebounceMs?: number;
	onLocalChange: (path: string, markdown: string) => void;
	onSave: (path: string, markdown: string) => void | Promise<void>;
	onScrollContainerChange?: (el: HTMLDivElement | null) => void;
};

export function MarkdownSourceEditor({
	path,
	initialMarkdown,
	saveDebounceMs = DEFAULT_SAVE_DEBOUNCE_MS,
	onLocalChange,
	onSave,
	onScrollContainerChange,
}: MarkdownSourceEditorProps) {
	const pathRef = useRef(path);
	const latestMarkdownRef = useRef(initialMarkdown);
	const saveTimerRef = useRef<number | null>(null);
	pathRef.current = path;

	const setEditorViewport = useCallback(
		(node: HTMLDivElement | null) => {
			onScrollContainerChange?.(node);
		},
		[onScrollContainerChange],
	);

	const scheduleSave = useCallback(() => {
		const savePath = pathRef.current;
		if (saveTimerRef.current !== null) {
			window.clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = window.setTimeout(() => {
			void onSave(savePath, latestMarkdownRef.current);
		}, saveDebounceMs);
	}, [onSave, saveDebounceMs]);

	const editor = useEditor({
		extensions: [
			SourceDocument,
			StarterKit.configure({ codeBlock: false, document: false }),
			HubbleCodeBlock.configure({ defaultLanguage: "md" }),
		],
		content: sourceDocFromMarkdown(initialMarkdown),
		onUpdate: ({ editor: current }) => {
			const markdown = markdownFromSourceDoc(current);
			latestMarkdownRef.current = markdown;
			onLocalChange(pathRef.current, markdown);
			scheduleSave();
		},
		editorProps: {
			attributes: {
				"data-editor-input": "",
				"aria-label": "Markdown source",
			},
		},
	});

	useEffect(() => {
		if (!editor) return;
		editor.commands.focus("end");
	}, [editor]);

	useEffect(() => {
		if (!editor) return;
		if (initialMarkdown === latestMarkdownRef.current) return;
		latestMarkdownRef.current = initialMarkdown;
		editor.commands.setContent(sourceDocFromMarkdown(initialMarkdown), {
			emitUpdate: false,
		});
	}, [editor, initialMarkdown]);

	useEffect(() => {
		return () => {
			if (saveTimerRef.current !== null) {
				window.clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
				void onSave(path, latestMarkdownRef.current);
			}
		};
	}, [path, onSave]);

	return (
		<div
			className="relative flex h-full min-h-0 flex-col"
			data-hubble-editor
			data-hubble-source-editor
		>
			<div
				className="editorViewport relative min-h-0 flex-1 overflow-auto overscroll-contain"
				ref={setEditorViewport}
			>
				<EditorContent editor={editor} />
			</div>
		</div>
	);
}

export function sourceDocFromMarkdown(markdown: string): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "codeBlock",
				attrs: { language: "md" },
				content: markdown.length > 0 ? [{ type: "text", text: markdown }] : [],
			},
		],
	};
}

export function markdownFromSourceDoc(editor: Editor) {
	return editor.state.doc.textBetween(
		0,
		editor.state.doc.content.size,
		"\n",
		"\n",
	);
}
