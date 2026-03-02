import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ImageNodeView } from "./ImageNodeView";

export function createImageExtension(notePath: string) {
	return Image.extend({
		addNodeView() {
			return ReactNodeViewRenderer((props) => (
				<ImageNodeView {...props} notePath={notePath} />
			));
		},
	}).configure({
		inline: false,
		allowBase64: true,
	});
}
