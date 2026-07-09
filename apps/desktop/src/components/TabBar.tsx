import type { Tab } from "../store/tabs";

export function TabBar({
	tabs,
	activeIndex,
	onSwitch,
	onClose,
	onOpen,
}: {
	tabs: Tab[];
	activeIndex: number;
	onSwitch: (index: number) => void;
	onClose: (path: string) => void;
	onOpen: () => void;
}) {
	return (
		<div className="flex items-center border-b border-border bg-muted/30">
			<div className="flex min-h-0 flex-1 overflow-x-auto">
				{tabs.map((tab, i) => {
					const name = tab.path.split("/").pop() ?? tab.path;
					const isActive = i === activeIndex;
					return (
						<button
							key={tab.path}
							type="button"
							className={`group flex shrink-0 items-center gap-1.5 border-e border-border px-3 py-1.5 text-xs transition-colors ${
								isActive
									? "bg-background text-foreground"
									: "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
							}`}
							onClick={() => onSwitch(i)}
						>
							<span className="max-w-[160px] truncate">{name}</span>
							<button
								type="button"
								className="ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
								onClick={(e) => {
									e.stopPropagation();
									onClose(tab.path);
								}}
							>
								×
							</button>
						</button>
					);
				})}
			</div>
			<button
				type="button"
				className="flex size-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
				onClick={onOpen}
				title="Open file"
			>
				+
			</button>
		</div>
	);
}
