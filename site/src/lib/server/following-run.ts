/**
 * Running the following checks in the Worker: once per copy of the Worker
 * when a reader asks about a page, after an essay is published, and every
 * hour from the scheduled run, which also sends the summary emails that are
 * due (src/lib/server/following.ts explains the checks).
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { followableBuild } from 'virtual:followable-pages';
import {
	checkForUpdates,
	dueDigests,
	essayPages,
	pageDirectory,
	recordDigestSent,
	type CheckResult,
	type PageDirectory
} from './following.ts';
import { updateEmailDelivery } from './following-email.ts';
import { recordNow } from './page-history-run.ts';

export { followableBuild };

/** Every page that can be followed now: the built pages and the published essays. */
export async function currentDirectory(database: D1Database): Promise<PageDirectory> {
	return pageDirectory(followableBuild, await essayPages(database));
}

/** The build this copy of the Worker has already compared, so it compares only once. */
let comparedHere: string | undefined;

/** Compares this build with the last one, once per copy of the Worker. Never throws. */
export async function checkThisBuildOnce(database: D1Database): Promise<void> {
	if (comparedHere === followableBuild.buildHash) return;
	try {
		await checkForUpdates(database, followableBuild, await essayPages(database));
		comparedHere = followableBuild.buildHash;
	} catch (problem) {
		console.error('Could not check followed pages for updates', problem);
	}
}

/** Checks for updates now, for example right after an essay is published. Never throws. */
export async function checkNow(database: D1Database): Promise<CheckResult | undefined> {
	try {
		return await checkForUpdates(database, followableBuild, await essayPages(database));
	} catch (problem) {
		console.error('Could not check followed pages for updates', problem);
		return undefined;
	}
}

export interface ScheduledRunResult {
	check: CheckResult | undefined;
	/** Changes this build brought, for Recent changes (src/lib/server/page-history.ts). */
	history: Awaited<ReturnType<typeof recordNow>>;
	email: 'off' | 'on';
	sent: number;
	failed: number;
}

/** The hourly run: check for updates, record the changes for Recent changes, then send the summary emails that are due. */
export async function scheduledRun(environment: WorkerEnvironment, at = new Date()): Promise<ScheduledRunResult> {
	const database = environment.database;
	const check = await checkNow(database);
	const history = await recordNow(database, environment.sourceDocuments);
	const delivery = updateEmailDelivery(environment);
	if (delivery.kind === 'off') return { check, history, email: 'off', sent: 0, failed: 0 };
	const directory = await currentDirectory(database);
	let sent = 0;
	let failed = 0;
	for (const digest of await dueDigests(database, directory, at)) {
		try {
			// Updates only to pages no longer on the site need no email.
			if (digest.pages.length > 0) {
				await delivery.send(digest);
				sent += 1;
			}
			await recordDigestSent(database, digest, at);
		} catch (problem) {
			failed += 1;
			console.error('Could not send a summary of followed pages', problem);
		}
	}
	return { check, history, email: 'on', sent, failed };
}
