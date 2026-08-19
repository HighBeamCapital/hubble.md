import { describe, expect, it } from "vitest";
import { classifyFileChange } from "./externalFileChange";

describe("classifyFileChange", () => {
	it("reload when clean editor sees disk change", () => {
		expect(
			classifyFileChange({
				editorContent: "before",
				baseline: "before",
				diskContent: "after",
			}),
		).toBe("reload");
	});

	it("match when editor already equals disk", () => {
		expect(
			classifyFileChange({
				editorContent: "local edit",
				baseline: "before",
				diskContent: "local edit",
			}),
		).toBe("match");
	});

	it("conflict when editor and disk diverge", () => {
		expect(
			classifyFileChange({
				editorContent: "local edit",
				baseline: "before",
				diskContent: "remote edit",
			}),
		).toBe("conflict");
	});

	it("none when disk unchanged", () => {
		expect(
			classifyFileChange({
				editorContent: "before",
				baseline: "before",
				diskContent: "before",
			}),
		).toBe("none");
	});

	it("none when disk unchanged but editor is dirty", () => {
		expect(
			classifyFileChange({
				editorContent: "local edit",
				baseline: "before",
				diskContent: "before",
			}),
		).toBe("none");
	});

	it("none when disk content only differs from baseline by trailing newline or extra blank lines", () => {
		// Regression test: a note with irregular blank-line runs and no trailing
		// newline doesn't round-trip byte-for-byte through the Markdown editor.
		// Treating that cosmetic reformatting as a real disk change used to drive
		// an unbounded save -> watcher -> reload loop that pegged the renderer's
		// CPU (see Hubble Energy Impact Suggested Fixes.md).
		expect(
			classifyFileChange({
				editorContent: "# Title\n\nBody.",
				baseline: "# Title\n\n\n\nBody.",
				diskContent: "# Title\n\n\n\nBody.",
			}),
		).toBe("none");
	});
});
