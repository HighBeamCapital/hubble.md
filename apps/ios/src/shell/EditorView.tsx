import { EditorView as SharedEditorView } from "@hubble.md/ui";
import {
	loadPath,
	savePathContent,
	updateEditorContent,
} from "../store/actions";
import { handleImagePaste, handleImageDrop } from "../lib/handleImageUpload";

type Props = {
	path: string;
	initialMarkdown: string;
};

export function EditorView({ path, initialMarkdown }: Props) {
	return (
		<SharedEditorView
			path={path}
			initialMarkdown={initialMarkdown}
			onPaste={(editor, event) => handleImagePaste({ editor, event })}
			onDrop={(editor, event) => handleImageDrop({ editor, event })}
			onLocalChange={updateEditorContent}
			onSave={savePathContent}
			onOpenExternalLink={(href) => {
				import("@tauri-apps/plugin-shell").then(({ open }) => {
					open(href);
				});
			}}
			onOpenWikiLink={() => {}}
		/>
	);
}
