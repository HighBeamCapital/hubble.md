// @vitest-environment happy-dom

import { Editor, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import {
	formatCountLabel,
	getFormattingStatusCounts,
} from "./FormattingStatusBar";

const editors: Editor[] = [];

afterEach(() => {
	for (const editor of editors) editor.destroy();
	editors.length = 0;
});

describe("formatting status bar counts", () => {
	it("counts the whole document when there is no selection", () => {
		const editor = createEditor(docWithParagraph("one two words three"));
		placeCursorAfterText(editor, "one two words three");

		const counts = getFormattingStatusCounts(editor);

		expect(counts).toEqual({
			wordCount: 4,
			charCount: 19,
			isSelectionCount: false,
		});
		expect(formatCountLabel("words", counts)).toBe("4 words");
	});

	it("counts selected text when the focused editor has a selection", () => {
		const editor = createEditor(docWithParagraph("one two words three"));
		selectText(editor, "two words");

		const counts = getFormattingStatusCounts(editor);

		expect(counts).toEqual({
			wordCount: 2,
			charCount: 9,
			isSelectionCount: true,
		});
		expect(formatCountLabel("words", counts)).toBe("2 words selected");
		expect(formatCountLabel("chars", counts)).toBe("9 characters selected");
	});

	it("updates selected counts when the selection changes", () => {
		const editor = createEditor(docWithParagraph("one two words three"));
		selectText(editor, "two words");

		expect(getFormattingStatusCounts(editor).wordCount).toBe(2);

		selectText(editor, "three");

		expect(getFormattingStatusCounts(editor)).toMatchObject({
			wordCount: 1,
			charCount: 5,
			isSelectionCount: true,
		});
	});

	it("counts the whole document when the editor is unfocused", () => {
		const editor = createEditor(docWithParagraph("one two words three"), {
			focused: false,
		});
		selectText(editor, "two words");

		const counts = getFormattingStatusCounts(editor);

		expect(counts).toEqual({
			wordCount: 4,
			charCount: 19,
			isSelectionCount: false,
		});
		expect(formatCountLabel("chars", counts)).toBe("19 characters");
	});
});

function createEditor(
	content: JSONContent,
	{ focused = true }: { focused?: boolean } = {},
) {
	const editor = new Editor({
		element: document.createElement("div"),
		extensions: [StarterKit],
		content,
	});
	editors.push(editor);
	Object.defineProperty(editor, "isFocused", {
		value: focused,
		configurable: true,
	});
	return editor;
}

function selectText(editor: Editor, text: string) {
	const range = findTextRange(editor, text);
	editor.view.dispatch(
		editor.state.tr.setSelection(
			TextSelection.create(editor.state.doc, range.from, range.to),
		),
	);
}

function placeCursorAfterText(editor: Editor, text: string) {
	const range = findTextRange(editor, text);
	editor.view.dispatch(
		editor.state.tr.setSelection(
			TextSelection.create(editor.state.doc, range.to),
		),
	);
}

function findTextRange(editor: Editor, text: string) {
	let range: { from: number; to: number } | undefined;
	editor.state.doc.descendants((node, pos) => {
		if (!node.isText || !node.text) return;

		const index = node.text.indexOf(text);
		if (index === -1) return;

		const from = pos + index;
		range = { from, to: from + text.length };
		return false;
	});
	if (!range) throw new Error(`Text not found: ${text}`);
	return range;
}

function docWithParagraph(text: string) {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
				content: [{ type: "text", text }],
			},
		],
	} satisfies JSONContent;
}
