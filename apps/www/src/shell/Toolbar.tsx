import {
	NewNoteButton,
	Toolbar as SharedToolbar,
	ThemeToggle,
} from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import { currentPathStore } from "../store/state";

type Props = {
	onNewNote: () => void;
};

export function Toolbar({ onNewNote }: Props) {
	const currentPath = useStoreValue(currentPathStore);

	return (
		<SharedToolbar
			currentPath={currentPath ?? null}
			sidebarOpen
			platformInset={false}
			rightSlot={
				<>
					<ThemeToggle />
					<NewNoteButton onClick={onNewNote} />
				</>
			}
		/>
	);
}
