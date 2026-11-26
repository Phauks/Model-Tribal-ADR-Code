/**
 * Keeps answers in the cache of the Cloudflare location that made them (the
 * Cache API), across deploys. Workers Cache (docs/edge-caching.md) starts
 * empty with each new Worker version; map tiles do not change when the site
 * does, so the Worker keeps its own copy of each tile too, and after a deploy
 * a tile is read from here instead of the bucket.
 *
 * The store and the way to finish after answering are given, so the tests
 * can give their own.
 */

/** The parts of a Cache API cache used here (caches.default in a Worker). */
export interface AnswerStore {
	match(key: string): Promise<Response | undefined>;
	put(key: string, response: Response): Promise<void>;
}

/** The location's cache, or undefined where there is none (building the site, local tools). */
export function locationCache(): AnswerStore | undefined {
	const store = (globalThis as { caches?: { default?: AnswerStore } }).caches?.default;
	return store && typeof store.match === 'function' ? store : undefined;
}

/**
 * The kept answer for the key, or a new one from `make`, kept when it is
 * one of `statuses` and does not say no-store or private. The answer's own
 * Cache-Control says how long the location keeps it.
 */
export async function keptAnswer(
	key: string,
	make: () => Promise<Response>,
	options: { store: AnswerStore | undefined; later: (work: Promise<unknown>) => void; statuses: number[] }
): Promise<Response> {
	const { store, later, statuses } = options;
	if (store) {
		try {
			const kept = await store.match(key);
			if (kept) return kept;
		} catch (problem) {
			console.error('A kept answer could not be read', key, problem);
		}
	}
	const made = await make();
	if (!store || !statuses.includes(made.status)) return made;
	if (/\b(?:private|no-store)\b/i.test(made.headers.get('cache-control') ?? '') || made.headers.has('set-cookie')) return made;
	later(store.put(key, made.clone()));
	return made;
}
