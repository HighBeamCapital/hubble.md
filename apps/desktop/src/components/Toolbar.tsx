import { useStoreValue } from "@simplestack/store/react";
import { isMac } from "keymatch";
import { useEffect, useState } from "react";
import MingcuteAddLine from "~icons/mingcute/add-line";
import MingcuteLayoutLeftLine from "~icons/mingcute/layout-left-line";
import { createNote } from "../noteActions";
import { toggleSidebar } from "../store/actions";
import {
	currentPathStore,
	sidebarOpenStore,
	workspacePathStore,
} from "../store/state";
import { Button } from "./ui/button";

const TOOLBAR_INSET = isMac() ? 78 : 8;

function basename(path: string) {
	return path.split(/[\\/]/).pop() ?? path;
}

export function Toolbar({
	scrollContainer,
}: {
	scrollContainer: HTMLDivElement | null;
}) {
	const [showBorder, setShowBorder] = useState(false);
	const workspacePath = useStoreValue(workspacePathStore);
	const sidebarOpen = useStoreValue(sidebarOpenStore);
	const currentPath = useStoreValue(currentPathStore);

	useEffect(() => {
		if (!scrollContainer) {
			setShowBorder(false);
			return;
		}
		const update = () => setShowBorder(scrollContainer.scrollTop > 0);
		update();
		scrollContainer.addEventListener("scroll", update, { passive: true });
		return () => scrollContainer.removeEventListener("scroll", update);
	}, [scrollContainer]);

	const borderClass = sidebarOpen
		? "border-b border-border"
		: showBorder
			? "[border-block-end:1px_dashed_var(--border)]"
			: "border-transparent";

	return (
		<div
			className={`flex h-9 items-center ${borderClass}`}
			data-tauri-drag-region
		>
			<ToolbarActions>
				<div
					className="flex items-center gap-1"
					style={{ paddingInlineStart: TOOLBAR_INSET }}
				>
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={toggleSidebar}
						aria-label="Toggle sidebar"
					>
						<MingcuteLayoutLeftLine className="size-4" />
					</Button>
				</div>
			</ToolbarActions>
			<span
				className="truncate text-center text-xs text-muted-foreground"
				style={{ flex: "1 1 auto" }}
				data-tauri-drag-region
			>
				{currentPath ? basename(currentPath) : "\u00A0"}
			</span>
			<ToolbarActions>
				<div className="flex items-center justify-end">
					{workspacePath && (
						<Button
							variant="ghost"
							size="icon-sm"
							onClick={() => void createNote()}
							aria-label="New Note"
							title="New Note (⌘N)"
						>
							<MingcuteAddLine className="size-4" />
						</Button>
					)}
				</div>
			</ToolbarActions>
		</div>
	);
}

// Equal basis on both sides ensures the title remains horizontally centered
const ACTIONS_BASIS = "114px";

function ToolbarActions({ children }: { children?: React.ReactNode }) {
	return (
		<div
			className="px-2"
			// Hack: shrink 100 allows the side toggles to shrink before the title bar starts to truncate
			style={{ flex: `0 100 ${ACTIONS_BASIS}` }}
		>
			{children}
		</div>
	);
}
