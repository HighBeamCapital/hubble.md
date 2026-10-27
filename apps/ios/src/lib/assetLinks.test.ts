import { describe, expect, it } from "vitest";
import { rewriteOwnAssetLinks } from "./assetLinks";

const fromNote = "/root/notes/my-note.md";
const toNote = "/root/notes/renamed.md";
const rewrite = (content: string) =>
	rewriteOwnAssetLinks({ content, fromNote, toNote });

describe("rewriteOwnAssetLinks", () => {
	it("rewrites images, links, titles, suffixes, and html src into the old assets folder", () => {
		expect(
			rewrite(
				[
					"![Recall](my-note.assets/recall.jpg)",
					'![T](./my-note.assets/a.png "caption")',
					"[file](my-note.assets/doc.pdf#page=2)",
					'<img src="my-note.assets/x.png">',
				].join("\n"),
			),
		).toBe(
			[
				"![Recall](renamed.assets/recall.jpg)",
				'![T](renamed.assets/a.png "caption")',
				"[file](renamed.assets/doc.pdf#page=2)",
				'<img src="renamed.assets/x.png">',
			].join("\n"),
		);
	});

	it("leaves unrelated references and plain text untouched", () => {
		const content = [
			"![Other](other.assets/o.png)",
			"![Remote](https://example.com/my-note.assets/r.png)",
			"![Abs](/my-note.assets/a.png)",
			"![Sibling](my-note.assets-extra/s.png)",
			"[Note](my-note.md)",
			"Text mentioning my-note.assets/recall.jpg without a link.",
		].join("\n");
		expect(rewrite(content)).toBe(content);
	});

	it("returns content unchanged when the assets folder name is unchanged", () => {
		const content = "![a](my-note.assets/a.png)";
		expect(
			rewriteOwnAssetLinks({
				content,
				fromNote,
				toNote: "/root/notes/my-note.md",
			}),
		).toBe(content);
	});
});
