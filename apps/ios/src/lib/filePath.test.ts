import { describe, expect, it } from "vitest";
import { markdownAssetFolderPath } from "./filePath";

describe("markdownAssetFolderPath", () => {
	it("puts <stem>.assets next to the note", () => {
		expect(markdownAssetFolderPath("/root/notes/Plan.md")).toBe(
			"/root/notes/Plan.assets",
		);
		expect(markdownAssetFolderPath("/root/notes/Plan.markdown")).toBe(
			"/root/notes/Plan.assets",
		);
	});

	it("keeps dots inside the stem", () => {
		expect(markdownAssetFolderPath("/root/v1.2 notes.md")).toBe(
			"/root/v1.2 notes.assets",
		);
	});

	it("handles Windows separators and files without an extension", () => {
		expect(markdownAssetFolderPath("C:\\notes\\Plan.md")).toBe(
			"C:\\notes\\Plan.assets",
		);
		expect(markdownAssetFolderPath("/root/Plan")).toBe("/root/Plan.assets");
	});

	it("returns null without a parent folder", () => {
		expect(markdownAssetFolderPath("Plan.md")).toBeNull();
	});
});
