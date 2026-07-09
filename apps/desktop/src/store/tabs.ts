import { store } from "@simplestack/store";
import { useStoreValue } from "@simplestack/store/react";
import { useCallback, useEffect } from "react";
import { desktopApi } from "../desktopApi";

export type Tab = {
	path: string;
};

type TabsState = {
	tabs: Tab[];
	activeIndex: number;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let initialFilePath: string | null = null;

export function setInitialFilePath(p: string | null) {
	initialFilePath = p;
}

export function getInitialFilePath(): string | null {
	return initialFilePath;
}

function persistDebounced(state: TabsState) {
	if (saveTimer) clearTimeout(saveTimer);
	saveTimer = setTimeout(() => {
		saveTimer = null;
		void desktopApi.saveStandaloneSettings({
			windowBounds: { width: 900, height: 800 },
			zoomFactor: 1,
			openTabs: state.tabs.filter((t) => t.path !== "").map((t) => t.path),
		});
	}, 300);
}

export const tabsStore = store<TabsState>(
	{ tabs: [], activeIndex: -1 },
	{
		middleware: [
			() => ({
				set: (next) => (setter) => {
					next((current) => {
						const next =
							typeof setter === "function" ? setter(current) : setter;
						persistDebounced(next);
						return next;
					});
				},
			}),
		],
	},
);

export function openTab(filePath: string) {
	const current = tabsStore.get();
	if (filePath !== "") {
		const existingIndex = current.tabs.findIndex((t) => t.path === filePath);
		if (existingIndex !== -1) {
			tabsStore.set({ ...current, activeIndex: existingIndex });
			return;
		}
	}
	tabsStore.set({
		tabs: [...current.tabs, { path: filePath }],
		activeIndex: current.tabs.length,
	});
}

export function openUntitledTab() {
	const current = tabsStore.get();
	tabsStore.set({
		tabs: [...current.tabs, { path: "" }],
		activeIndex: current.tabs.length,
	});
}

export function renameTab(oldPath: string, newPath: string) {
	const current = tabsStore.get();
	const index = current.tabs.findIndex((t) => t.path === oldPath);
	if (index === -1) return;
	const nextTabs = current.tabs.map((t, i) =>
		i === index ? { path: newPath } : t,
	);
	tabsStore.set({ ...current, tabs: nextTabs });
}

export function closeTab(filePath: string) {
	const current = tabsStore.get();
	const index = current.tabs.findIndex((t) => t.path === filePath);
	if (index === -1) return;

	const nextTabs = current.tabs.filter((_, i) => i !== index);
	if (nextTabs.length === 0) {
		tabsStore.set({ tabs: [], activeIndex: -1 });
		void desktopApi.closeStandaloneWindow();
		return;
	}

	const nextActive =
		current.activeIndex >= nextTabs.length
			? nextTabs.length - 1
			: current.activeIndex > index
				? current.activeIndex - 1
				: current.activeIndex;

	tabsStore.set({ tabs: nextTabs, activeIndex: nextActive });
}

export function switchTab(index: number) {
	const current = tabsStore.get();
	if (index < 0 || index >= current.tabs.length) return;
	tabsStore.set({ ...current, activeIndex: index });
}

export function useActiveTab() {
	const { tabs, activeIndex } = useStoreValue(tabsStore);
	return activeIndex >= 0 && activeIndex < tabs.length
		? tabs[activeIndex]
		: null;
}

export function useTabCount() {
	const { tabs } = useStoreValue(tabsStore);
	return tabs.length;
}

export function useTabs() {
	const state = useStoreValue(tabsStore);

	const open = useCallback((path: string) => openTab(path), []);
	const close = useCallback((path: string) => closeTab(path), []);
	const switchTo = useCallback((i: number) => switchTab(i), []);

	useEffect(() => {
		const unsubscribe = desktopApi.onOpenFile((path: string) => {
			openTab(path);
		});
		return unsubscribe;
	}, []);

	return { ...state, open, close, switchTo };
}
