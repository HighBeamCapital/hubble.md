import { convertFileSrc } from "@tauri-apps/api/core";
import { type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useMemo, useState } from "react";
const DEBUG_IMAGE_VIEW = true;

function dirname(filePath: string): string {
	const normalized = filePath.split("\\").join("/");
	const idx = normalized.lastIndexOf("/");
	if (idx <= 0) return normalized;
	return normalized.slice(0, idx);
}

function normalizePosixPath(path: string): string {
	const parts = path.split("/");
	const stack: string[] = [];
	for (const part of parts) {
		if (part === "" || part === ".") continue;
		if (part === "..") {
			stack.pop();
			continue;
		}
		stack.push(part);
	}
	return `/${stack.join("/")}`;
}

function joinToAbsolutePath(baseDir: string, relativePath: string): string {
	const rel = relativePath.split("\\").join("/");
	if (rel.startsWith("/")) return normalizePosixPath(rel);
	return normalizePosixPath(`${baseDir}/${rel}`);
}

function isResolvableLocalPath(src: string): boolean {
	return !/^(data:|https?:|file:|asset:)/i.test(src);
}

export function ImageNodeView({
	node,
	notePath,
	selected,
}: NodeViewProps & { notePath: string }) {
	const rawSrc = useMemo(() => String(node.attrs.src ?? ""), [node.attrs.src]);
	const [resolvedSrc, setResolvedSrc] = useState(rawSrc);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			if (DEBUG_IMAGE_VIEW) {
				console.info("[imageView] resolve start", {
					rawSrc,
					notePath,
				});
			}
			if (rawSrc.trim().length === 0) {
				if (!cancelled) setResolvedSrc("");
				return;
			}
			if (!isResolvableLocalPath(rawSrc)) {
				if (!cancelled) setResolvedSrc(rawSrc);
				return;
			}
			const absolutePath = joinToAbsolutePath(dirname(notePath), rawSrc);
			const url = convertFileSrc(absolutePath);
			if (DEBUG_IMAGE_VIEW) {
				console.info("[imageView] resolved local src", {
					rawSrc,
					absolutePath,
					url,
				});
			}
			if (!cancelled) setResolvedSrc(url);
		};
		void run();
		return () => {
			cancelled = true;
		};
	}, [rawSrc, notePath]);

	return (
		<NodeViewWrapper as="div" data-drag-handle>
			{resolvedSrc.length > 0 ? (
				<img
					src={resolvedSrc}
					alt={node.attrs.alt || ""}
					title={node.attrs.title || ""}
					className={selected ? "outline-2 outline-blue-400" : ""}
					onLoad={(event) => {
						if (DEBUG_IMAGE_VIEW) {
							console.info("[imageView] load ok", {
								resolvedSrc,
								naturalWidth: event.currentTarget.naturalWidth,
								naturalHeight: event.currentTarget.naturalHeight,
							});
						}
					}}
					onError={(event) => {
						console.error("[imageView] load failed", {
							resolvedSrc,
							currentSrc: event.currentTarget.currentSrc,
						});
					}}
				/>
			) : null}
		</NodeViewWrapper>
	);
}
