/**
 * Brings essay text merged in git into the website copy by itself, so nobody
 * has to press "Bring in" (Trevor, 2026-11-22). The site build bundles each
 * essay file in git (virtual:essay-library, essaysInGit). The first essay
 * page or workspace page a Worker serves after a build compares those texts
 * with the bucket:
 *
 * - git text already saved as some version: nothing to do;
 * - an essay not in the bucket yet: saved as its first version;
 * - no website edits since git's text last came in: saved as a new version;
 * - website edits since then: the two are merged paragraph by paragraph
 *   (src/lib/essays/merge.ts) and the result saved as a new version; when
 *   both changed the same paragraph, nothing is saved and the workspace
 *   shows the conflict for a person to settle.
 *
 * Every save is a new version, so no earlier text is lost, and nothing is
 * published: readers see a change only once someone with full access
 * publishes it (Trevor's choice, 2026-11-22).
 */
import { essaysInGit } from 'virtual:essay-library';
import type { D1Database, R2Bucket, R2Conditional } from '@cloudflare/workers-types/index.ts';
import { mergeThreeWay } from '../essays/merge.ts';
import { SaveConflict, readVersionText, saveVersion, sha256Hex, type VersionRow } from './essays.ts';

export interface GitEssay {
	identifier: string;
	text: string;
	sha256: string;
}

export type GitSyncOutcome =
	| { identifier: string; state: 'current' }
	| { identifier: string; state: 'saved' | 'merged'; version: number }
	| { identifier: string; state: 'conflict'; conflicts: number; latestVersion: number }
	| { identifier: string; state: 'failed'; problem: string };

/** The same normalizing saveVersion applies, so equal texts have equal hashes. */
export function normalizeEssayText(text: string): string {
	return text.normalize('NFC').replace(/\r\n?/g, '\n').replace(/\s*$/, '\n');
}

let gitEssaysOnce: Promise<GitEssay[]> | undefined;

/** The essays in git when the site was built, normalized, with their hashes. */
export function gitEssays(source: Record<string, string> = essaysInGit): Promise<GitEssay[]> {
	const read = async () =>
		Promise.all(
			Object.entries(source).map(async ([identifier, raw]) => {
				const text = normalizeEssayText(raw);
				return { identifier, text, sha256: await sha256Hex(text) };
			})
		);
	if (source !== essaysInGit) return read();
	gitEssaysOnce ??= read();
	return gitEssaysOnce;
}

type VersionFacts = Pick<VersionRow, 'essay_identifier' | 'number' | 'sha256' | 'origin' | 'object_key' | 'note'>;

async function versionFacts(database: D1Database): Promise<Map<string, VersionFacts[]>> {
	const { results } = await database
		.prepare('SELECT essay_identifier, number, sha256, origin, object_key, note FROM essay_versions ORDER BY essay_identifier, number')
		.all<VersionFacts>();
	const byEssay = new Map<string, VersionFacts[]>();
	for (const row of results) {
		const list = byEssay.get(row.essay_identifier) ?? [];
		list.push(row);
		byEssay.set(row.essay_identifier, list);
	}
	return byEssay;
}

/**
 * A merged version holds website edits too, so the git text it came from is
 * kept beside the versions, essays/<id>/git/<first 12 of sha256>.md, and its
 * note names that hash. The next merge starts from that text.
 */
const mergedNote = /git text ([0-9a-f]{12})/;

function gitSnapshotKey(identifier: string, sha256: string): string {
	return `essays/${identifier}/git/${sha256.slice(0, 12)}.md`;
}

/** The git text a version came from: its own text, or for a merged version the kept git text. */
async function gitTextOf(bucket: R2Bucket, row: VersionFacts): Promise<{ sha12: string; text: () => Promise<string> }> {
	const hash = mergedNote.exec(row.note ?? '')?.[1];
	if (!hash) return { sha12: row.sha256.slice(0, 12), text: () => readVersionText(bucket, row) };
	return { sha12: hash, text: () => readVersionText(bucket, { object_key: gitSnapshotKey(row.essay_identifier, hash) }) };
}

async function syncOne(database: D1Database, bucket: R2Bucket, essay: GitEssay, saved: VersionFacts[]): Promise<GitSyncOutcome> {
	const { identifier } = essay;
	const latest = saved.at(-1);
	const lastFromGit = saved.filter((row) => row.origin === 'git').at(-1);
	const base = lastFromGit ? await gitTextOf(bucket, lastFromGit) : null;
	if (latest?.sha256 === essay.sha256 || base?.sha12 === essay.sha256.slice(0, 12)) return { identifier, state: 'current' };
	const save = async (text: string, note: string) =>
		saveVersion(database, bucket, { identifier, text, basedOn: latest?.number ?? null, personIdentifier: null, origin: 'git', note });
	// New here, or no website edits since git's text last came in.
	if (!latest || (lastFromGit?.number === latest.number && !mergedNote.test(latest.note ?? ''))) {
		const result = await save(essay.text, 'From git');
		return { identifier, state: 'saved', version: result.version.number };
	}
	// The git text that last came in is the common ancestor of both sides.
	const ancestor = base ? normalizeEssayText(await base.text()) : '';
	const ours = normalizeEssayText(await readVersionText(bucket, latest));
	const merge = mergeThreeWay(ancestor, ours, essay.text);
	if (!merge.merged) return { identifier, state: 'conflict', conflicts: merge.conflicts, latestVersion: latest.number };
	await bucket.put(gitSnapshotKey(identifier, essay.sha256), essay.text, {
		onlyIf: new Headers({ 'If-None-Match': '*' }) as unknown as R2Conditional,
		httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
		customMetadata: { essay: identifier, gitText: essay.sha256 }
	});
	const result = await save(
		merge.text,
		`From git, merged with the edits made here since version ${lastFromGit?.number ?? 1} (git text ${essay.sha256.slice(0, 12)})`
	);
	return { identifier, state: 'merged', version: result.version.number };
}

/** Compares every essay in git with the bucket and saves what changed (see the top of this file). */
export async function syncEssaysFromGit(database: D1Database, bucket: R2Bucket, source?: Record<string, string>): Promise<GitSyncOutcome[]> {
	const [essays, saved] = await Promise.all([gitEssays(source), versionFacts(database)]);
	const outcomes: GitSyncOutcome[] = [];
	for (const essay of essays) {
		try {
			outcomes.push(await syncOne(database, bucket, essay, saved.get(essay.identifier) ?? []));
		} catch (problem) {
			// Someone saved at the same moment: the next page view tries again.
			if (problem instanceof SaveConflict) {
				outcomes.push({ identifier: essay.identifier, state: 'failed', problem: problem.message });
				continue;
			}
			// A part the live database does not take yet (a migration still to apply) fails the same way each time.
			if (/CHECK constraint/i.test(String(problem))) {
				outcomes.push({ identifier: essay.identifier, state: 'failed', problem: 'The database does not take this part yet; apply the waiting migration.' });
				continue;
			}
			console.error(`Could not bring in ${essay.identifier} from git`, problem);
			outcomes.push({ identifier: essay.identifier, state: 'failed', problem: String(problem) });
		}
	}
	return outcomes;
}

let syncedOnce: Promise<GitSyncOutcome[]> | undefined;

/**
 * Runs the sync once in each Worker instance, which lives within one build.
 * A conflict or failure is tried again by the next instance, and the
 * workspace list asks again each time it loads (`again`).
 */
export function syncEssaysFromGitOnce(database: D1Database, bucket: R2Bucket, again = false): Promise<GitSyncOutcome[]> {
	if (!syncedOnce || again) {
		syncedOnce = syncEssaysFromGit(database, bucket).catch((problem) => {
			console.error('Could not compare essays with git', problem);
			syncedOnce = undefined;
			return [];
		});
	}
	return syncedOnce;
}
