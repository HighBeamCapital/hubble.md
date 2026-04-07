import { openUrl } from "@tauri-apps/plugin-opener";
import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { toast } from "sonner";
import { loadPath } from "../store/actions";

function resolveHref(href: string): string | null {
	if (!href) return null;
	try {
		const url = new URL(href);
		const protocol = url.protocol.toLowerCase();
		if (protocol === "http:" || protocol === "https:") return href;
		return null;
	} catch {
		return null;
	}
}

async function followLink(href: string) {
	const resolved = resolveHref(href);
	if (!resolved) {
		toast.error("Cannot open link");
		return;
	}
	try {
		new URL(resolved);
		await openUrl(resolved);
	} catch {
		await loadPath(resolved);
	}
}

function findLinkHrefAtEvent(
	view: EditorView,
	event: MouseEvent,
): string | null {
	const state = view.state;
	const posData = view.posAtCoords({ left: event.clientX, top: event.clientY });
	if (!posData) return null;
	const $pos = state.doc.resolve(posData.pos);
	for (const mark of $pos.marks()) {
		if (mark.type.name === "link" && typeof mark.attrs.href === "string") {
			return mark.attrs.href;
		}
	}
	return null;
}

const MOD_CLASS = "mod-held";

function setModHeld(el: HTMLElement, held: boolean) {
	el.classList.toggle(MOD_CLASS, held);
}

export const LinkClickExtension = Extension.create({
	name: "linkClick",
	addProseMirrorPlugins() {
		const root = this.editor.view.dom;

		const onKey = (e: KeyboardEvent) =>
			setModHeld(root, e.metaKey || e.ctrlKey);
		const onBlur = () => setModHeld(root, false);

		window.addEventListener("keydown", onKey);
		window.addEventListener("keyup", onKey);
		window.addEventListener("blur", onBlur);

		return [
			new Plugin({
				props: {
					handleDOMEvents: {
						mousedown(view, event) {
							if (!event.metaKey && !event.ctrlKey) return false;
							const href = findLinkHrefAtEvent(view, event);
							if (!href) return false;
							event.preventDefault();
							void followLink(href);
							return true;
						},
					},
				},
				destroy() {
					window.removeEventListener("keydown", onKey);
					window.removeEventListener("keyup", onKey);
					window.removeEventListener("blur", onBlur);
					setModHeld(root, false);
				},
			}),
		];
	},
});
