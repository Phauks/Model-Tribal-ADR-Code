/**
 * Purges answers that Cloudflare's edge keeps for the Worker (Workers Cache;
 * docs/edge-caching.md). tools/edge-cache-worker.js names each kept answer
 * with a tag; a purge by tag reaches every Cloudflare location at once, and
 * needs no key or token, since a Worker may purge its own cache.
 *
 * Deploys need no purge: each Worker version keeps its answers apart.
 */
// A namespace import, so a runtime without Workers Cache (local tools) still loads this file.
import * as workers from 'cloudflare:workers';

/** The tags tools/edge-cache-worker.js gives kept answers. */
export type EdgeCacheTag = 'record-pages' | 'map-tiles' | 'nation-restrictions';

/**
 * Purges every kept answer with one of the tags. A failure is logged, not
 * thrown: the answers it would have purged are kept for at most the time
 * their rule allows (five minutes for the search files).
 */
export async function purgeEdgeCache(tags: EdgeCacheTag[]): Promise<boolean> {
	try {
		const cache = workers.cache;
		if (!cache?.purge) return false;
		const result = await cache.purge({ tags });
		if (!result.success) console.error('The edge cache was not purged', tags, result.errors);
		return result.success;
	} catch (problem) {
		console.error('The edge cache was not purged', tags, problem);
		return false;
	}
}
