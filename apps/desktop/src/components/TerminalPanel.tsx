import { useResizeSeparator } from "@hubble.md/ui";
import { useStoreValue } from "@simplestack/store/react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useReducer, useRef, useState } from "react";
import { desktopApi } from "../desktopApi";
import { cn } from "../lib/utils";
import {
	clearPendingTerminalCommand,
	setTerminalOpen,
	toggleTerminal,
} from "../store/actions";
import {
	pendingTerminalCommandStore,
	terminalOpenStore,
	viewerStore,
	workspacePathStore,
} from "../store/state";
import "@xterm/xterm/css/xterm.css";
import MingcuteAddLine from "~icons/mingcute/add-line";
import MingcuteCloseLine from "~icons/mingcute/close-line";

type Session = {
	id: string;
	title: string;
};

type TerminalState = {
	sessions: Session[];
	activeSessionId: string | null;
};

type TerminalAction =
	| { type: "activate"; sessionId: string }
	| { type: "add"; session: Session }
	| { type: "remove"; sessionId: string }
	| { type: "rename"; sessionId: string; title: string }
	| { type: "reset" };

const EMPTY_TERMINAL_STATE: TerminalState = {
	sessions: [],
	activeSessionId: null,
};

const MIN_PANEL_HEIGHT = 100;

function clampPanelHeight(height: number) {
	return Math.max(
		MIN_PANEL_HEIGHT,
		Math.min(window.innerHeight - MIN_PANEL_HEIGHT, height),
	);
}

function fallbackActiveSessionId(
	sessions: Session[],
	activeSessionId: string | null,
): string | null {
	if (
		activeSessionId &&
		sessions.some((session) => session.id === activeSessionId)
	) {
		return activeSessionId;
	}
	return sessions[sessions.length - 1]?.id ?? null;
}

function terminalStateReducer(
	state: TerminalState,
	action: TerminalAction,
): TerminalState {
	switch (action.type) {
		case "activate":
			if (!state.sessions.some((session) => session.id === action.sessionId)) {
				return state;
			}
			return {
				...state,
				activeSessionId: action.sessionId,
			};
		case "add":
			return {
				sessions: [...state.sessions, action.session],
				activeSessionId: action.session.id,
			};
		case "remove": {
			const sessions = state.sessions.filter(
				(session) => session.id !== action.sessionId,
			);
			return {
				sessions,
				activeSessionId: fallbackActiveSessionId(
					sessions,
					state.activeSessionId === action.sessionId
						? null
						: state.activeSessionId,
				),
			};
		}
		case "rename":
			return {
				...state,
				sessions: state.sessions.map((session) =>
					session.id === action.sessionId
						? { ...session, title: action.title }
						: session,
				),
			};
		case "reset":
			return EMPTY_TERMINAL_STATE;
	}
}

function cssColorToRgba(color: string): string {
	const canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext("2d");
	if (!ctx) return color;
	ctx.fillStyle = color;
	ctx.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
	return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
}

const LIGHT_THEME = {
	black: "#000000",
	red: "#cd3131",
	green: "#00bc00",
	yellow: "#949800",
	blue: "#0451a5",
	magenta: "#bc05bc",
	cyan: "#0598bc",
	white: "#555555",
	brightBlack: "#666666",
	brightRed: "#cd3131",
	brightGreen: "#14ce14",
	brightYellow: "#b5ba00",
	brightBlue: "#0451a5",
	brightMagenta: "#bc05bc",
	brightCyan: "#0598bc",
	brightWhite: "#a5a5a5",
};

const DARK_THEME = {
	black: "#000000",
	red: "#cd3131",
	green: "#0dbc79",
	yellow: "#e5e510",
	blue: "#2472c8",
	magenta: "#bc3fbc",
	cyan: "#11a8cd",
	white: "#e5e5e5",
	brightBlack: "#666666",
	brightRed: "#f14c4c",
	brightGreen: "#23d18b",
	brightYellow: "#f5f543",
	brightBlue: "#3b8eea",
	brightMagenta: "#d670d6",
	brightCyan: "#29b8db",
	brightWhite: "#e5e5e5",
};

export function TerminalPanel() {
	const isOpen = useStoreValue(terminalOpenStore);
	const workspacePath = useStoreValue(workspacePathStore);
	const pendingTerminalCommand = useStoreValue(pendingTerminalCommandStore);
	const [{ sessions, activeSessionId }, dispatch] = useReducer(
		terminalStateReducer,
		EMPTY_TERMINAL_STATE,
	);
	const [height, setHeight] = useState(256);
	const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
		null,
	);
	const [renameDraft, setRenameDraft] = useState("");
	const [startError, setStartError] = useState<string | null>(null);
	const isInitializingRef = useRef(false);
	const suppressAutoCloseRef = useRef(false);
	const previousSessionCountRef = useRef(0);
	const previousWorkspacePathRef = useRef<string | null | undefined>(undefined);

	const { isResizing, separatorProps } = useResizeSeparator({
		axis: "row",
		label: "Resize terminal panel",
		value: height,
		min: MIN_PANEL_HEIGHT,
		max: () => window.innerHeight - MIN_PANEL_HEIGHT,
		onChange: (nextHeight) => setHeight(clampPanelHeight(nextHeight)),
		getPointerValue: ({ event }) => window.innerHeight - event.clientY,
	});

	useEffect(() => {
		if (sessions.length === 0 && previousSessionCountRef.current > 0) {
			if (suppressAutoCloseRef.current) {
				// Workspace switches clear the old sessions, but the panel should
				// stay open so the new workspace can boot a fresh shell.
				suppressAutoCloseRef.current = false;
			} else {
				isInitializingRef.current = false;
				queueMicrotask(() => setTerminalOpen(false));
			}
		}
		previousSessionCountRef.current = sessions.length;
	}, [sessions.length]);

	useEffect(() => {
		const previousWorkspacePath = previousWorkspacePathRef.current;
		previousWorkspacePathRef.current = workspacePath;

		if (
			previousWorkspacePath === undefined ||
			previousWorkspacePath === workspacePath
		) {
			return;
		}

		if (sessions.length === 0) {
			return;
		}

		suppressAutoCloseRef.current = true;
		isInitializingRef.current = false;

		const sessionIds = sessions.map((session) => session.id);
		dispatch({ type: "reset" });

		void Promise.all(
			sessionIds.map((sessionId) => desktopApi.terminalStop(sessionId)),
		);
	}, [sessions, workspacePath]);

	// Start sessions while the panel is open: a pending chat command gets its
	// own tab; otherwise an empty panel boots a plain shell. sessions.length
	// retries a chat launch that arrived while another session was starting.
	// biome-ignore lint/correctness/useExhaustiveDependencies: startSession is render-local
	useEffect(() => {
		if (!isOpen || !workspacePath || isInitializingRef.current) return;
		if (!pendingTerminalCommand && sessions.length > 0) return;

		isInitializingRef.current = true;
		void (async () => {
			try {
				if (pendingTerminalCommand) {
					await startSession(
						pendingTerminalCommand.split(/\s+/, 1)[0] || "chat",
						{ initialCommand: pendingTerminalCommand },
					);
					clearPendingTerminalCommand();
				} else {
					await startSession("bash");
				}
			} finally {
				isInitializingRef.current = false;
			}
		})();
	}, [isOpen, pendingTerminalCommand, workspacePath, sessions.length]);

	const startSession = async (
		title: string,
		options: { initialCommand?: string } = {},
	) => {
		setStartError(null);
		try {
			while (true) {
				const requestedWorkspacePath = workspacePathStore.get();
				if (!requestedWorkspacePath) return;
				const notePath = viewerStore.get().currentPath ?? undefined;
				const sessionId = await desktopApi.terminalStart(
					requestedWorkspacePath,
					{
						...(notePath ? { notePath } : {}),
						...options,
					},
				);
				if (workspacePathStore.get() === requestedWorkspacePath) {
					dispatch({
						type: "add",
						session: { id: sessionId, title },
					});
					return;
				}
				// The workspace changed while this shell booted. Adopting it would
				// show a shell cwd'd to the old workspace, so drop it and retry.
				void desktopApi.terminalStop(sessionId);
				if (!terminalOpenStore.get()) return;
			}
		} catch (error) {
			console.error("Failed to start terminal session:", error);
			setStartError(
				"Terminal unavailable. The bundled shell module failed to load.",
			);
		}
	};

	const handleCloseSession = async (sessionId: string) => {
		await desktopApi.terminalStop(sessionId);
		dispatch({ type: "remove", sessionId });
	};

	const handleSessionExit = (sessionId: string) => {
		dispatch({ type: "remove", sessionId });
	};

	const beginRename = (session: Session) => {
		setRenamingSessionId(session.id);
		setRenameDraft(session.title);
	};

	const commitRename = () => {
		if (!renamingSessionId) return;
		const title = renameDraft.trim();
		if (title) {
			dispatch({ type: "rename", sessionId: renamingSessionId, title });
		}
		setRenamingSessionId(null);
	};

	return (
		<div
			style={{ height: isOpen ? height : undefined }}
			className={cn(
				"flex flex-col border-t border-border bg-background z-20 relative",
				isResizing && "select-none",
				!isOpen && "hidden",
			)}
		>
			<div
				className="group absolute -top-[5px] left-0 right-0 h-2.5 cursor-row-resize outline-none z-30"
				{...separatorProps}
			>
				<span
					className={cn(
						"absolute left-0 right-0 top-1/2 h-px bg-transparent group-focus:bg-primary",
						isResizing && "bg-primary",
					)}
				/>
			</div>
			{/* Terminal Tabs */}
			<div className="flex items-center h-9 px-2 border-b border-border bg-muted/30 select-none">
				<div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
					{sessions.map((session) => (
						<div
							key={session.id}
							className={cn(
								"group relative flex min-w-20 max-w-48 items-center rounded-md text-xs transition-colors",
								activeSessionId === session.id
									? "bg-background text-foreground border border-border"
									: "text-muted-foreground hover:bg-muted",
							)}
						>
							{renamingSessionId === session.id ? (
								<input
									// biome-ignore lint/a11y/noAutofocus: rename input appears on explicit double click
									autoFocus
									aria-label="Rename terminal session"
									className="w-40 min-w-0 bg-transparent [padding-block:0.25rem] [padding-inline:0.75rem] text-xs outline-none"
									value={renameDraft}
									onFocus={(event) => event.currentTarget.select()}
									onChange={(event) => setRenameDraft(event.target.value)}
									onBlur={commitRename}
									onKeyDown={(event) => {
										if (event.key === "Enter") {
											event.preventDefault();
											commitRename();
										} else if (event.key === "Escape") {
											event.preventDefault();
											setRenamingSessionId(null);
										}
									}}
								/>
							) : (
								<button
									type="button"
									aria-pressed={activeSessionId === session.id}
									className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[inherit] [padding-block:0.25rem] [padding-inline:0.75rem]"
									title="Double click to rename"
									onClick={() =>
										dispatch({ type: "activate", sessionId: session.id })
									}
									onDoubleClick={() => beginRename(session)}
								>
									<span className="truncate flex-1">{session.title}</span>
								</button>
							)}
							{renamingSessionId !== session.id ? (
								<button
									type="button"
									aria-label={`Close terminal session ${session.title}`}
									className={cn(
										"pointer-events-none absolute z-10 -translate-y-1/2 rounded-sm p-0.5 opacity-0 transition-opacity [inset-block-start:50%] [inset-inline-end:0.25rem] group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus:pointer-events-auto focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring",
										activeSessionId === session.id
											? "bg-background"
											: "bg-muted",
									)}
									onClick={() => void handleCloseSession(session.id)}
								>
									<MingcuteCloseLine className="w-3 h-3" />
								</button>
							) : null}
						</div>
					))}
					<button
						type="button"
						className="p-1 ml-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						onClick={() => void startSession("bash")}
						title="New Terminal"
					>
						<MingcuteAddLine className="w-4 h-4" />
					</button>
				</div>
				<div className="flex items-center gap-2 pl-4">
					<button
						type="button"
						className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
						onClick={toggleTerminal}
						title="Close Terminal Panel"
					>
						<MingcuteCloseLine className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Terminal Viewports */}
			<div className="flex-1 relative overflow-hidden bg-background p-2 pb-0">
				{sessions.map((session) => (
					<div
						key={session.id}
						className={cn(
							"absolute inset-2",
							activeSessionId === session.id
								? "z-10 opacity-100"
								: "z-0 opacity-0 pointer-events-none",
						)}
					>
						<TerminalInstance
							onExit={handleSessionExit}
							sessionId={session.id}
							isActive={activeSessionId === session.id}
						/>
					</div>
				))}
				{sessions.length === 0 && (
					<div
						className={cn(
							"flex h-full items-center justify-center text-sm",
							startError ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{startError ?? "No active terminal sessions."}
					</div>
				)}
			</div>
		</div>
	);
}

function TerminalInstance({
	onExit,
	sessionId,
	isActive,
}: {
	onExit: (sessionId: string) => void;
	sessionId: string;
	isActive: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const termRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	// Read via ref so an unstable callback prop can never remount xterm.
	const onExitRef = useRef(onExit);
	onExitRef.current = onExit;

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional
	useEffect(() => {
		if (!containerRef.current) return;

		const term = new Terminal({
			fontSize: 13,
			theme: { background: "transparent" },
			cursorBlink: true,
			allowTransparency: true,
		});

		const updateTheme = () => {
			const style = getComputedStyle(document.body);
			const rawForeground = style.color || "#ececec";
			const rawBackground = style.backgroundColor || "#ffffff";

			const foreground = cssColorToRgba(rawForeground);
			const background = cssColorToRgba(rawBackground);

			// Tailwind 4 outputs font-mono or default-mono-font-family
			let fontFamily = style.getPropertyValue("--font-mono").trim();
			if (!fontFamily) {
				fontFamily = style
					.getPropertyValue("--default-mono-font-family")
					.trim();
			}
			if (!fontFamily) fontFamily = "monospace";

			const isDark = document.documentElement.classList.contains("dark");
			const palette = isDark ? DARK_THEME : LIGHT_THEME;

			term.options.fontFamily = fontFamily;
			term.options.theme = {
				...palette,
				background,
				foreground,
				cursor: foreground,
			};
		};

		updateTheme();

		const themeObserver = new MutationObserver(() => updateTheme());
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(containerRef.current);

		termRef.current = term;
		fitAddonRef.current = fitAddon;

		term.onData((data) => {
			void desktopApi.terminalWrite(sessionId, data);
		});

		term.onResize(({ cols, rows }) => {
			void desktopApi.terminalResize(sessionId, cols, rows);
		});

		const unsubscribeData = desktopApi.onTerminalData(sessionId, (data) => {
			term.write(data);
		});
		const unsubscribeExit = desktopApi.onTerminalExit(sessionId, () => {
			onExitRef.current(sessionId);
		});

		let fitTimeout: ReturnType<typeof setTimeout>;
		const resizeObserver = new ResizeObserver(() => {
			if (isActive && containerRef.current?.offsetParent !== null) {
				clearTimeout(fitTimeout);
				fitTimeout = setTimeout(() => {
					try {
						fitAddon.fit();
					} catch {
						// Fit might throw if container is hidden/0px
					}
				}, 50);
			}
		});

		resizeObserver.observe(containerRef.current);

		// Initial fit
		// ResizeObserver will handle the initial fit

		return () => {
			clearTimeout(fitTimeout);
			unsubscribeData();
			unsubscribeExit();
			resizeObserver.disconnect();
			themeObserver.disconnect();
			term.dispose();
		};
	}, [sessionId]); // Important: only sessionId — anything else here remounts xterm

	useEffect(() => {
		if (
			isActive &&
			fitAddonRef.current &&
			containerRef.current?.offsetParent !== null
		) {
			try {
				fitAddonRef.current.fit();
				termRef.current?.focus();
			} catch {
				//
			}
		}
	}, [isActive]);

	return <div ref={containerRef} className="w-full h-full" />;
}
