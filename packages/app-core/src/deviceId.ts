const DEVICE_ID_KEY = "hubble.deviceId";

export function ensureDeviceId(): string {
	const existing = localStorage.getItem(DEVICE_ID_KEY);
	if (existing) return existing;
	const fresh = `web-${crypto.randomUUID()}`;
	localStorage.setItem(DEVICE_ID_KEY, fresh);
	return fresh;
}

export function getDeviceId(): string | null {
	return localStorage.getItem(DEVICE_ID_KEY);
}
