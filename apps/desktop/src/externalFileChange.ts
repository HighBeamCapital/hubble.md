export type FileAction = "none" | "reload" | "conflict" | "match";

type FileChangeInput = {
	editorContent: string;
	baseline: string;
	diskContent: string;
};

// The Markdown editor doesn't round-trip disk content byte-for-byte (runs of blank
// lines collapse to one, a trailing newline gets added). Comparing raw strings treats
// that cosmetic reformatting as a real edit, which can misclassify Hubble's own writes
// as external changes and drive a reload/save feedback loop. Normalize before
// comparing so only actual content differences are detected.
export function normalizeForComparison(content: string): string {
	return content
		.replace(/\r\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/\s+$/, "");
}

/** Classify what to do when disk content may have diverged from the editor. */
export function classifyFileChange({
	editorContent,
	baseline,
	diskContent,
}: FileChangeInput): FileAction {
	const normalizedDisk = normalizeForComparison(diskContent);
	const normalizedBaseline = normalizeForComparison(baseline);
	const normalizedEditor = normalizeForComparison(editorContent);
	if (normalizedDisk === normalizedBaseline) return "none";
	if (normalizedDisk === normalizedEditor) return "match";
	if (normalizedEditor === normalizedBaseline) return "reload";
	return "conflict";
}
