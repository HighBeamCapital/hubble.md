import { useCallback, useEffect, useState } from "react";
import { rewriteOwnAssetLinks } from "./lib/assetLinks";
import { displayName, visibleEntries } from "./lib/folder";
import {
	basename,
	dirname,
	hasMarkdownExtension,
	joinPath,
	markdownAssetFolderPath,
	pathEquals,
	withMarkdownExtension,
} from "./lib/filePath";
import { type DirectoryEntry, tauriApi } from "./tauriApi";

const headerBtn =
	"min-w-11 rounded-full px-3 py-1.5 text-sm font-medium text-foreground active:opacity-50 transition";

type Sheet =
	| { kind: "new" }
	| { kind: "actions"; entry: DirectoryEntry }
	| { kind: "rename"; entry: DirectoryEntry }
	| { kind: "delete"; entry: DirectoryEntry };

type Props = {
	folderPath: string;
	dir: string;
	openingPath: string | null;
	onNavigate: (dir: string) => void;
	onOpenNote: (path: string) => void;
	onOpenFile: () => void;
	onChangeFolder: () => void;
	onMessage: (text: string, type: "success" | "error") => void;
};

/** Lists one Folder level at a time, so large iCloud folders stay fast. */
export function FolderBrowser({
	folderPath,
	dir,
	openingPath,
	onNavigate,
	onOpenNote,
	onOpenFile,
	onChangeFolder,
	onMessage,
}: Props) {
	const [entries, setEntries] = useState<DirectoryEntry[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [sheet, setSheet] = useState<Sheet | null>(null);
	const isRoot = pathEquals(dir, folderPath);

	const refresh = useCallback(async () => {
		try {
			setEntries(visibleEntries(await tauriApi.listDirectory(dir)));
			setError(null);
		} catch (e) {
			setError(String(e));
		}
	}, [dir]);

	useEffect(() => {
		setEntries(null);
		void refresh();
	}, [refresh]);

	const createNote = async (name: string) => {
		const path = joinPath(dir, withMarkdownExtension(name));
		if (await tauriApi.pathExists(path)) {
			onMessage(`${basename(path)} already exists`, "error");
			return;
		}
		await tauriApi.writeFileText(path, "");
		setSheet(null);
		onOpenNote(path);
	};

	const renameEntry = async (entry: DirectoryEntry, name: string) => {
		const nextName = entry.is_dir
			? name
			: hasMarkdownExtension(name)
				? name
				: `${name}${entry.name.slice(displayName(entry).length)}`;
		const path = joinPath(dirname(entry.path) ?? dir, nextName);
		if (pathEquals(path, entry.path)) {
			setSheet(null);
			return;
		}
		if (await tauriApi.pathExists(path)) {
			onMessage(`${nextName} already exists`, "error");
			return;
		}
		await tauriApi.renameFile(entry.path, path);
		if (!entry.is_dir && hasMarkdownExtension(entry.path)) {
			if (await moveAssetFolder(entry.path, path)) {
				await rewriteNoteAssetLinks(entry.path, path);
			}
		}
		setSheet(null);
		await refresh();
	};

	// A note's images live in a sibling "<note>.assets" folder; it follows the note.
	const moveAssetFolder = async (fromNote: string, toNote: string) => {
		const from = markdownAssetFolderPath(fromNote);
		const to = markdownAssetFolderPath(toNote);
		if (!from || !to || pathEquals(from, to)) return false;
		if (!(await tauriApi.pathExists(from))) return false;
		if (await tauriApi.pathExists(to)) {
			onMessage(`${basename(to)} already exists; images were not moved`, "error");
			return false;
		}
		await tauriApi.renameFile(from, to);
		return true;
	};

	// Only the renamed note's own links into its moved assets folder change.
	const rewriteNoteAssetLinks = async (fromNote: string, toNote: string) => {
		const content = await tauriApi.readFileText(toNote);
		const next = rewriteOwnAssetLinks({ content, fromNote, toNote });
		if (next !== content) await tauriApi.writeFileText(toNote, next);
	};

	const deleteEntry = async (entry: DirectoryEntry) => {
		await tauriApi.deleteFile(entry.path, { recursive: entry.is_dir });
		if (!entry.is_dir && hasMarkdownExtension(entry.path)) {
			const assets = markdownAssetFolderPath(entry.path);
			if (assets && (await tauriApi.pathExists(assets))) {
				await tauriApi.deleteFile(assets, { recursive: true });
			}
		}
		setSheet(null);
		await refresh();
	};

	const run = (action: () => Promise<void>) => {
		action().catch((e) => onMessage(String(e), "error"));
	};

	return (
		<div className="relative flex h-full flex-col bg-background text-foreground [padding-block-end:env(safe-area-inset-bottom)]">
			<div className="flex items-center gap-1 border-b border-border px-2 [padding-block:calc(env(safe-area-inset-top)+0.5rem)_0.5rem]">
				{isRoot ? (
					<span className="min-w-11" />
				) : (
					<button
						type="button"
						className={headerBtn}
						onClick={() => onNavigate(dirname(dir) ?? folderPath)}
						aria-label="Back"
					>
						‹ Back
					</button>
				)}
				<span className="flex-1 truncate text-center text-sm font-semibold">
					{basename(dir)}
				</span>
				<button
					type="button"
					className={headerBtn}
					onClick={() => setSheet({ kind: "new" })}
					aria-label="New note"
				>
					New
				</button>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
				{error ? (
					<p className="p-6 text-center text-sm text-muted-foreground">
						Couldn't read this folder. {error}
					</p>
				) : entries === null ? (
					<p className="p-6 text-center text-sm text-muted-foreground">
						Loading...
					</p>
				) : entries.length === 0 ? (
					<p className="p-6 text-center text-sm text-muted-foreground">
						No notes here yet
					</p>
				) : (
					<ul>
						{entries.map((entry) => (
							<li
								key={entry.path}
								className="flex items-center border-b border-border/60"
							>
								<button
									type="button"
									className="flex min-h-12 flex-1 items-center gap-3 truncate px-4 text-start active:bg-muted"
									onClick={() =>
										entry.is_dir ? onNavigate(entry.path) : onOpenNote(entry.path)
									}
								>
									<span className="w-5 shrink-0 text-center text-muted-foreground" aria-hidden>
										{entry.is_dir ? "▸" : "≡"}
									</span>
									<span className="flex-1 truncate">{displayName(entry)}</span>
									{openingPath === entry.path && (
										<span className="text-xs text-muted-foreground">Opening...</span>
									)}
								</button>
								<button
									type="button"
									className="min-h-12 px-4 text-muted-foreground active:opacity-50"
									onClick={() => setSheet({ kind: "actions", entry })}
									aria-label={`More actions for ${displayName(entry)}`}
								>
									⋯
								</button>
							</li>
						))}
					</ul>
				)}
				<div className="flex flex-col items-center gap-2 py-6 text-sm">
					<button type="button" className="text-muted-foreground active:opacity-50" onClick={onOpenFile}>
						Open a file outside this folder
					</button>
					<button type="button" className="text-muted-foreground active:opacity-50" onClick={onChangeFolder}>
						Change folder
					</button>
				</div>
			</div>

			{sheet && (
				<BottomSheet onDismiss={() => setSheet(null)}>
					{sheet.kind === "new" && (
						<NameForm
							title="New note"
							initialValue=""
							submitLabel="Create"
							onSubmit={(name) => run(() => createNote(name))}
						/>
					)}
					{sheet.kind === "actions" && (
						<div className="flex flex-col">
							<p className="truncate px-4 pb-2 text-center text-sm text-muted-foreground">
								{displayName(sheet.entry)}
							</p>
							<SheetButton onClick={() => setSheet({ kind: "rename", entry: sheet.entry })}>
								Rename
							</SheetButton>
							<SheetButton
								destructive
								onClick={() => setSheet({ kind: "delete", entry: sheet.entry })}
							>
								Delete
							</SheetButton>
						</div>
					)}
					{sheet.kind === "rename" && (
						<NameForm
							title="Rename"
							initialValue={displayName(sheet.entry)}
							submitLabel="Rename"
							onSubmit={(name) => run(() => renameEntry(sheet.entry, name))}
						/>
					)}
					{sheet.kind === "delete" && (
						<div className="flex flex-col gap-3 px-4">
							<p className="text-center text-sm">
								Delete <strong>{displayName(sheet.entry)}</strong>
								{sheet.entry.is_dir
									? " and everything in it"
									: hasMarkdownExtension(sheet.entry.path)
										? " and its assets folder, if any"
										: ""}
								?
							</p>
							<SheetButton destructive onClick={() => run(() => deleteEntry(sheet.entry))}>
								Delete
							</SheetButton>
						</div>
					)}
				</BottomSheet>
			)}
		</div>
	);
}

function BottomSheet({
	children,
	onDismiss,
}: {
	children: React.ReactNode;
	onDismiss: () => void;
}) {
	return (
		<div className="absolute inset-0 z-10 flex flex-col justify-end">
			<button
				type="button"
				className="absolute inset-0 bg-black/30"
				onClick={onDismiss}
				aria-label="Dismiss"
			/>
			<div className="relative rounded-t-2xl bg-background pt-4 shadow-xl [padding-block-end:calc(env(safe-area-inset-bottom)+1rem)]">
				{children}
				<div className="px-4 pt-2">
					<SheetButton onClick={onDismiss}>Cancel</SheetButton>
				</div>
			</div>
		</div>
	);
}

function SheetButton({
	children,
	destructive,
	onClick,
}: {
	children: React.ReactNode;
	destructive?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`min-h-12 w-full rounded-xl text-base active:bg-muted ${
				destructive ? "text-destructive" : "text-foreground"
			}`}
		>
			{children}
		</button>
	);
}

function NameForm({
	title,
	initialValue,
	submitLabel,
	onSubmit,
}: {
	title: string;
	initialValue: string;
	submitLabel: string;
	onSubmit: (name: string) => void;
}) {
	const [value, setValue] = useState(initialValue);
	const name = value.trim();
	const invalid = !name || /[/\\:]/.test(name) || name.startsWith(".");
	return (
		<form
			className="flex flex-col gap-3 px-4"
			onSubmit={(e) => {
				e.preventDefault();
				if (!invalid) onSubmit(name);
			}}
		>
			<p className="text-center text-sm font-semibold">{title}</p>
			<input
				// biome-ignore lint/a11y/noAutofocus: the sheet exists only to type a name.
				autoFocus
				value={value}
				onChange={(e) => setValue(e.target.value)}
				placeholder="Name"
				autoCapitalize="sentences"
				enterKeyHint="done"
				className="min-h-11 rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-foreground/40"
			/>
			<button
				type="submit"
				disabled={invalid}
				className="min-h-12 rounded-xl bg-foreground text-base font-medium text-background disabled:opacity-40 active:opacity-70"
			>
				{submitLabel}
			</button>
		</form>
	);
}
