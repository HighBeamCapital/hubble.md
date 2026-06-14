(() => {
	let nextHubbleRequestId = 0;
	const pendingHubbleRequests = new Map();
	const requestHubble = (method, params) =>
		new Promise((resolve, reject) => {
			const id = ++nextHubbleRequestId;
			pendingHubbleRequests.set(id, { resolve, reject });
			parent.postMessage({ type: "hubble:request", id, method, params }, "*");
		});

	window.addEventListener("message", (event) => {
		const data = event.data;
		if (!data || data.type !== "hubble:response") return;
		const pending = pendingHubbleRequests.get(data.id);
		if (!pending) return;
		pendingHubbleRequests.delete(data.id);
		if (data.ok) pending.resolve(data.value);
		else pending.reject(new Error(data.error || "Hubble request failed"));
	});

	window.hubble = {
		files: {
			list: (glob = "**/*") => requestHubble("files.list", { glob }),
			read: (path) => requestHubble("files.read", { path }),
		},
	};

	const send = () => {
		const body = document.body;
		const bodyTop = body ? body.getBoundingClientRect().top : 0;
		const height = body
			? Array.from(body.children).reduce((max, child) => {
					if (!(child instanceof HTMLElement)) return max;
					if (child.tagName === "SCRIPT" || child.tagName === "STYLE")
						return max;
					return Math.max(max, child.getBoundingClientRect().bottom - bodyTop);
				}, 0)
			: 0;
		parent.postMessage({ type: "hubble:embed-height", height }, "*");
	};
	const schedule = () => requestAnimationFrame(send);
	window.addEventListener("load", schedule);
	new ResizeObserver(schedule).observe(document.documentElement);
	if (document.body) new ResizeObserver(schedule).observe(document.body);
	schedule();
})();
