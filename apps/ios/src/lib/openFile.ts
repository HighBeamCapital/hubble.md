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
 *
 * Reopening the active file only calls `flush`. The editor already holds the
 * latest content, so a disk read could only be staler and `commit` would reset
 * the pending edits to it.
 */
export async function readFileForOpen({
	path,
	activePath,
	folderPath,
	api,
	flush,
	commit,
}: {
	path: string;
	activePath: string | null;
	folderPath: string | null;
	api: ScopedFileApi;
	flush: () => Promise<void> | void;
	commit: (text: string) => Promise<void> | void;
}): Promise<void> {
	if (path === activePath) {
		await flush();
		return;
	}
	const inFolder = isInFolder(path, folderPath);
	const needsScope = !inFolder;
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
		!isInFolder(activePath, folderPath)
	) {
		try {
			await api.stopScopedAccess(activePath);
		} catch (e) {
			console.error("Failed to release previous file access:", e);
		}
	}
}
