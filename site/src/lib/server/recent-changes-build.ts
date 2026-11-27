/**
 * The build's side of the update card's list of changes
 * (src/lib/recent-changes.ts). Runs in Node during `vite build` only
 * (vite.config.ts).
 *
 * Cloudflare's build (WORKERS_CI is 1) clones only the latest commit, so git
 * names one change. Cloudflare also skips the build of a commit when a newer
 * one arrives while it waits (104 of the 200 builds from Nov. 24 to 27, 2026),
 * so a list carried from build to build misses every pull request whose
 * build was skipped. The build therefore reads the history itself: it clones
 * the public repository's commits (no files, under a megabyte, about a
 * second) into a folder of its own and reads the log from the commit it is
 * building. It also reads the changes the live site already lists in
 * /edition.json and carries them forward, in case GitHub cannot be reached.
 * Both are best effort: if neither can be read, the build goes on with what
 * git gives, and the card says that earlier changes are not listed, rather
 * than the deploy stopping. Checks on GitHub and builds on a computer have
 * the whole history in git and read only that.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { repositoryLink } from '../index.ts';
import { siteAddress } from './site-text-build.ts';
import { keptChanges, readChanges, type Change } from '../recent-changes.ts';

/** Runs git with the given arguments and returns what it prints. */
export type GitRunner = (args: string[]) => string;

const runGit: GitRunner = (args) =>
	execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });

/**
 * On Cloudflare's build, the first-parent log (`%cI%x09%s`, as parseGitLog
 * reads it) of the commit being built, from a commits-only clone of the
 * public repository. Empty anywhere else, or when GitHub cannot be reached.
 */
export function loadRepositoryHistory(environment: Record<string, string | undefined> = process.env, git: GitRunner = runGit): string {
	if (environment.WORKERS_CI !== '1') return '';
	const commit = environment.WORKERS_CI_COMMIT_SHA;
	if (!commit) return '';
	const branch = environment.WORKERS_CI_BRANCH || 'main';
	const folder = mkdtempSync(path.join(tmpdir(), 'site-history-'));
	try {
		git(['clone', '--quiet', '--bare', '--filter=tree:0', '--single-branch', '--branch', branch, '--depth', String(keptChanges), `${repositoryLink}.git`, folder]);
		const log = git(['-C', folder, 'log', '--first-parent', '-n', String(keptChanges), '--format=%cI%x09%s', commit]);
		console.log(`Recent changes: read ${log.split('\n').filter(Boolean).length} commits of history from ${repositoryLink}.`);
		return log;
	} catch (caught) {
		console.warn(`Recent changes: could not read the history from ${repositoryLink}. ${String(caught)}`);
		return '';
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

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
