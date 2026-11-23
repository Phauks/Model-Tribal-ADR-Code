/**
 * Recording the changes a new build brings, in the Worker: once per copy of
 * the Worker when someone opens Recent changes, and every hour from the
 * scheduled run (src/lib/server/following-run.ts). The database side is
 * src/lib/server/page-history.ts.
 *
 * The build's list of pages is loaded only when it is needed, so other pages
 * the Worker renders do not wait for it.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { HistoryBuild } from '#lib/page-history.ts';
import { directoryOf, recordBuildChanges, type PageDirectory, type RecordResult } from './page-history.ts';

let loaded: { build: HistoryBuild; directory: PageDirectory } | undefined;

async function load() {
	if (!loaded) {
		const { historyBuild } = await import('virtual:page-history');
		loaded = { build: historyBuild, directory: directoryOf(historyBuild) };
	}
	return loaded;
}

/** The pages built with the site, by address. */
export async function builtPages(): Promise<PageDirectory> {
	return (await load()).directory;
}

/** The build this copy of the Worker has already compared, so it compares only once. */
let comparedHere: string | undefined;

/** Compares this build with the last one now. Never throws. */
export async function recordNow(database: D1Database, bucket: R2Bucket | undefined): Promise<RecordResult | undefined> {
	try {
		const { build } = await load();
		const result = await recordBuildChanges(database, bucket, build);
		comparedHere = build.buildHash;
		return result;
	} catch (problem) {
		console.error('Could not record the changes this build brings', problem);
		return undefined;
	}
}

/** Compares this build with the last one, once per copy of the Worker. Never throws. */
export async function recordThisBuildOnce(database: D1Database, bucket: R2Bucket | undefined): Promise<void> {
	const { build } = await load();
	if (comparedHere !== build.buildHash) await recordNow(database, bucket);
}
