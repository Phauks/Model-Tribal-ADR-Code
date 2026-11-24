// Saves source records' original links in the Wayback Machine, signed in with
// the project's archive.org keys (site/WAYBACK.md).
//
// The list of links to save is research/wayback-queue.tsv on main, which the
// archive workflow writes. Every minute this Worker checks on the saves it has
// already asked for and asks for a few more, keeping under Save Page Now's
// limit for signed-in accounts (7 a minute, 30,000 a day). What it has done is
// one JSON object in the private bucket. It answers GET /captures.json with
// the captures it has made, which the archive workflow writes into the
// records, so every change to a record still goes through a pull request.
//
// Save Page Now 2 API: https://docs.google.com/document/d/1Nsv52MvSjbLb2PCpHlat0gkzw0EvtSgpKHu4mk0MnrA

import type { R2Bucket } from '@cloudflare/workers-types/index.ts';

interface StoredSecret {
	get(): Promise<string>;
}

interface Env {
	sourceDocuments: R2Bucket;
	archiveOrgAccessKey: StoredSecret;
	archiveOrgSecretKey: StoredSecret;
}

interface Capture {
	service: 'wayback';
	link: string;
	captured: string;
}

interface Entry {
	link: string;
	job?: string;
	asked?: string;
	capture?: Capture;
	problem?: string;
	failed?: string;
	tries?: number;
}

interface Progress {
	queue: [string, string][];
	queueRead?: string;
	records: Record<string, Entry>;
	dailyLimitReached?: string;
}

const QUEUE_LINK = 'https://raw.githubusercontent.com/Phauks/Model-Tribal-ADR-Code/main/research/wayback-queue.tsv';
const PROGRESS_OBJECT = 'wayback/progress.json';
const SAVE_SERVICE = 'https://web.archive.org/save';
const SAVES_EACH_MINUTE = 6;
const STATUS_CHECKS_EACH_MINUTE = 30;
const MINUTES_BETWEEN_QUEUE_READS = 60;
// A job's status is kept for an hour; after that the save is counted as failed.
const MINUTES_BEFORE_GIVING_UP_ON_A_JOB = 50;
const HOURS_BEFORE_SAVING_AGAIN = 24;
const MOST_TRIES = 3;
// An existing capture this recent is returned instead of a new one.
const REUSE_WITHIN = '30d';
const USER_AGENT = 'model-tribal-adr-code-wayback/1.0 (source library archive)';

function hostOf(link: string): string {
	try {
		return new URL(link).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

function hoursSince(stamp: string | undefined, now: Date): number {
	return stamp ? (now.getTime() - Date.parse(stamp)) / 3_600_000 : Infinity;
}

async function readProgress(env: Env): Promise<Progress> {
	const object = await env.sourceDocuments.get(PROGRESS_OBJECT);
	if (!object) return { queue: [], records: {} };
	return (await object.json()) as Progress;
}

async function writeProgress(env: Env, progress: Progress): Promise<void> {
	await env.sourceDocuments.put(PROGRESS_OBJECT, JSON.stringify(progress), {
		httpMetadata: { contentType: 'application/json' }
	});
}

async function readQueue(): Promise<[string, string][]> {
	const response = await fetch(QUEUE_LINK, { headers: { 'User-Agent': USER_AGENT } });
	if (!response.ok) throw new Error(`queue: HTTP ${response.status}`);
	const queue: [string, string][] = [];
	for (const line of (await response.text()).split('\n')) {
		const [key, link] = line.split('\t');
		if (key && link && key !== 'record') queue.push([key.trim(), link.trim()]);
	}
	return queue;
}

async function authorization(env: Env): Promise<string> {
	return `LOW ${await env.archiveOrgAccessKey.get()}:${await env.archiveOrgSecretKey.get()}`;
}

function markFailed(entry: Entry, problem: string, now: Date): void {
	entry.job = undefined;
	entry.asked = undefined;
	entry.failed = now.toISOString();
	entry.problem = problem;
}

async function checkJob(entry: Entry, signIn: string, now: Date): Promise<void> {
	const response = await fetch(`${SAVE_SERVICE}/status/${entry.job}`, {
		headers: { Accept: 'application/json', Authorization: signIn, 'User-Agent': USER_AGENT }
	});
	if (!response.ok) return;
	const answer = (await response.json()) as {
		status?: string;
		status_ext?: string;
		message?: string;
		timestamp?: string;
		original_url?: string;
	};
	if (answer.status === 'success' && answer.timestamp) {
		const captured = answer.original_url || entry.link;
		if (hostOf(captured) !== hostOf(entry.link)) {
			// A login wall or a signed download link: a person checks it.
			markFailed(entry, `the page redirected to ${hostOf(captured)}; check it by hand`, now);
			entry.tries = MOST_TRIES;
			return;
		}
		const stamp = answer.timestamp;
		entry.capture = {
			service: 'wayback',
			link: `https://web.archive.org/web/${stamp}/${captured}`,
			captured: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
		};
		entry.job = undefined;
		entry.problem = undefined;
	} else if (answer.status === 'error') {
		markFailed(entry, answer.status_ext || answer.message || 'save failed', now);
	} else if (hoursSince(entry.asked, now) * 60 > MINUTES_BEFORE_GIVING_UP_ON_A_JOB) {
		markFailed(entry, 'save did not finish within the hour', now);
	}
}

// Returns false when the service says to stop asking for now.
async function askForSave(key: string, entry: Entry, signIn: string, now: Date, progress: Progress): Promise<boolean> {
	const body = new URLSearchParams({ url: entry.link, if_not_archived_within: REUSE_WITHIN, skip_first_archive: '1' });
	const response = await fetch(SAVE_SERVICE, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			Authorization: signIn,
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': USER_AGENT
		},
		body
	});
	entry.tries = (entry.tries ?? 0) + 1;
	if (response.status === 429) {
		entry.tries -= 1;
		return false;
	}
	let answer: { job_id?: string; status?: string; status_ext?: string; message?: string } = {};
	try {
		answer = await response.json();
	} catch {
		markFailed(entry, `save answered HTTP ${response.status}`, now);
		return true;
	}
	if (answer.job_id) {
		entry.job = answer.job_id;
		entry.asked = now.toISOString();
		return true;
	}
	const reason = answer.status_ext || answer.message || `HTTP ${response.status}`;
	if (reason === 'error:user-session-limit' || reason === 'error:too-many-requests') {
		entry.tries -= 1;
		return false;
	}
	if (reason === 'error:too-many-daily-captures' && !answer.message?.includes('this URL')) {
		entry.tries -= 1;
		progress.dailyLimitReached = now.toISOString();
		return false;
	}
	markFailed(entry, reason, now);
	return true;
}

async function work(env: Env): Promise<void> {
	const now = new Date();
	const progress = await readProgress(env);
	if (!progress.queue.length || hoursSince(progress.queueRead, now) * 60 >= MINUTES_BETWEEN_QUEUE_READS) {
		progress.queue = await readQueue();
		progress.queueRead = now.toISOString();
	}
	const signIn = await authorization(env);

	let checks = 0;
	for (const entry of Object.values(progress.records)) {
		if (!entry.job) continue;
		if (checks++ >= STATUS_CHECKS_EACH_MINUTE) break;
		await checkJob(entry, signIn, now);
	}

	if (hoursSince(progress.dailyLimitReached, now) >= 1) {
		let saves = 0;
		for (const [key, link] of progress.queue) {
			if (saves >= SAVES_EACH_MINUTE) break;
			const entry = (progress.records[key] ??= { link });
			entry.link = link;
			if (entry.capture || entry.job || (entry.tries ?? 0) >= MOST_TRIES) continue;
			if (hoursSince(entry.failed, now) < HOURS_BEFORE_SAVING_AGAIN) continue;
			saves += 1;
			if (!(await askForSave(key, entry, signIn, now, progress))) break;
		}
	}
	await writeProgress(env, progress);
}

export default {
	async scheduled(_event: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
		context.waitUntil(work(env));
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (request.method !== 'GET' || (path !== '/captures.json' && path !== '/')) {
			return new Response('Not found', { status: 404 });
		}
		const progress = await readProgress(env);
		const records = Object.entries(progress.records);
		if (path === '/') {
			const captured = records.filter(([, entry]) => entry.capture).length;
			const waiting = records.filter(([, entry]) => entry.job).length;
			const failed = records.filter(([, entry]) => !entry.capture && entry.failed).length;
			return Response.json({ queued: progress.queue.length, captured, waiting, failed, queueRead: progress.queueRead ?? null });
		}
		const captures = records
			.filter(([, entry]) => entry.capture)
			.map(([key, entry]) => ({ key, original_link: entry.link, capture: entry.capture }));
		const problems = records
			.filter(([, entry]) => !entry.capture && entry.problem)
			.map(([key, entry]) => ({ key, original_link: entry.link, problem: entry.problem, tries: entry.tries ?? 0 }));
		return Response.json({ captures, problems });
	}
} satisfies ExportedHandler<Env>;
