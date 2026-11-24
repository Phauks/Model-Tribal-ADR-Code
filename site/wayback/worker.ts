// Saves source records' original links in the Wayback Machine, signed in with
// the project's archive.org keys (site/WAYBACK.md).
//
// The list of links to save is research/wayback-queue.tsv on main, which the
// archive workflow writes. Every minute this Worker checks on the saves it has
// already asked for and asks for a few more, keeping under Save Page Now's
// limit for signed-in accounts (7 a minute, 30,000 a day). What it has done is
// one JSON object in the private bucket. It answers:
//
//   GET /              a progress page for people
//   GET /status.json   the same counts, for the site's Service checks page
//   GET /captures.json every capture it has made, which the archive workflow
//                      writes into the records, so every change to a record
//                      still goes through a pull request
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
	capturedAt?: string;
	problem?: string;
	failed?: string;
	tries?: number;
}

// The lead author's marks on links the Worker could not save, set on the
// workspace's Wayback captures page (site/src/lib/server/wayback.ts).
interface Mark {
	kind: 'saved-by-hand' | 'failed-by-hand' | 'file-sent';
	at: string;
	link?: string;
	capture?: Capture;
}

interface Progress {
	queue: [string, string][];
	queueRead?: string;
	records: Record<string, Entry>;
	dailyLimitReached?: string;
	lastRun?: string;
	lastError?: string;
	lastErrorAt?: string;
	keysRefused?: string;
}

const QUEUE_LINK = 'https://raw.githubusercontent.com/Phauks/Model-Tribal-ADR-Code/main/research/wayback-queue.tsv';
const PROGRESS_OBJECT = 'wayback/progress.json';
const MARKS_OBJECT = 'wayback/marks.json';
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
// Each call to the Archive gives up after this long, so one slow answer cannot hold up the minute.
const REQUEST_TIMEOUT_MILLISECONDS = 20_000;
const RECENT_ROWS = 25;
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

function message(problem: unknown): string {
	return problem instanceof Error ? problem.message : String(problem);
}

async function readProgress(env: Env): Promise<Progress> {
	const object = await env.sourceDocuments.get(PROGRESS_OBJECT);
	if (!object) return { queue: [], records: {} };
	return (await object.json()) as Progress;
}

async function readMarks(env: Env): Promise<Record<string, Mark>> {
	const object = await env.sourceDocuments.get(MARKS_OBJECT);
	return object ? ((await object.json()) as Record<string, Mark>) : {};
}

async function writeProgress(env: Env, progress: Progress): Promise<void> {
	await env.sourceDocuments.put(PROGRESS_OBJECT, JSON.stringify(progress), {
		httpMetadata: { contentType: 'application/json' }
	});
}

async function readQueue(): Promise<[string, string][]> {
	const response = await fetch(QUEUE_LINK, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS) });
	if (!response.ok) throw new Error(`reading the list of links: HTTP ${response.status}`);
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
		headers: { Accept: 'application/json', Authorization: signIn, 'User-Agent': USER_AGENT },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS)
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
		entry.capturedAt = now.toISOString();
		entry.job = undefined;
		entry.problem = undefined;
	} else if (answer.status === 'error') {
		markFailed(entry, answer.status_ext || answer.message || 'save failed', now);
	} else if (hoursSince(entry.asked, now) * 60 > MINUTES_BEFORE_GIVING_UP_ON_A_JOB) {
		markFailed(entry, 'save did not finish within the hour', now);
	}
}

// Returns false when the service says to stop asking for now.
async function askForSave(entry: Entry, signIn: string, now: Date, progress: Progress): Promise<boolean> {
	const body = new URLSearchParams({ url: entry.link, if_not_archived_within: REUSE_WITHIN, skip_first_archive: '1' });
	const response = await fetch(SAVE_SERVICE, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			Authorization: signIn,
			'Content-Type': 'application/x-www-form-urlencoded',
			'User-Agent': USER_AGENT
		},
		body,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS)
	});
	if (response.status === 401 || response.status === 403) {
		await response.body?.cancel();
		throw new Error(`Save Page Now refused the archive.org keys (HTTP ${response.status}); check ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY in Secrets Store`);
	}
	if (response.status === 429) {
		await response.body?.cancel();
		return false;
	}
	entry.tries = (entry.tries ?? 0) + 1;
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
	progress.lastRun = now.toISOString();
	const problems: string[] = [];
	try {
		if (!progress.queue.length || hoursSince(progress.queueRead, now) * 60 >= MINUTES_BETWEEN_QUEUE_READS) {
			try {
				progress.queue = await readQueue();
				progress.queueRead = now.toISOString();
			} catch (problem) {
				// Keep working from the list read last time.
				problems.push(message(problem));
			}
		}
		const marks = await readMarks(env);
		const signIn = await authorization(env);

		let checks = 0;
		for (const entry of Object.values(progress.records)) {
			if (!entry.job) continue;
			if (checks++ >= STATUS_CHECKS_EACH_MINUTE) break;
			try {
				await checkJob(entry, signIn, now);
			} catch {
				// No answer this minute; the job is checked again next minute.
			}
		}

		if (hoursSince(progress.dailyLimitReached, now) >= 1) {
			let saves = 0;
			for (const [key, link] of progress.queue) {
				if (saves >= SAVES_EACH_MINUTE) break;
				if (marks[key]) continue;
				const entry = (progress.records[key] ??= { link });
				if (entry.link !== link) Object.assign(entry, { link, tries: 0, failed: undefined, problem: undefined, capture: undefined });
				if (entry.capture || entry.job || (entry.tries ?? 0) >= MOST_TRIES) continue;
				if (hoursSince(entry.failed, now) < HOURS_BEFORE_SAVING_AGAIN) continue;
				saves += 1;
				let goOn = true;
				try {
					goOn = await askForSave(entry, signIn, now, progress);
				} catch (problem) {
					if (/refused the archive\.org keys/.test(message(problem))) throw problem;
					// A timeout or a dropped connection: try this link again tomorrow.
					entry.tries = (entry.tries ?? 0) + 1;
					markFailed(entry, `save request failed (${message(problem)})`, now);
				}
				if (!goOn) break;
			}
		}
	} catch (problem) {
		problems.push(message(problem));
		if (/refused the archive\.org keys/.test(message(problem))) progress.keysRefused = now.toISOString();
	}
	if (!problems.some((problem) => /refused the archive\.org keys/.test(problem))) progress.keysRefused = undefined;
	if (problems.length) {
		progress.lastError = problems.join('; ');
		progress.lastErrorAt = now.toISOString();
	}
	await writeProgress(env, progress);
}

type WorkerState = 'not-running' | 'keys-refused' | 'paused-daily-limit' | 'saving' | 'waiting-to-retry' | 'idle';

const stateWords: Record<WorkerState, string> = {
	'not-running': 'Not running',
	'keys-refused': 'Stopped: the Archive refused the keys',
	'paused-daily-limit': 'Paused: daily limit reached',
	saving: 'Saving',
	'waiting-to-retry': 'Waiting to try failed links again',
	idle: 'Idle: nothing left to save'
};

function summary(progress: Progress, marks: Record<string, Mark>, now: Date) {
	const queued = new Set(progress.queue.map(([key]) => key).filter((key) => !marks[key]));
	const entries = Object.entries(progress.records);
	const captured = entries.filter(([, entry]) => entry.capture);
	const waiting = entries.filter(([, entry]) => entry.job).length;
	const gaveUp = entries.filter(([, entry]) => !entry.capture && (entry.tries ?? 0) >= MOST_TRIES);
	const failedRecently = entries.filter(([, entry]) => !entry.capture && entry.failed && (entry.tries ?? 0) < MOST_TRIES).length;
	const left = [...queued].filter((key) => {
		const entry = progress.records[key];
		return !entry || (!entry.capture && (entry.tries ?? 0) < MOST_TRIES);
	}).length;
	const capturedToday = captured.filter(([, entry]) => hoursSince(entry.capturedAt, now) < 24).length;
	const dueNow = [...queued].filter((key) => {
		const entry = progress.records[key];
		return !entry || (!entry.capture && !entry.job && (entry.tries ?? 0) < MOST_TRIES && hoursSince(entry.failed, now) >= HOURS_BEFORE_SAVING_AGAIN);
	}).length;
	const minutesSinceLastRun = progress.lastRun ? Math.round(hoursSince(progress.lastRun, now) * 60) : null;
	// The cron runs every minute even with nothing to do, so a stale last run means the schedule stopped, never that the list is empty.
	const state: WorkerState =
		minutesSinceLastRun === null || minutesSinceLastRun > 5
			? 'not-running'
			: progress.keysRefused
				? 'keys-refused'
				: hoursSince(progress.dailyLimitReached, now) < 1
					? 'paused-daily-limit'
					: waiting > 0 || dueNow > 0
						? 'saving'
						: left > 0
							? 'waiting-to-retry'
							: 'idle';
	return {
		state,
		stateWords: stateWords[state],
		markedByHand: Object.keys(marks).length,
		lastRun: progress.lastRun ?? null,
		minutesSinceLastRun,
		lastError: progress.lastError ?? null,
		lastErrorAt: progress.lastErrorAt ?? null,
		dailyLimitReached: hoursSince(progress.dailyLimitReached, now) < 1,
		queued: queued.size,
		left,
		captured: captured.length,
		capturedLast24Hours: capturedToday,
		waiting,
		failedWillRetry: failedRecently,
		gaveUp: gaveUp.length,
		queueRead: progress.queueRead ?? null,
		recentCaptures: captured
			.sort(([, a], [, b]) => (b.capturedAt ?? '').localeCompare(a.capturedAt ?? ''))
			.slice(0, RECENT_ROWS)
			.map(([key, entry]) => ({ key, link: entry.capture!.link, at: entry.capturedAt ?? null })),
		recentProblems: entries
			.filter(([key, entry]) => !entry.capture && entry.problem && !marks[key])
			.sort(([, a], [, b]) => (b.failed ?? '').localeCompare(a.failed ?? ''))
			.slice(0, RECENT_ROWS)
			.map(([key, entry]) => ({ key, link: entry.link, problem: entry.problem!, tries: entry.tries ?? 0, at: entry.failed ?? null }))
	};
}

function escape(text: string): string {
	return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function page(status: ReturnType<typeof summary>): string {
	const health =
		status.minutesSinceLastRun === null
			? 'It has not run yet.'
			: status.minutesSinceLastRun > 5
				? `It last ran ${status.minutesSinceLastRun} minutes ago, but it runs every minute even with nothing to do, so its schedule has stopped.`
				: `It runs every minute and last ran ${status.minutesSinceLastRun === 0 ? 'this minute' : `${status.minutesSinceLastRun} minute${status.minutesSinceLastRun === 1 ? '' : 's'} ago`}.`;
	const numbers: [string, number][] = [
		['Left to save', status.left],
		['Captured', status.captured],
		['Captured in the last 24 hours', status.capturedLast24Hours],
		['Being saved now', status.waiting],
		['Failed, will try again', status.failedWillRetry],
		['Gave up after three tries', status.gaveUp],
		['Marked by hand', status.markedByHand]
	];
	const rows = (items: { key: string; link: string; note: string }[]) =>
		items.length
			? `<table><tbody>${items.map((item) => `<tr><td><a href="${escape(item.link)}">${escape(item.key)}</a></td><td>${escape(item.note)}</td></tr>`).join('')}</tbody></table>`
			: '<p class="quiet">None yet.</p>';
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<meta name="robots" content="noindex">
<title>Wayback captures</title>
<style>
:root { --text: #1d1d1b; --quiet: #5f5e5a; --line: #d8d6cf; --page: #fbfaf7; --error: #9b2c1f; }
@media (prefers-color-scheme: dark) { :root { --text: #ecebe6; --quiet: #a7a59e; --line: #3b3a36; --page: #1a1a18; --error: #f08a7a; } }
body { margin: 0; padding: 24px 16px 48px; background: var(--page); color: var(--text); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 760px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 32px 0 8px; }
.quiet { color: var(--quiet); }
.error { color: var(--error); }
.state { display: inline-block; margin: 8px 0; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; font-weight: 600; }
.state-not-running, .state-keys-refused { color: var(--error); border-color: currentColor; }
dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 24px 0 0; }
dl div { border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
dt { color: var(--quiet); font-size: 0.875rem; }
dd { margin: 4px 0 0; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
td { border-top: 1px solid var(--line); padding: 6px 8px 6px 0; vertical-align: top; overflow-wrap: anywhere; }
a { color: inherit; }
</style>
</head>
<body>
<main>
<h1>Wayback captures</h1>
<p class="state state-${status.state}">${escape(status.stateWords)}</p>
<p class="quiet">Source library links saved in the Wayback Machine with the project's archive.org keys. ${escape(health)} This page refreshes every minute.</p>
${status.lastError ? `<p class="error">Last problem (${escape(status.lastErrorAt ?? '')}): ${escape(status.lastError)}</p>` : ''}
${status.dailyLimitReached ? '<p class="error">The Archive’s daily limit was reached; saving starts again within the hour.</p>' : ''}
<dl>${numbers.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${value.toLocaleString('en-US')}</dd></div>`).join('')}</dl>
<p class="quiet">${status.queued.toLocaleString('en-US')} links on the list, last read ${escape(status.queueRead ?? 'never')}. Captures reach the records through the archive workflow's captures pull request.</p>
<h2>Latest captures</h2>
${rows(status.recentCaptures.map((item) => ({ key: item.key, link: item.link, note: item.at ?? '' })))}
<h2>Latest problems</h2>
<p class="quiet">To open, save or mark these by hand, or send a file, use Wayback captures in the site's workspace.</p>
${rows(status.recentProblems.map((item) => ({ key: item.key, link: item.link, note: `${item.problem} (try ${item.tries} of ${MOST_TRIES})` })))}
</main>
</body>
</html>`;
}

export default {
	async scheduled(_event: ScheduledController, env: Env, context: ExecutionContext): Promise<void> {
		context.waitUntil(work(env));
	},

	async fetch(request: Request, env: Env): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (request.method !== 'GET' || !['/', '/status.json', '/captures.json'].includes(path)) {
			return new Response('Not found', { status: 404 });
		}
		const [progress, marks] = await Promise.all([readProgress(env), readMarks(env)]);
		const now = new Date();
		if (path === '/') {
			return new Response(page(summary(progress, marks, now)), {
				headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }
			});
		}
		if (path === '/status.json') {
			return Response.json(summary(progress, marks, now), { headers: { 'Cache-Control': 'no-store' } });
		}
		const records = Object.entries(progress.records);
		const captures = [
			...records.filter(([, entry]) => entry.capture).map(([key, entry]) => ({ key, original_link: entry.link, capture: entry.capture })),
			// Captures the lead author made by hand and pasted on the workspace page.
			...Object.entries(marks)
				.filter(([key, mark]) => mark.kind === 'saved-by-hand' && mark.capture && !progress.records[key]?.capture)
				.map(([key, mark]) => ({ key, original_link: mark.link ?? progress.records[key]?.link ?? progress.queue.find(([queued]) => queued === key)?.[1] ?? '', capture: mark.capture }))
		];
		const problems = records
			.filter(([, entry]) => !entry.capture && entry.problem)
			.map(([key, entry]) => ({ key, original_link: entry.link, problem: entry.problem, tries: entry.tries ?? 0 }));
		return Response.json({ captures, problems }, { headers: { 'Cache-Control': 'no-store' } });
	}
} satisfies ExportedHandler<Env>;
