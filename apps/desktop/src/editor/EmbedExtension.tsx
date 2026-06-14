import { Node } from "@tiptap/core";
import {
	NodeViewWrapper,
	type ReactNodeViewProps,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import alpineRuntime from "alpinejs/dist/cdn.min.js?raw";
import { useEffect, useRef, useState } from "react";
import { desktopApi } from "../desktopApi";
import "./EmbedExtension.css";
import iframeRuntime from "./iframeRuntime.js?raw";

type EmbedAttrs = {
	kind?: "bundle" | "iframe";
	name: string;
	tagName: string;
	props: Record<string, string>;
	src?: string;
};

type EmbedExtensionOptions = {
	workspacePath: string | null;
	filePath: string;
};

type EmbedBundle = {
	mount: (
		shadowRoot: ShadowRoot,
		props: Record<string, string>,
		hubble: HubbleEmbedApi,
	) => undefined | (() => void);
};

type HubbleEmbedApi = {
	listFiles(glob: string): Promise<
		{
			name: string;
			path: string;
			modified_at: number;
			size: number;
		}[]
	>;
};

type IframeRequest = {
	type?: unknown;
	id?: unknown;
	method?: unknown;
	params?: unknown;
};

declare global {
	interface Window {
		__hubbleEmbeds?: Record<string, EmbedBundle>;
	}
}

const EMBED_ELEMENT = "hubble-embed-host";
const loadedBundles = new Map<string, Promise<EmbedBundle>>();
const MIN_IFRAME_HEIGHT = 80;
const MAX_IFRAME_HEIGHT = 4000;
const IFRAME_PADDING = 2;

export function createEmbedExtension(options: EmbedExtensionOptions) {
	return Node.create({
		name: "embed",
		group: "block",
		atom: true,
		selectable: true,
		draggable: true,

		addAttributes() {
			return {
				name: { default: "" },
				tagName: { default: "" },
				props: { default: {} },
				kind: { default: "bundle" },
				src: { default: "" },
			};
		},

		renderHTML({ node }) {
			const attrs = node.attrs as EmbedAttrs;
			if (attrs.kind === "iframe") {
				return ["iframe", { src: attrs.src ?? "" }];
			}
			return [attrs.tagName || `embed-${attrs.name}`, attrs.props ?? {}];
		},

		addNodeView() {
			return ReactNodeViewRenderer((props) => (
				<EmbedNodeView {...props} options={options} />
			));
		},
	});
}

class HubbleEmbedElement extends HTMLElement {
	#cleanup: (() => void) | null = null;
	#renderVersion = 0;

	connectedCallback() {
		if (!this.shadowRoot) {
			this.attachShadow({ mode: "open" });
		}
		void this.renderEmbed();
	}

	disconnectedCallback() {
		this.#cleanup?.();
		this.#cleanup = null;
		this.#renderVersion += 1;
	}

	static get observedAttributes() {
		return ["embed-name", "workspace-path", "props-json"];
	}

	attributeChangedCallback() {
		if (this.isConnected) void this.renderEmbed();
	}

	async renderEmbed() {
		const shadowRoot = this.shadowRoot;
		if (!shadowRoot) return;

		this.#renderVersion += 1;
		const version = this.#renderVersion;
		this.#cleanup?.();
		this.#cleanup = null;
		shadowRoot.replaceChildren();

		const name = this.getAttribute("embed-name") ?? "";
		const workspacePath = this.getAttribute("workspace-path");
		const props = parseProps(this.getAttribute("props-json"));

		if (!workspacePath) {
			renderError(shadowRoot, "Open a workspace to render embeds.");
			return;
		}
		if (!isValidEmbedName(name)) {
			renderError(shadowRoot, `Invalid embed name: ${name || "(empty)"}`);
			return;
		}

		try {
			const bundle = await loadEmbedBundle(workspacePath, name);
			if (version !== this.#renderVersion) return;
			const cleanup = bundle.mount(
				shadowRoot,
				props,
				createHubbleApi(workspacePath),
			);
			this.#cleanup = typeof cleanup === "function" ? cleanup : null;
		} catch (error) {
			if (version !== this.#renderVersion) return;
			renderError(
				shadowRoot,
				error instanceof Error ? error.message : String(error),
			);
		}
	}
}

if (!customElements.get(EMBED_ELEMENT)) {
	customElements.define(EMBED_ELEMENT, HubbleEmbedElement);
}

function EmbedNodeView({
	node,
	options,
}: ReactNodeViewProps & { options: EmbedExtensionOptions }) {
	const attrs = node.attrs as EmbedAttrs;

	if (attrs.kind === "iframe") {
		return (
			<IframeEmbedNodeView
				attrs={attrs}
				filePath={options.filePath}
				workspacePath={options.workspacePath}
			/>
		);
	}

	return (
		<BundleEmbedNodeView attrs={attrs} workspacePath={options.workspacePath} />
	);
}

function BundleEmbedNodeView({
	attrs,
	workspacePath,
}: {
	attrs: EmbedAttrs;
	workspacePath: string | null;
}) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const propsJson = JSON.stringify(attrs.props ?? {});

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		const element = document.createElement(EMBED_ELEMENT);
		element.setAttribute("embed-name", attrs.name);
		if (workspacePath) {
			element.setAttribute("workspace-path", workspacePath);
		}
		element.setAttribute("props-json", propsJson);
		host.replaceChildren(element);
	}, [attrs.name, propsJson, workspacePath]);

	return (
		<NodeViewWrapper className="hubble-embed">
			<div className="hubble-embed-host" ref={hostRef} />
		</NodeViewWrapper>
	);
}

function IframeEmbedNodeView({
	attrs,
	filePath,
	workspacePath,
}: {
	attrs: EmbedAttrs;
	filePath: string;
	workspacePath: string | null;
}) {
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [srcDoc, setSrcDoc] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [height, setHeight] = useState(MIN_IFRAME_HEIGHT);
	const src = attrs.src ?? "";

	useEffect(() => {
		let cancelled = false;
		setSrcDoc("");
		setError(null);
		setHeight(MIN_IFRAME_HEIGHT);

		if (!isValidIframeSrc(src)) {
			setError("Iframe embed src must be a local .html path.");
			return;
		}

		const htmlPath = joinPath(dirname(filePath), src);
		void desktopApi
			.resolvePath(htmlPath)
			.then((absolutePath) => desktopApi.readFileText(absolutePath))
			.then((html) => {
				if (!cancelled) {
					setSrcDoc(injectIframeRuntime(html));
				}
			})
			.catch((error) => {
				if (!cancelled) {
					setError(error instanceof Error ? error.message : String(error));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [filePath, src]);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) return;

		const onMessage = (event: MessageEvent) => {
			if (event.source !== iframe.contentWindow) return;
			const data = event.data as { type?: unknown; height?: unknown } | null;
			if (!data || data.type !== "hubble:embed-height") return;
			const height = Number(data.height);
			if (!Number.isFinite(height)) return;
			const clamped = Math.max(
				MIN_IFRAME_HEIGHT,
				Math.min(MAX_IFRAME_HEIGHT, Math.ceil(height) + IFRAME_PADDING),
			);
			setHeight((current) => (current === clamped ? current : clamped));
		};

		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, []);

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) return;

		const onMessage = (event: MessageEvent) => {
			if (event.source !== iframe.contentWindow) return;
			const request = event.data as IframeRequest | null;
			if (!request || request.type !== "hubble:request") return;
			void handleIframeRequest(request, workspacePath).then((response) => {
				iframe.contentWindow?.postMessage(
					{ ...response, id: request.id, type: "hubble:response" },
					"*",
				);
			});
		};

		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [workspacePath]);

	return (
		<NodeViewWrapper className="hubble-embed">
			{error ? (
				<p className="hubble-embed-error">{error}</p>
			) : (
				<iframe
					ref={iframeRef}
					className="hubble-iframe-embed"
					height={height}
					title={src || "Hubble iframe embed"}
					sandbox="allow-scripts allow-same-origin"
					srcDoc={srcDoc}
					style={{ blockSize: `${height}px` }}
					width="100%"
				/>
			)}
		</NodeViewWrapper>
	);
}

async function loadEmbedBundle(workspacePath: string, name: string) {
	const key = `${workspacePath}\n${name}`;
	const existing = loadedBundles.get(key);
	if (existing) return await existing;

	const loading = loadEmbedBundleUncached(workspacePath, name);
	loadedBundles.set(key, loading);
	try {
		return await loading;
	} catch (error) {
		loadedBundles.delete(key);
		throw error;
	}
}

async function loadEmbedBundleUncached(workspacePath: string, name: string) {
	const bundlePath = joinPath(
		workspacePath,
		".hubble",
		"embeds",
		name,
		"dist",
		"embed.js",
	);
	const before = window.__hubbleEmbeds?.[name];
	const code = await window.desktopApi.readFileText(bundlePath);
	const url = URL.createObjectURL(
		new Blob([code], { type: "text/javascript" }),
	);
	try {
		await import(/* @vite-ignore */ url);
	} finally {
		URL.revokeObjectURL(url);
	}

	const bundle = window.__hubbleEmbeds?.[name];
	if (!bundle || bundle === before || typeof bundle.mount !== "function") {
		throw new Error(`Embed bundle did not register "${name}".`);
	}
	return bundle;
}

function renderError(shadowRoot: ShadowRoot, message: string) {
	const error = document.createElement("p");
	error.className = "hubble-embed-error";
	error.textContent = message;
	shadowRoot.append(error);
}

function createHubbleApi(workspacePath: string): HubbleEmbedApi {
	return {
		listFiles: (glob) => window.desktopApi.listEmbedFiles(workspacePath, glob),
	};
}

function parseProps(raw: string | null): Record<string, string> {
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return {};
		return Object.fromEntries(
			Object.entries(parsed).map(([key, value]) => [key, String(value)]),
		);
	} catch {
		return {};
	}
}

function joinPath(root: string, ...parts: string[]) {
	const normalizedRoot = root.replace(/[\\/]+$/, "");
	return [normalizedRoot, ...parts].join("/");
}

function dirname(filePath: string): string {
	const normalized = filePath.split("\\").join("/");
	const idx = normalized.lastIndexOf("/");
	if (idx <= 0) return normalized;
	return normalized.slice(0, idx);
}

const BLOCKED_IFRAME_SCHEME = /^(file:|data:|javascript:|hubble-asset:)/i;
const LOCAL_IFRAME_SRC = /^(\.{1,2}\/|[^:/\\]+(?:\/|$)).*\.html(?:[?#].*)?$/i;

/**
 * Iframe embeds may point to workspace-local .html files only. Paths are
 * resolved relative to the Markdown file and get Hubble's injected mini-app
 * runtime. Remote URLs, app-internal schemes, inline code, and local absolute
 * paths are rejected.
 */
function isValidIframeSrc(src: string): boolean {
	if (!src.trim()) return false;
	if (BLOCKED_IFRAME_SCHEME.test(src)) {
		return false;
	}
	if (src.startsWith("/") || src.startsWith("\\") || src.startsWith("//")) {
		return false;
	}
	return LOCAL_IFRAME_SRC.test(src);
}

function isValidEmbedName(name: string) {
	return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

async function handleIframeRequest(
	request: IframeRequest,
	workspacePath: string | null,
) {
	try {
		if (!workspacePath) {
			throw new Error("Open a workspace to query files.");
		}
		const params =
			request.params && typeof request.params === "object"
				? (request.params as Record<string, unknown>)
				: {};
		if (request.method === "files.list") {
			const glob = typeof params.glob === "string" ? params.glob : "**/*";
			return {
				ok: true,
				value: await desktopApi.listEmbedFiles(workspacePath, glob),
			};
		}
		if (request.method === "files.read") {
			const path = typeof params.path === "string" ? params.path : "";
			if (!isSafeWorkspacePath(path)) {
				throw new Error("File path must be workspace-relative.");
			}
			const absolutePath = await desktopApi.resolvePath(
				joinPath(workspacePath, path),
			);
			return {
				ok: true,
				value: await desktopApi.readFileText(absolutePath),
			};
		}
		throw new Error(`Unknown Hubble iframe method: ${String(request.method)}`);
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function isSafeWorkspacePath(path: string): boolean {
	if (
		!path ||
		path.startsWith("/") ||
		path.startsWith("\\") ||
		path.includes(":")
	)
		return false;
	return !path
		.split(/[\\/]+/)
		.some((part) => part === "" || part === "." || part === "..");
}

function injectIframeRuntime(html: string): string {
	const runtime = `<style>
html,
body {
  overflow: hidden;
}
</style>
<script>${iframeRuntime}</script>
${alpineRuntime ? `<script defer>${alpineRuntime}</script>` : ""}`;
	if (/<\/body\s*>/i.test(html)) {
		return html.replace(/<\/body\s*>/i, `${runtime}</body>`);
	}
	return `${html}${runtime}`;
}
