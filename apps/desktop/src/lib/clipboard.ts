import { toast } from "sonner";

export async function copyText(text: string, label: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied`);
	} catch {
		toast.error(`Failed to copy ${label.toLowerCase()}`);
	}
}
