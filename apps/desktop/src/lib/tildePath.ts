import { desktopApi } from "../desktopApi";

/** Shortens the home dir to ~ for display. Keep stored and copied paths
 * absolute; only rendered text should pass through here. */
export function tildePath(path: string): string {
	const home = desktopApi.homeDir;
	if (path === home) return "~";
	return path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path;
}
