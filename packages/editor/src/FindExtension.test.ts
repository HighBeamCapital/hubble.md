import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { findMatches } from "./FindExtension";

const schema = new Schema({
	nodes: {
		doc: { content: "paragraph+" },
		paragraph: {
			content: "text*",
			group: "block",
			parseDOM: [{ tag: "p" }],
			toDOM: () => ["p", 0],
		},
		text: { group: "inline" },
	},
	marks: {
		bold: {},
	},
});

describe("findMatches", () => {
	it("finds case-insensitive text-node matches", () => {
		const doc = schema.node("doc", null, [
			schema.node("paragraph", null, schema.text("Alpha beta alpha")),
			schema.node("paragraph", null, schema.text("Alphabet")),
		]);

		expect(findMatches(doc, "alpha")).toEqual([
			{ from: 1, to: 6 },
			{ from: 12, to: 17 },
			{ from: 19, to: 24 },
		]);
	});

	it("finds matches split across inline formatting", () => {
		const bold = schema.mark("bold");
		const doc = schema.node("doc", null, [
			schema.node("paragraph", null, [
				schema.text("needle", [bold]),
				schema.text(" top"),
			]),
		]);

		expect(findMatches(doc, "needle top")).toEqual([{ from: 1, to: 11 }]);
	});

	it("does not match across paragraph boundaries", () => {
		const doc = schema.node("doc", null, [
			schema.node("paragraph", null, schema.text("needle")),
			schema.node("paragraph", null, schema.text("top")),
		]);

		expect(findMatches(doc, "needle top")).toEqual([]);
	});

	it("returns no matches for an empty query", () => {
		const doc = schema.node("doc", null, [
			schema.node("paragraph", null, schema.text("Alpha")),
		]);

		expect(findMatches(doc, "")).toEqual([]);
	});
});
