export type FileAction = "none" | "reload" | "conflict" | "match";

type FileChangeInput = {
	editorContent: string;
	baseline: string;
	diskContent: string;
};

export function classifyFileChange({
	editorContent,
	baseline,
	diskContent,
}: FileChangeInput): FileAction {
	if (diskContent === baseline) return "none";
	if (diskContent === editorContent) return "match";
	if (editorContent === baseline) return "reload";
	return "conflict";
}
