import { MarkdownSourceEditor } from "@hubble.md/ui";

export default function StandaloneEditor({
	path,
	initialMarkdown,
	onLocalChange,
	onSave,
}: {
	path: string;
	initialMarkdown: string;
	onLocalChange: (path: string, markdown: string) => void;
	onSave: (path: string, markdown: string) => void | Promise<void>;
}) {
	return (
		<div className="font-sans bg-card h-full min-h-0 flex sizing-none overflow-hidden">
			<MarkdownSourceEditor
				path={path}
				initialMarkdown={initialMarkdown}
				onLocalChange={onLocalChange}
				onSave={onSave}
			/>
		</div>
	);
}
