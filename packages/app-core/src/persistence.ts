import type { AppState } from "./state";

type Persisted = {
	workspace?: {
		lastOpenedPaths?: Record<string, string>;
	};
};

function readStorage<T>(key: string): T | null {
	if (typeof localStorage === "undefined") return null;
	const raw = localStorage.getItem(key);
	if (!raw) return null;

	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export function createStorage(storageKey: string) {
	function readLastOpenedPaths(): Record<string, string> {
		const persisted = readStorage<Persisted>(storageKey);
		const paths = persisted?.workspace?.lastOpenedPaths;
		return paths && typeof paths === "object" && !Array.isArray(paths)
			? paths
			: {};
	}

	function serialize(state: AppState): Persisted {
		return {
			workspace: {
				lastOpenedPaths: state.workspace.lastOpenedPaths,
			},
		};
	}

	return { storageKey, readLastOpenedPaths, serialize };
}

export function readLastOpenedPaths(
	storageKey: string,
): Record<string, string> {
	return createStorage(storageKey).readLastOpenedPaths();
}

export function serialize(storageKey: string, state: AppState) {
	return createStorage(storageKey).serialize(state);
}

export { createStorage as createStorageFn };
