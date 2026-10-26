import { isInFolder } from "./folder";

export type ScopedFileApi = {
	startScopedAccess: (path: string) => Promise<unknown>;
	stopScopedAccess: (path: string) => Promise<unknown>;
	readFileText: (path: string) => Promise<string>;
};

/**
 * Reads `path` for opening while `activePath` stays untouched. After the read
 * succeeds, `commit` switches the active file. Only then is the previous
 * file's scoped access released, so no save can target a released scope. A
 * failed read never calls `commit`, leaves the previous note fully usable,
 * and leaves no scope behind for `path`.
 */
export async function readFileForOpen({
	path,
	activePath,
	folderPath,
	api,
	commit,
}: {
	path: string;
	activePath: string | null;
	folderPath: string | null;
	api: ScopedFileApi;
	commit: (text: string) => Promise<void> | void;
}): Promise<void> {
	const inFolder = isInFolder(path, folderPath);
	// Reopening the active file reuses the access it already holds.
	const needsScope = !inFolder && path !== activePath;
	if (needsScope) await api.startScopedAccess(path);
	let text: string;
	try {
		text = await api.readFileText(path);
	} catch (e) {
		if (needsScope) await api.stopScopedAccess(path).catch(() => {});
		throw e;
	}
	await commit(text);
	if (
		activePath &&
		activePath !== path &&
		!isInFolder(activePath, folderPath)
	) {
		try {
			await api.stopScopedAccess(activePath);
		} catch (e) {
			console.error("Failed to release previous file access:", e);
		}
	}
}
