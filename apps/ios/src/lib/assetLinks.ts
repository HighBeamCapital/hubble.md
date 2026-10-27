import {
	dirname,
	joinPath,
	markdownAssetFolderPath,
	normalizePath,
	pathEquals,
	pathInFolder,
	replacePathPrefix,
} from "./filePath";

function splitSuffix(destination: string): { path: string; suffix: string } {
	const index = destination.search(/[?#]/);
	if (index < 0) return { path: destination, suffix: "" };
	return { path: destination.slice(0, index), suffix: destination.slice(index) };
}

function isLocalRelative(path: string): boolean {
	if (!path || /^[\\/]/.test(path)) return false;
	return !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path);
}

function rewriteDestinations(
	content: string,
	rewrite: (destination: string) => string,
): string {
	return content
		.replace(
			/(!?\[[^\]\n]*\]\()([^)\n]+)(\))/g,
			(match, open, destination, close) => {
				const trimmed = destination.trim();
				const titled = trimmed.match(
					/^(\S+)(\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))$/,
				);
				const next = `${rewrite(titled?.[1] ?? trimmed)}${titled?.[2] ?? ""}`;
				return next === trimmed ? match : `${open}${next}${close}`;
			},
		)
		.replace(
			/\b(src|href)=(["'])([^"']+)\2/gi,
			(match, attr, quote, destination) => {
				const next = rewrite(destination);
				return next === destination ? match : `${attr}=${quote}${next}${quote}`;
			},
		);
}

/**
 * Rewrites a renamed note's own links into its "<note>.assets" folder after
 * the folder moved with the note. Scoped like desktop updateMovedLinks with
 * the asset folder in the moved set: only links that resolve into the old
 * assets folder change. The note stays in the same directory.
 */
export function rewriteOwnAssetLinks({
	content,
	fromNote,
	toNote,
}: {
	content: string;
	fromNote: string;
	toNote: string;
}): string {
	const fromAssets = markdownAssetFolderPath(fromNote);
	const toAssets = markdownAssetFolderPath(toNote);
	const sourceDir = dirname(fromNote);
	if (!fromAssets || !toAssets || !sourceDir || pathEquals(fromAssets, toAssets))
		return content;
	const from = normalizePath(fromAssets);
	const to = normalizePath(toAssets);
	const noteDir = normalizePath(dirname(toNote) ?? sourceDir);
	return rewriteDestinations(content, (destination) => {
		const { path, suffix } = splitSuffix(destination);
		if (!isLocalRelative(path)) return destination;
		const target = normalizePath(joinPath(sourceDir, path));
		if (!pathEquals(target, from) && !pathInFolder(target, from))
			return destination;
		const moved = replacePathPrefix(target, from, to);
		if (!pathInFolder(moved, noteDir)) return destination;
		return `${moved.slice(noteDir.replace(/\/+$/, "").length + 1)}${suffix}`;
	});
}
