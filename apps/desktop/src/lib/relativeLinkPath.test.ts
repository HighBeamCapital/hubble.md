import { describe, expect, it } from "vitest";
import { resolveRelativeLinkPath, stripLinkAnchor } from "./relativeLinkPath";

describe("resolveRelativeLinkPath", () => {
	it("resolves dot and bare links relative to the current file directory", () => {
		const input = {
			currentFilePath: "/workspace/docs/current.md",
			workspacePath: "/workspace",
		};

		expect(resolveRelativeLinkPath({ ...input, href: "./file.md" })).toBe(
			"/workspace/docs/file.md",
		);
		expect(resolveRelativeLinkPath({ ...input, href: "file.md" })).toBe(
			"/workspace/docs/file.md",
		);
		expect(resolveRelativeLinkPath({ ...input, href: "../file.md" })).toBe(
			"/workspace/file.md",
		);
	});

	it("resolves leading slash links from the workspace root", () => {
		expect(
			resolveRelativeLinkPath({
				href: "/docs/file.md",
				currentFilePath: "/workspace/notes/current.md",
				workspacePath: "/workspace",
			}),
		).toBe("/workspace/docs/file.md");
	});

	it("strips anchors before resolving", () => {
		expect(stripLinkAnchor("./file.md#heading")).toBe("./file.md");
		expect(
			resolveRelativeLinkPath({
				href: "./file.md#heading",
				currentFilePath: "/workspace/current.md",
				workspacePath: "/workspace",
			}),
		).toBe("/workspace/file.md");
	});

	it("allows paths outside the workspace root", () => {
		expect(
			resolveRelativeLinkPath({
				href: "../outside.md",
				currentFilePath: "/workspace/current.md",
				workspacePath: "/workspace",
			}),
		).toBe("/outside.md");
	});
});
