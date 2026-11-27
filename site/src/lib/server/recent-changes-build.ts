/**
 * The build's side of the update card's list of changes
 * (src/lib/recent-changes.ts). Runs in Node during `vite build` only
 * (vite.config.ts).
 *
 * Cloudflare's build (WORKERS_CI is 1) clones only the latest commit, so git
 * names one change. The build therefore reads the changes the live site
 * already lists in /edition.json and carries them forward. This is best
 * effort: if the live site cannot be read, the build goes on with what git
 * gives, and the card says that earlier changes are not listed, rather than
 * the deploy stopping. Checks on GitHub and builds on a computer have the
 * whole history in git and read only that.
 */
import { siteAddress } from './site-text-build.ts';
import { readChanges, type Change } from '../recent-changes.ts';

export async function loadLiveChanges(
	siteFolder: string,
	environment: Record<string, string | undefined> = process.env,
	fetcher: typeof fetch = fetch
): Promise<Change[]> {
	if (environment.WORKERS_CI !== '1') return [];
	const address = `${siteAddress(siteFolder)}/edition.json`;
	for (let attempt = 1; attempt <= 3; attempt++) {
		try {
			const response = await fetcher(address, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
			if (response.status === 404) break;
			if (!response.ok) throw new Error(`${address} answered ${response.status}.`);
			const changes = readChanges(((await response.json()) as { changes?: unknown }).changes);
			console.log(`Recent changes: carrying forward ${changes.length} changes from ${address}.`);
			return changes;
		} catch (caught) {
			console.warn(`Recent changes: try ${attempt} to read ${address} failed. ${String(caught)}`);
			if (attempt < 3) await new Promise((done) => setTimeout(done, attempt * 2000));
		}
	}
	console.warn('Recent changes: building with the changes git names only.');
	return [];
}
