import { openWorkspace } from "../store/actions";

type Props = {
	onOpened: () => void;
};

export function WelcomeScreen({ onOpened }: Props) {
	const handleOpen = async () => {
		await openWorkspace();
		onOpened();
	};

	return (
		<main className="flex h-dvh items-center justify-center bg-background text-foreground">
			<div className="flex w-full max-w-md flex-col gap-4 rounded-md border border-border bg-sidebar p-6">
				<div>
					<h1 className="m-0 text-base font-semibold">Welcome to Hubble</h1>
					<p className="m-0 mt-1 text-xs text-muted-foreground">
						Open a folder to start editing notes.
					</p>
				</div>
				<button
					type="button"
					onClick={handleOpen}
					className="rounded-sm bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
				>
					Open Folder
				</button>
			</div>
		</main>
	);
}
