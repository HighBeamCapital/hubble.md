import {
	stripMarkdownExtension,
	withMarkdownExtension,
} from "@hubble.md/editor";
import type { FileEntry } from "../store/state";
import { joinPath } from "./filePath";

function relativeWorkspacePath(path: string, workspacePath: string | null) {
	if (!workspacePath) return path;
	const prefix = workspacePath.endsWith("/")
		? workspacePath
		: `${workspacePath}/`;
	return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function resolveWikiPath({
	target,
	files,
	workspacePath,
}: {
	target: string;
	files: FileEntry[];
	workspacePath: string | null;
}) {
	const path = target.split("#")[0];
	const pathWithExtension = withMarkdownExtension(path);
	if (pathWithExtension.startsWith("/")) return pathWithExtension;

	const exactPath = workspacePath
		? joinPath(workspacePath, pathWithExtension)
		: pathWithExtension;
	const exactMatch = files.find((file) => file.path === exactPath);
	if (exactMatch) return exactMatch.path;

	const targetStem = stripMarkdownExtension(path);
	const stemMatch = files.find((file) => {
		const relativePath = relativeWorkspacePath(file.path, workspacePath);
		const relativeStem = stripMarkdownExtension(relativePath);
		const fileStem = relativeStem.split(/[\\/]/).pop() ?? relativeStem;
		return relativeStem === targetStem || fileStem === targetStem;
	});
	return stemMatch?.path ?? exactPath;
}
