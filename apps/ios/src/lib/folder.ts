import type { DirectoryEntry } from "../tauriApi";
import {
	dirname,
	hasMarkdownExtension,
	joinPath,
	normalizePath,
	pathEquals,
	pathInFolder,
	withMarkdownExtension,
} from "./filePath";

const STORAGE_KEY = "hubble:folder-bookmark";

export function loadSavedBookmark(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

export function saveBookmark(bookmark: string | null) {
	try {
		if (bookmark) localStorage.setItem(STORAGE_KEY, bookmark);
		else localStorage.removeItem(STORAGE_KEY);
	} catch {
		/* noop */
	}
}

export function isInFolder(path: string, folderPath: string | null): boolean {
	if (!folderPath) return false;
	// Resolve "." and ".." first so "/root/../Other.md" can't pass the prefix test.
	const normalizedPath = normalizePath(path);
	const normalizedFolder = normalizePath(folderPath);
	return (
		pathEquals(normalizedPath, normalizedFolder) ||
		pathInFolder(normalizedPath, normalizedFolder)
	);
}

/**
 * Keeps the entries a notes browser should show: Markdown Files and Folders,
 * minus hidden folders and the `<note>.assets` folders Hubble manages.
 * Folders sort first, then notes, both in natural order.
 */
export function visibleEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
	const collator = new Intl.Collator(undefined, {
		numeric: true,
		sensitivity: "base",
	});
	return entries
		.filter((entry) =>
			entry.is_dir
				? !entry.name.startsWith(".") && !entry.name.endsWith(".assets")
				: !entry.name.startsWith(".") && hasMarkdownExtension(entry.name),
		)
		.sort((a, b) =>
			a.is_dir === b.is_dir
				? collator.compare(a.name, b.name)
				: a.is_dir
					? -1
					: 1,
		);
}

export function displayName(entry: DirectoryEntry): string {
	return entry.is_dir ? entry.name : entry.name.replace(/\.(md|markdown|mdown)$/i, "");
}

/**
 * Resolves a relative Markdown link (`./other.md`, `../notes/a.md`, or
 * `/root-relative.md`) against the open file. Hrefs are URL-encoded in
 * Markdown, so spaces arrive as `%20`.
 */
export function resolveRelativeLink({
	href,
	currentFilePath,
	folderPath,
}: {
	href: string;
	currentFilePath: string;
	folderPath: string | null;
}): string {
	const raw = href.split("#", 1)[0] ?? href;
	let path = raw;
	try {
		path = decodeURIComponent(raw);
	} catch {
		/* keep the raw href */
	}
	if (path.startsWith("/") && folderPath) {
		return normalizePath(joinPath(folderPath, path.slice(1)));
	}
	const base = dirname(currentFilePath) ?? folderPath ?? "";
	return normalizePath(joinPath(base, path));
}

/**
 * Candidate paths for a wiki link target, closest first. Candidates are
 * normalized and any that resolve outside the folder (`[[../../Other]]`) are
 * dropped.
 */
export function wikiLinkCandidates({
	target,
	currentFilePath,
	folderPath,
}: {
	target: string;
	currentFilePath: string;
	folderPath: string;
}): string[] {
	const name = withMarkdownExtension(target.split("#", 1)[0] ?? target);
	const currentDir = dirname(currentFilePath) ?? folderPath;
	return [joinPath(currentDir, name), joinPath(folderPath, name)]
		.map(normalizePath)
		.filter((candidate) => isInFolder(candidate, folderPath));
}
