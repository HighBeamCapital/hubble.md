import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@simplestack/store", () => ({
	store: vi.fn(() => ({
		get: vi.fn(() => ({ tabs: [], activeIndex: -1 })),
		set: vi.fn(),
		select: vi.fn(() => ({
			get: vi.fn(() => null),
			set: vi.fn(),
			select: vi.fn(),
		})),
	})),
}));

vi.mock("@simplestack/store/react", () => ({
	useStoreValue: vi.fn(() => ({ tabs: [], activeIndex: -1 })),
}));

const mockDesktopApi = {
	readFileText: vi.fn().mockResolvedValue("# Hello"),
	writeFileText: vi.fn().mockResolvedValue(undefined),
	saveStandaloneSettings: vi.fn().mockResolvedValue(undefined),
	getStandaloneSettings: vi.fn().mockResolvedValue(null),
	closeStandaloneWindow: vi.fn().mockResolvedValue(undefined),
	openFilePicker: vi.fn().mockResolvedValue(null),
	watchPath: vi.fn().mockResolvedValue(vi.fn()),
	onOpenFile: vi.fn().mockReturnValue(vi.fn()),
};

vi.mock("../../desktopApi", () => ({
	desktopApi: mockDesktopApi,
}));

describe("Standalone mode tabs store", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("exports expected tab management functions", async () => {
		const tabs = await import("../../store/tabs");
		expect(typeof tabs.openTab).toBe("function");
		expect(typeof tabs.closeTab).toBe("function");
		expect(typeof tabs.switchTab).toBe("function");
		expect(typeof tabs.useActiveTab).toBe("function");
		expect(typeof tabs.useTabCount).toBe("function");
		expect(typeof tabs.useTabs).toBe("function");
	});

	it("initialFilePath getter/setter round-trips", async () => {
		const tabs = await import("../../store/tabs");
		expect(tabs.getInitialFilePath()).toBeNull();
		tabs.setInitialFilePath("/test/file.md");
		expect(tabs.getInitialFilePath()).toBe("/test/file.md");
		tabs.setInitialFilePath(null);
		expect(tabs.getInitialFilePath()).toBeNull();
	});
});

describe("Standalone mode detection", () => {
	it("detects standalone=1 in URL params", () => {
		const params = new URLSearchParams("standalone=1&file=/test.md");
		expect(params.get("standalone")).toBe("1");
		expect(params.get("file")).toBe("/test.md");
	});

	it("does not detect standalone when param is missing", () => {
		const params = new URLSearchParams("");
		expect(params.get("standalone")).toBeNull();
	});
});

describe("Standalone IPC contract", () => {
	it("desktopApi has all required standalone methods", () => {
		expect(typeof mockDesktopApi.getStandaloneSettings).toBe("function");
		expect(typeof mockDesktopApi.saveStandaloneSettings).toBe("function");
		expect(typeof mockDesktopApi.closeStandaloneWindow).toBe("function");
	});

	it("saveStandaloneSettings calls through to mock", async () => {
		await mockDesktopApi.saveStandaloneSettings({
			windowBounds: { width: 900, height: 800 },
			zoomFactor: 1,
			openTabs: ["/test.md"],
		});
		expect(mockDesktopApi.saveStandaloneSettings).toHaveBeenCalledWith({
			windowBounds: { width: 900, height: 800 },
			zoomFactor: 1,
			openTabs: ["/test.md"],
		});
	});

	it("closeStandaloneWindow calls through to mock", async () => {
		await mockDesktopApi.closeStandaloneWindow();
		expect(mockDesktopApi.closeStandaloneWindow).toHaveBeenCalled();
	});
});

describe("Security: standalone file scoping", () => {
	it("isWithin correctly identifies paths under a root", () => {
		function isWithin(root: string, candidate: string): boolean {
			const relative = require("node:path").relative(root, candidate);
			return (
				relative === "" ||
				(!relative.startsWith("..") &&
					!require("node:path").isAbsolute(relative))
			);
		}

		expect(isWithin("/workspace", "/workspace/notes/file.md")).toBe(true);
		expect(isWithin("/workspace", "/workspace/file.md")).toBe(true);
		expect(isWithin("/workspace", "/workspace")).toBe(true);
		expect(isWithin("/workspace", "/other/file.md")).toBe(false);
		expect(isWithin("/workspace", "/workspace/../escape.md")).toBe(false);
	});
});
