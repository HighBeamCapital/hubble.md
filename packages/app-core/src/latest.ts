export function latest<Args extends unknown[], Result>(
	fn: (signal: { isStale: () => boolean }, ...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
	let token = 0;

	return async (...args: Args) => {
		const myToken = ++token;
		return fn({ isStale: () => myToken !== token }, ...args);
	};
}
