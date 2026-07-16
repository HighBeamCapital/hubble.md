import {
	NewNoteButton,
	Toolbar as SharedToolbar,
	ThemeToggle,
} from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import { currentPathStore, sidebarOpenStore } from "../store/state";
import { toggleSidebar } from "../store/actions";

type Props = {
	onNewNote: () => void;
};

export function Toolbar({ onNewNote }: Props) {
	const currentPath = useStoreValue(currentPathStore);
	const sidebarOpen = useStoreValue(sidebarOpenStore);

	return (
		<SharedToolbar
			currentPath={currentPath ?? null}
			sidebarOpen={sidebarOpen}
			platformInset={false}
			leftSlot={
				<button
					type="button"
					onClick={toggleSidebar}
					className="flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-sidebar-accent"
					aria-label="Toggle sidebar"
				>
					<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
						<path d="M2 4h12M2 8h12M2 12h12" />
					</svg>
				</button>
			}
			rightSlot={
				<>
					<ThemeToggle />
					<NewNoteButton onClick={onNewNote} />
				</>
			}
		/>
	);
}
