import { dirname, joinPath, normalizePath } from "./filePath";

export function stripLinkAnchor(href: string): string {
	return href.split("#", 1)[0] ?? href;
}

export function resolveRelativeLinkPath({
	href,
	currentFilePath,
	workspacePath,
}: {
	href: string;
	currentFilePath: string;
	workspacePath: string | null;
}) {
	const path = stripLinkAnchor(href);
	if (path.startsWith("/")) {
		const root = workspacePath ?? "/";
		return normalizePath(joinPath(root, path.slice(1)));
	}
	const currentDir = dirname(currentFilePath) ?? workspacePath ?? "";
	return normalizePath(joinPath(currentDir, path));
}
