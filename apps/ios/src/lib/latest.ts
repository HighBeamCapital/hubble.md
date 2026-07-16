let token = 0;

export function latest<Args extends unknown[]>(
	fn: (signal: { isStale: () => boolean }, ...args: Args) => Promise<void>,
): (...args: Args) => Promise<void> {
	return async (...args: Args) => {
		const myToken = ++token;
		await fn({ isStale: () => myToken !== token }, ...args);
	};
}
