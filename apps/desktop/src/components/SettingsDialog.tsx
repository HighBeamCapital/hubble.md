import { Modal } from "@hubble.md/ui";
import type { ReactNode } from "react";

export function SettingsDialog({
	open,
	onOpenChange,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
}) {
	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			title="Settings"
			className="max-w-xl"
		>
			<div className="flex flex-col divide-y divide-border">{children}</div>
		</Modal>
	);
}

export function SettingsSection({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0">
			<div className="flex flex-col gap-0.5">
				<h3 className="text-[13px] font-medium">{title}</h3>
				{description ? (
					<p className="text-xs text-muted-foreground">{description}</p>
				) : null}
			</div>
			<div>{children}</div>
		</section>
	);
}
