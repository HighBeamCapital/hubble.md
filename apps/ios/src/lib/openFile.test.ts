import { describe, expect, it, vi } from "vitest";
import { readFileForOpen, type ScopedFileApi } from "./openFile";

const folderPath = "/root/notes";

function makeApi(overrides: Partial<ScopedFileApi> = {}) {
	return {
		startScopedAccess: vi.fn(async () => {}),
		stopScopedAccess: vi.fn(async () => {}),
		readFileText: vi.fn(async (path: string) => `text of ${path}`),
		...overrides,
	};
}

describe("readFileForOpen", () => {
	it("commits an in-folder file without scoped access", async () => {
		const api = makeApi();
		const commit = vi.fn();
		await readFileForOpen({
			path: "/root/notes/b.md",
			activePath: "/root/notes/a.md",
			folderPath,
			api,
			flush: vi.fn(),
			commit,
		});
		expect(commit).toHaveBeenCalledWith("text of /root/notes/b.md");
		expect(api.startScopedAccess).not.toHaveBeenCalled();
		expect(api.stopScopedAccess).not.toHaveBeenCalled();
	});

	it("reads, commits, then releases the previous out-of-folder file", async () => {
		const order: string[] = [];
		const api = makeApi({
			readFileText: vi.fn(async () => {
				order.push("read");
				return "new";
			}),
			stopScopedAccess: vi.fn(async (p: string) => {
				order.push(`stop ${p}`);
			}),
		});
		await readFileForOpen({
			path: "/root/notes/b.md",
			activePath: "/elsewhere/old.md",
			folderPath,
			api,
			flush: vi.fn(),
			commit: async () => {
				order.push("commit");
			},
		});
		expect(order).toEqual(["read", "commit", "stop /elsewhere/old.md"]);
	});

	it("keeps the previous file active when the read fails", async () => {
		const api = makeApi({
			readFileText: vi.fn(async () => {
				throw new Error("boom");
			}),
		});
		const commit = vi.fn();
		await expect(
			readFileForOpen({
				path: "/elsewhere/new.md",
				activePath: "/elsewhere/old.md",
				folderPath,
				api,
				flush: vi.fn(),
				commit,
			}),
		).rejects.toThrow("boom");
		expect(commit).not.toHaveBeenCalled();
		expect(api.startScopedAccess).toHaveBeenCalledWith("/elsewhere/new.md");
		expect(api.stopScopedAccess).toHaveBeenCalledTimes(1);
		expect(api.stopScopedAccess).toHaveBeenCalledWith("/elsewhere/new.md");
		expect(api.stopScopedAccess).not.toHaveBeenCalledWith("/elsewhere/old.md");
	});

	it("keeps the previous file active when starting access fails", async () => {
		const api = makeApi({
			startScopedAccess: vi.fn(async () => {
				throw new Error("denied");
			}),
		});
		const commit = vi.fn();
		await expect(
			readFileForOpen({
				path: "/elsewhere/new.md",
				activePath: "/elsewhere/old.md",
				folderPath,
				api,
				flush: vi.fn(),
				commit,
			}),
		).rejects.toThrow("denied");
		expect(commit).not.toHaveBeenCalled();
		expect(api.stopScopedAccess).not.toHaveBeenCalled();
	});

	it("keeps pending edits when reopening the active file", async () => {
		const path = "/root/notes/a.md";
		const state = { markdown: "edited", baseline: "disk", disk: "disk" };
		const api = makeApi({
			readFileText: vi.fn(async () => state.disk),
		});
		const commit = vi.fn(async (text: string) => {
			state.markdown = text;
			state.baseline = text;
		});
		await readFileForOpen({
			path,
			activePath: path,
			folderPath,
			api,
			flush: async () => {
				state.disk = state.markdown;
				state.baseline = state.markdown;
			},
			commit,
		});
		expect(commit).not.toHaveBeenCalled();
		expect(api.readFileText).not.toHaveBeenCalled();
		expect(state).toEqual({
			markdown: "edited",
			baseline: "edited",
			disk: "edited",
		});
	});

	it("reuses the held access when reopening the active out-of-folder file", async () => {
		const api = makeApi();
		const flush = vi.fn();
		await readFileForOpen({
			path: "/elsewhere/a.md",
			activePath: "/elsewhere/a.md",
			folderPath,
			api,
			flush,
			commit: vi.fn(),
		});
		expect(flush).toHaveBeenCalledTimes(1);
		expect(api.startScopedAccess).not.toHaveBeenCalled();
		expect(api.stopScopedAccess).not.toHaveBeenCalled();
	});
});
