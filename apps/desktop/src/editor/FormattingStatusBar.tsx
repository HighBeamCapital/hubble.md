import { getCaretFormattingState } from "@hubble.md/editor";
import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import MingcuteBoldLine from "~icons/mingcute/bold-line";
import MingcuteItalicLine from "~icons/mingcute/italic-line";
import MingcuteLinkLine from "~icons/mingcute/link-line";

type PaletteState = {
	wordCount: number;
	activeMarkNames: string[];
	canEscapeBoundary: boolean;
	showDashedDivider: boolean;
};

export function FormattingStatusBar({
	editor,
	scrollContainer,
}: {
	editor: Editor | null;
	scrollContainer: HTMLDivElement | null;
}) {
	const [paletteState, setPaletteState] = useState<PaletteState>({
		wordCount: 0,
		activeMarkNames: [],
		canEscapeBoundary: false,
		showDashedDivider: false,
	});

	useEffect(() => {
		if (!editor) return;
		const resolvedScrollContainer =
			scrollContainer ??
			(editor.view.dom.closest(".editorViewport") as HTMLDivElement | null) ??
			null;

		const update = () => {
			const wordCount = countWords(editor.getText());
			const { state } = editor;
			const scrollContainer = resolvedScrollContainer;
			const scrollHeight = scrollContainer?.scrollHeight ?? 0;
			const clientHeight = scrollContainer?.clientHeight ?? 0;
			const scrollTop = scrollContainer?.scrollTop ?? 0;
			const maxScrollTop = Math.max(scrollHeight - clientHeight, 0);
			const hasMeaningfulOverflow = maxScrollTop > 8;
			const isAtBottom = maxScrollTop - scrollTop <= 2;
			const showDashedDivider = hasMeaningfulOverflow && !isAtBottom;
			if (!editor.isFocused || !state.selection.empty) {
				setPaletteState({
					wordCount,
					activeMarkNames: [],
					canEscapeBoundary: false,
					showDashedDivider,
				});
				return;
			}

			const caretState = getCaretFormattingState(state);
			setPaletteState({
				wordCount,
				activeMarkNames: caretState.activeMarkNames,
				canEscapeBoundary: caretState.canEscapeBoundary,
				showDashedDivider,
			});
		};

		update();
		requestAnimationFrame(update);
		editor.on("selectionUpdate", update);
		editor.on("transaction", update);
		editor.on("focus", update);
		editor.on("blur", update);
		resolvedScrollContainer?.addEventListener("scroll", update, {
			passive: true,
		});
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);

		return () => {
			editor.off("selectionUpdate", update);
			editor.off("transaction", update);
			editor.off("focus", update);
			editor.off("blur", update);
			resolvedScrollContainer?.removeEventListener("scroll", update);
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [editor, scrollContainer]);
	if (!editor) return null;
	const dividerClass = paletteState.showDashedDivider
		? "[border-block-start:1px_dashed_var(--border)]"
		: "border-transparent";

	return (
		<div
			className={`z-[3] flex h-8 items-center justify-between bg-background/95 px-4 text-[12px] backdrop-blur-[2px] ${dividerClass}`}
		>
			<p className="leading-none text-muted-foreground">
				{paletteState.wordCount} words
			</p>
			<div className="flex items-center gap-2 text-muted-foreground">
				{paletteState.canEscapeBoundary && (
					<span className="inline-flex h-4 items-center rounded-sm border border-border bg-secondary px-1 text-[11px] leading-none text-foreground shadow-panel inset-shadow-chrome">
						esc
					</span>
				)}
				{paletteState.activeMarkNames.includes("bold") && (
					<MingcuteBoldLine className="size-4" />
				)}
				{paletteState.activeMarkNames.includes("italic") && (
					<MingcuteItalicLine className="size-4" />
				)}
				{paletteState.activeMarkNames.includes("link") && (
					<MingcuteLinkLine className="size-4" />
				)}
			</div>
		</div>
	);
}

function countWords(text: string) {
	const trimmed = text.trim();
	if (trimmed.length === 0) return 0;
	return trimmed.split(/\s+/).length;
}
