import { Button } from "@hubble.md/ui";
import { useEffect, useState } from "react";
import MingcuteCheckCircleFill from "~icons/mingcute/check-circle-fill";
import MingcuteCopy2Line from "~icons/mingcute/copy-2-line";
import MingcuteRightLine from "~icons/mingcute/right-line";
import { copyText } from "../lib/clipboard";
import { dirname } from "../lib/filePath";
import { hasHubbleSkillsInstalled } from "../lib/hubbleSkills";
import { tildePath } from "../lib/tildePath";

const INSTALL_COMMAND = "npx skills add bholmesdev/hubble-skills -g";
const SKILLS_POLL_INTERVAL_MS = 2000;

function buildPrompt(filePath: string): string {
	return `Build a Hubble HTML app at ${filePath} that...`;
}

export function HtmlAppEmptyState({
	path,
	workspacePath,
}: {
	path: string;
	workspacePath: string | null;
}) {
	const [skillsInstalled, setSkillsInstalled] = useState(false);
	// Before install the setup section is always expanded with no toggle. Once
	// the skills are detected it collapses to just the check, with a disclosure
	// to reveal the command again.
	const [setupExpandedOverride, setSetupExpandedOverride] = useState<
		boolean | null
	>(null);
	const setupExpanded = skillsInstalled
		? (setupExpandedOverride ?? false)
		: true;
	// Without a workspace, treat the file's folder as the notes folder so the
	// prompt stays sensible and detection still covers the global skill dirs.
	const notesPath = workspacePath ?? dirname(path) ?? path;

	// Poll while visible and not yet installed, so running the install command
	// reflects here without refocusing the window (e.g. from the in-app
	// terminal). Detection is a handful of readdirs, and polling stops as soon
	// as the skills are found.
	useEffect(() => {
		if (skillsInstalled) return;
		let active = true;
		const check = () => {
			void hasHubbleSkillsInstalled(notesPath).then((installed) => {
				if (!active || !installed) return;
				setSkillsInstalled(true);
				setSetupExpandedOverride(null);
			});
		};
		check();
		const interval = setInterval(check, SKILLS_POLL_INTERVAL_MS);
		return () => {
			active = false;
			clearInterval(interval);
		};
	}, [notesPath, skillsInstalled]);

	return (
		<div className="flex h-full items-center justify-center overflow-y-auto p-6">
			<div className="flex w-full max-w-lg flex-col gap-5">
				<div className="flex flex-col gap-1.5">
					<h2 className="text-xl font-semibold tracking-tight text-foreground">
						Build an HTML App
					</h2>
					<p className="text-sm text-muted-foreground">
						HTML Apps are live, interactive views of your notes: dashboards,
						trackers, indexes, anything you can describe. They can read and
						update your notes, and your agent builds one right into this file.
					</p>
				</div>

				<Section
					step="1"
					title="Install the skills"
					indicator={
						skillsInstalled ? (
							<span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
								<MingcuteCheckCircleFill className="size-3.5" />
								Skills installed
							</span>
						) : null
					}
					expanded={setupExpanded}
					onToggle={
						skillsInstalled
							? () => setSetupExpandedOverride(!setupExpanded)
							: undefined
					}
				>
					<CopyBlock
						value={INSTALL_COMMAND}
						label="Command"
						ariaLabel="Copy install command"
					/>
				</Section>

				<Section step="2" title="Prompt your agent">
					<CopyBlock
						value={buildPrompt(path)}
						display={buildPrompt(tildePath(path))}
						label="Prompt"
						ariaLabel="Copy prompt"
						multiline
					/>
				</Section>
			</div>
		</div>
	);
}

function Section({
	step,
	title,
	indicator,
	expanded,
	onToggle,
	children,
}: {
	step: string;
	title: string;
	indicator?: React.ReactNode;
	expanded?: boolean;
	onToggle?: () => void;
	children: React.ReactNode;
}) {
	const header = (
		<>
			<span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
				{step}
			</span>
			<span className="text-xs font-medium text-foreground">{title}</span>
			<span className="ms-auto inline-flex items-center gap-2">
				{indicator}
				{onToggle ? (
					<MingcuteRightLine
						className={`size-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
					/>
				) : null}
			</span>
		</>
	);

	return (
		<div className="flex flex-col gap-2">
			{onToggle ? (
				<button
					type="button"
					aria-expanded={expanded}
					onClick={onToggle}
					className="flex items-center gap-2 text-start"
				>
					{header}
				</button>
			) : (
				<div className="flex items-center gap-2">{header}</div>
			)}
			{onToggle && !expanded ? null : children}
		</div>
	);
}

function CopyBlock({
	value,
	display,
	label,
	ariaLabel,
	multiline,
}: {
	value: string;
	display?: string;
	label: string;
	ariaLabel: string;
	multiline?: boolean;
}) {
	return (
		<div className="flex items-start gap-2 rounded-sm border border-border bg-muted/40 p-2">
			<code
				className={
					multiline
						? "min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground"
						: "min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs text-foreground"
				}
			>
				{display ?? value}
			</code>
			<Button
				size="icon-sm"
				variant="ghost"
				aria-label={ariaLabel}
				onClick={() => void copyText(value, label)}
			>
				<MingcuteCopy2Line />
			</Button>
		</div>
	);
}
