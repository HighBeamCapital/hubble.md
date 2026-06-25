import { describe, expect, it } from "vitest";
import { buildFileTree, flattenRows } from "./useSidebarTree";

function folderNames(node: ReturnType<typeof buildFileTree>) {
	return [...node.folders.values()].map((folder) => folder.name);
}

describe("buildFileTree", () => {
	it("includes empty folders from directory entries", () => {
		const tree = buildFileTree(
			[],
			[{ path: "/workspace/empty", modifiedAt: 3 }],
			(path) => path.replace("/workspace/", ""),
		);

		expect(folderNames(tree)).toEqual(["empty"]);
		expect(tree.folders.get("empty")?.files).toEqual([]);
	});

	it("includes folder-only nested hierarchies from directory entries", () => {
		const tree = buildFileTree(
			[],
			[
				{ path: "/workspace/parent", modifiedAt: 1 },
				{ path: "/workspace/parent/child", modifiedAt: 2 },
			],
			(path) => path.replace("/workspace/", ""),
		);

		const parent = tree.folders.get("parent");
		expect(parent?.folders.get("child")?.files).toEqual([]);
	});

	it("does not render asset folders when listing omits them", () => {
		const tree = buildFileTree(
			[{ path: "/workspace/note.md", modifiedAt: 1 }],
			[],
			(path) => path.replace("/workspace/", ""),
		);

		expect(folderNames(tree)).toEqual([]);
	});
});

describe("flattenRows", () => {
	it("keeps a newly-created nested folder uncollapsed while naming", () => {
		const getDisplayPath = (path: string) => path.replace("/workspace/", "");
		const tree = buildFileTree(
			[],
			[
				{ path: "/workspace/empty", modifiedAt: 1 },
				{ path: "/workspace/empty/new-folder", modifiedAt: 2 },
			],
			getDisplayPath,
		);

		const rows = flattenRows({
			files: [],
			getDisplayPath,
			tree,
			sortMode: "alpha",
			expandedFolders: new Set(["empty/"]),
			uncompactFolderId: "empty/new-folder/",
		});

		expect(rows.map((row) => row.label)).toEqual(["empty", "new-folder"]);
	});

	it("collapses the nested folder chain after naming commits", () => {
		const getDisplayPath = (path: string) => path.replace("/workspace/", "");
		const tree = buildFileTree(
			[],
			[
				{ path: "/workspace/empty", modifiedAt: 1 },
				{ path: "/workspace/empty/new-folder", modifiedAt: 2 },
			],
			getDisplayPath,
		);

		const rows = flattenRows({
			files: [],
			getDisplayPath,
			tree,
			sortMode: "alpha",
			expandedFolders: new Set(["empty/"]),
		});

		expect(rows.map((row) => row.label)).toEqual(["empty/new-folder"]);
	});
});
