import { describe, expect, it } from "vitest";
import { isInFolder, wikiLinkCandidates } from "./folder";

const root = "/root/notes";

describe("isInFolder", () => {
	it("accepts the folder and paths inside it", () => {
		expect(isInFolder("/root/notes", root)).toBe(true);
		expect(isInFolder("/root/notes/a.md", root)).toBe(true);
		expect(isInFolder("/root/notes/sub/../a.md", root)).toBe(true);
	});

	it("rejects paths that escape through ..", () => {
		expect(isInFolder("/root/notes/../Other.md", root)).toBe(false);
		expect(isInFolder("/root/notes/../../Other.md", root)).toBe(false);
		expect(isInFolder("/root/notes/sub/../../../x.md", root)).toBe(false);
	});

	it("rejects sibling folders sharing a prefix and a missing folder", () => {
		expect(isInFolder("/root/notes-old/a.md", root)).toBe(false);
		expect(isInFolder("/root/notes/a.md", null)).toBe(false);
	});

	it("tolerates a trailing slash on the folder", () => {
		expect(isInFolder("/root/notes/a.md", `${root}/`)).toBe(true);
		expect(isInFolder("/root/notes/../a.md", `${root}/`)).toBe(false);
	});
});

describe("wikiLinkCandidates", () => {
	const current = "/root/notes/sub/current.md";

	it("returns same-folder and root-relative candidates", () => {
		expect(
			wikiLinkCandidates({
				target: "Other",
				currentFilePath: current,
				folderPath: root,
			}),
		).toEqual(["/root/notes/sub/Other.md", "/root/notes/Other.md"]);
	});

	it("drops the #heading suffix and keeps an existing extension", () => {
		expect(
			wikiLinkCandidates({
				target: "Other.md#Intro",
				currentFilePath: current,
				folderPath: root,
			}),
		).toEqual(["/root/notes/sub/Other.md", "/root/notes/Other.md"]);
	});

	it("normalizes in-folder .. segments", () => {
		expect(
			wikiLinkCandidates({
				target: "../Up",
				currentFilePath: current,
				folderPath: root,
			}),
		).toEqual(["/root/notes/Up.md"]);
	});

	it("drops candidates that escape the folder", () => {
		expect(
			wikiLinkCandidates({
				target: "../../Other",
				currentFilePath: current,
				folderPath: root,
			}),
		).toEqual([]);
		expect(
			wikiLinkCandidates({
				target: "../../../etc/passwd",
				currentFilePath: "/root/notes/current.md",
				folderPath: root,
			}),
		).toEqual([]);
	});

	it("keeps the in-folder candidate when only one escapes", () => {
		expect(
			wikiLinkCandidates({
				target: "../Other",
				currentFilePath: "/root/notes/current.md",
				folderPath: root,
			}),
		).toEqual([]);
		expect(
			wikiLinkCandidates({
				target: "../Other",
				currentFilePath: current,
				folderPath: root,
			}),
		).toEqual(["/root/notes/Other.md"]);
	});
});
