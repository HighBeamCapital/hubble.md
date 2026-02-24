import { getActiveLinkRange } from "@hubble.md/editor";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Editor } from "@tiptap/core";
import { keymatch } from "keymatch";
import { type RefObject, useEffect, useRef, useState } from "react";
import MingcuteArrowRightFill from "~icons/mingcute/arrow-right-fill";
import { FOCUS_LINK_POPOVER_EVENT } from "./SmartLinkExtension";

export function LinkPopover({
	editor,
	containerRef,
}: {
	editor: Editor | null;
	containerRef: RefObject<HTMLDivElement | null>;
}) {
	const [left, setLeft] = useState(0);
	const [top, setTop] = useState(0);
	const [hrefValue, setHrefValue] = useState("");
	// Escape should dismiss only the current link rollover session.
	// We scope dismissal to the active link range key (`from:to`) so moving
	// out of a link and back in (or to a different link) shows the popover again.
	const [dismissedKey, setDismissedKey] = useState<string | null>(null);
	const [shouldFocusInput, setShouldFocusInput] = useState(false);
	const [activeLink, setActiveLink] = useState<{
		from: number;
		to: number;
		href: string;
	} | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!editor) return;
		const update = () => {
			const link = getActiveLinkRange(editor.state);
			setActiveLink(link);
			if (link) {
				setHrefValue(link.href);
			}
			const container = containerRef.current;
			if (!container || !link) return;
			const coords = editor.view.coordsAtPos(editor.state.selection.from);
			const containerRect = container.getBoundingClientRect();
			const popoverWidth = 300;
			const inlinePadding = 8;
			const desiredLeft = coords.left - containerRect.left;
			const clampedLeft = Math.max(
				inlinePadding,
				Math.min(
					desiredLeft,
					containerRect.width - popoverWidth - inlinePadding,
				),
			);
			const desiredTop = coords.top - containerRect.top - 38;
			setLeft(clampedLeft);
			setTop(
				desiredTop < 0 ? coords.bottom - containerRect.top + 8 : desiredTop,
			);
		};

		update();
		editor.on("selectionUpdate", update);
		editor.on("transaction", update);
		editor.on("focus", update);
		editor.on("blur", update);
		window.addEventListener("resize", update);
		window.addEventListener("scroll", update, true);

		return () => {
			editor.off("selectionUpdate", update);
			editor.off("transaction", update);
			editor.off("focus", update);
			editor.off("blur", update);
			window.removeEventListener("resize", update);
			window.removeEventListener("scroll", update, true);
		};
	}, [editor, containerRef]);
	const activeKey = activeLink ? `${activeLink.from}:${activeLink.to}` : null;
	const isDismissedForCurrent =
		activeKey !== null && dismissedKey === activeKey;

	useEffect(() => {
		if (!activeKey) {
			setDismissedKey(null);
			return;
		}
		if (dismissedKey && dismissedKey !== activeKey) {
			setDismissedKey(null);
		}
	}, [activeKey, dismissedKey]);

	useEffect(() => {
		const onFocusRequest = () => {
			if (isDismissedForCurrent) {
				setDismissedKey(null);
			}
			setShouldFocusInput(true);
		};
		window.addEventListener(
			FOCUS_LINK_POPOVER_EVENT,
			onFocusRequest as EventListener,
		);
		return () => {
			window.removeEventListener(
				FOCUS_LINK_POPOVER_EVENT,
				onFocusRequest as EventListener,
			);
		};
	}, [isDismissedForCurrent]);

	useEffect(() => {
		if (!editor || !activeLink) return;
		const onKeyDown = (event: KeyboardEvent) => {
			const isInputFocused = document.activeElement === inputRef.current;
			const editorFocused = editor.isFocused;
			if (
				isInputFocused &&
				(keymatch(event, "Enter") || keymatch(event, "Escape"))
			) {
				event.preventDefault();
				editor.commands.focus(undefined, { scrollIntoView: false });
				return;
			}

			if (editorFocused && keymatch(event, "Escape")) {
				event.preventDefault();
				setDismissedKey(activeKey);
				return;
			}

			if (keymatch(event, "CmdOrCtrl+Enter")) {
				event.preventDefault();
				void visitLink(activeLink.href);
				return;
			}

			if (keymatch(event, "CmdOrCtrl+Shift+C")) {
				event.preventDefault();
				void navigator.clipboard.writeText(activeLink.href);
			}
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [editor, activeLink, activeKey]);

	useEffect(() => {
		if (!shouldFocusInput) return;
		if (!activeLink || isDismissedForCurrent) return;
		queueMicrotask(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
		setShouldFocusInput(false);
	}, [shouldFocusInput, activeLink, isDismissedForCurrent]);

	if (!editor || !activeLink || isDismissedForCurrent) return null;

	const handleInput = (href: string) => {
		setHrefValue(href);
		const linkType = editor.state.schema.marks.link;
		if (!linkType) return;
		const tr = editor.state.tr.removeMark(
			activeLink.from,
			activeLink.to,
			linkType,
		);
		tr.addMark(activeLink.from, activeLink.to, linkType.create({ href }));
		editor.view.dispatch(tr);
	};

	return (
		<div
			className="link-popover"
			style={{ insetInlineStart: `${left}px`, insetBlockStart: `${top}px` }}
		>
			<div className="link-popover-inner">
				<div className="link-input-container">
					<input
						ref={inputRef}
						type="text"
						value={hrefValue}
						onChange={(event) => handleInput(event.target.value)}
					/>
				</div>
				<button
					type="button"
					aria-label="Visit link"
					onClick={() => {
						void visitLink(activeLink.href);
					}}
				>
					<MingcuteArrowRightFill />
				</button>
			</div>
		</div>
	);
}

async function visitLink(href: string) {
	try {
		const parsed = new URL(href);
		const protocol = parsed.protocol.toLowerCase();
		if (protocol !== "http:" && protocol !== "https:") {
			// TODO: Replace console warnings with app toast notifications.
			console.warn(`[LinkPopover] blocked non-http(s) URL: ${href}`);
			return;
		}
		await openUrl(href);
	} catch {
		// TODO: Replace console warnings with app toast notifications.
		console.warn(`[LinkPopover] invalid URL: ${href}`);
	}
}
