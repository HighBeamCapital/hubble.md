import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "hubble:theme";

function getStoredTheme(): Theme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === "light" || stored === "dark" || stored === "system")
			return stored;
	} catch {
		/* noop */
	}
	return "system";
}

function storeTheme(theme: Theme): void {
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {
		/* noop */
	}
}

function getSystemDark(): boolean {
	if (typeof window === "undefined") return false;
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeClass(resolved: "light" | "dark"): void {
	document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useTheme() {
	const [theme, setThemeState] = useState<Theme>(getStoredTheme);
	const [systemDark, setSystemDark] = useState(getSystemDark);

	const resolvedTheme: "light" | "dark" =
		theme === "system" ? (systemDark ? "dark" : "light") : theme;

	const setTheme = useCallback((next: Theme) => {
		setThemeState(next);
		storeTheme(next);
	}, []);

	const cycleTheme = useCallback(() => {
		const order: Theme[] = ["light", "dark", "system"];
		const idx = order.indexOf(theme);
		setTheme(order[(idx + 1) % 3]);
	}, [theme, setTheme]);

	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	useEffect(() => {
		applyThemeClass(resolvedTheme);
	}, [resolvedTheme]);

	return { theme, setTheme, cycleTheme, resolvedTheme } as const;
}
