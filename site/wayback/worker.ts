// Saves source records' original links in the Wayback Machine, signed in with
// the project's archive.org keys (site/WAYBACK.md).
//
// The list of links to save is research/wayback-queue.tsv on main, which the
// archive workflow writes, most important links first. Every minute this Worker
// checks on the saves it has already asked for, looks up a batch of links in
// the Archive's capture index (a link the Archive already holds a recent enough
// copy of takes that copy and never uses up a save), and asks Save Page Now for
// a few more, keeping under its limit for signed-in accounts (7 a minute, so at
// most about 10,000 a day, below its 30,000 a day). What it has done is one JSON
// object in the private bucket. It answers:
//
//   GET /              a progress page for people
//   GET /status.json   the same counts, for the site's Service checks page
//   GET /captures.json every capture it has made, which the archive workflow
//                      writes into the records, so every change to a record
//                      still goes through a pull request
//
// Save Page Now 2 API: https://docs.google.com/document/d/1Nsv52MvSjbLb2PCpHlat0gkzw0EvtSgpKHu4mk0MnrA

import type { R2Bucket } from '@cloudflare/workers-types/index.ts';

interface Env {
	sourceDocuments: R2Bucket;
	// Worker secrets, set on this Worker in the Cloudflare dashboard (site/WAYBACK.md).
	ARCHIVE_ORG_ACCESS_KEY?: string;
	ARCHIVE_ORG_SECRET_KEY?: string;
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
	/** When the Archive's capture index was last asked for an older capture after a failed save. */
	lookedUp?: string;
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
	/** Save requests sent each minute (keyed like 2026-11-24T18:42, UTC) over the last 24 hours. */
	requestsByMinute?: Record<string, number>;
	/** When the Archive last asked us to stop for a while, and why. */
	pausedUntil?: string;
	/** The last RETRY_ROUND this progress has taken. */
	retryRound?: number;
	pauseReason?: string;
	/** Until when the capture index asked us to stop looking links up (HTTP 429 or 5xx). */
	lookupsPausedUntil?: string;
	/** Save Page Now's own count of our capture sessions, read at the start of the last run that saved. */
	sessions?: { available: number; processing: number; at: string };
}

const QUEUE_LINK = 'https://raw.githubusercontent.com/Phauks/Tribal-Law-Project/main/research/wayback-queue.tsv';
const PROGRESS_OBJECT = 'wayback/progress.json';
const MARKS_OBJECT = 'wayback/marks.json';
const SAVE_SERVICE = 'https://web.archive.org/save';
// How many capture sessions the account has free and how many are working (the API document below).
const SESSION_SERVICE = 'https://web.archive.org/save/status/user';
const CAPTURE_INDEX = 'https://web.archive.org/cdx/search/cdx';
// Save Page Now's answer when a capture newer than REUSE_WITHIN already exists, such as
// "The same snapshot had been made 569 hours, 49 minutes ago. You can make new capture of this URL after 720 hours."
// That capture is what we want, so it is looked up and taken instead of counted as a failure.
const SAME_SNAPSHOT = /same snapshot had been made/i;
const SAVES_EACH_MINUTE = 6;
// Save Page Now's limits for a signed-in account (the API document above).
const ARCHIVE_SAVES_EACH_MINUTE = 7;
const ARCHIVE_SAVES_EACH_DAY = 30_000;
const STATUS_CHECKS_EACH_MINUTE = 30;
const MINUTES_BETWEEN_QUEUE_READS = 60;
// A job's status is kept for an hour; after that the save is counted as failed.
const MINUTES_BEFORE_GIVING_UP_ON_A_JOB = 50;
const HOURS_BEFORE_SAVING_AGAIN = 24;
const MOST_TRIES = 3;
// An existing capture this recent is returned instead of a new one.
const REUSE_WITHIN = '30d';
// When a save fails, the newest capture the Archive already holds is taken instead: of any age on
// these hosts, whose documents do not change (as scripts/find_archived_copies.py does), and from the
// last year elsewhere (as the archive workflow's --reuse-days 365 does). The Library of Congress often
// answers Save Page Now with "not found" or never finishes, though its United States Reports pages exist.
const FIXED_DOCUMENT_HOSTS = ['federalregister.gov', 'govinfo.gov', 'loc.gov', 'treaties.okstate.edu'];
const OLDER_CAPTURE_DAYS = 365;
// Every link is looked up in the capture index before its first save, and again after each failed
// save. On 2026-11-27 a sample of the queue found a usable copy already held for 8 of 8 links on
// oha.doi.gov, nigc.gov and treaties.okstate.edu, so most links need no save at all. The index is a
// separate service from Save Page Now and does not count against its limits.
// At 20 a minute, 4 at once, the index answered HTTP 429 after about six minutes (2026-11-27 06:05 UTC).
const LOOKUPS_EACH_MINUTE = 12;
const LOOKUPS_AT_ONCE = 2;
const STATUS_CHECKS_AT_ONCE = 6;
// When the index answers HTTP 429 or a server error, lookups stop this long; saves go on without them.
const MINUTES_LOOKUPS_PAUSE = 5;
// No new call to the Archive starts this long after a run began, so a run ends before the next
// minute's run reads the progress object (each call itself gives up after REQUEST_TIMEOUT_MILLISECONDS).
const RUN_BUDGET_MILLISECONDS = 35_000;
// When each round of saves starts, counted from the start of the run.
const SAVE_ROUNDS_MILLISECONDS = [0, 22_000];
// Hosts whose pages are plain HTML files: Save Page Now is told to skip running their scripts, which
// makes each capture shorter and frees its session sooner ("js_behavior_timeout=0", the API document).
const STATIC_PAGE_HOSTS = ['static.case.law'];
// Hosts that serve a site's own uploaded files (Squarespace, Wix, Divio, Revize, Dropbox, Higher Logic,
// CivicLive): a save that ends on one of them captured the same document, not a login wall.
const FILE_HOSTS = ['squarespace.com', 'filesusr.com', 'divio-media.com', 'revize.com', 'dropboxusercontent.com', 'higherlogicdownload.s3.amazonaws.com', 'civiclive.com'];
// Raising this tries once more every link given up on (round 1: the older-capture lookup and file
// hosts above, 2026-11-27).
const RETRY_ROUND = 1;
// Each call to the Archive gives up after this long, so one slow answer cannot hold up the minute.
const REQUEST_TIMEOUT_MILLISECONDS = 20_000;
const LOOKUP_TIMEOUT_MILLISECONDS = 15_000;
const RECENT_ROWS = 25;
const USER_AGENT = 'model-tribal-adr-code-wayback/1.0 (source library archive)';

function hostOf(link: string): string {
	try {
		return new URL(link).hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

function onHosts(host: string, hosts: string[]): boolean {
	return hosts.some((known) => host === known || host.endsWith(`.${known}`));
}

// The registered name of a host: legmt.gov for mca.legmt.gov, aic.gov.au for www.aic.gov.au.
function siteOf(host: string): string {
	const labels = host.split('.');
	const countryShared = labels.length > 2 && /^[a-z]{2}$/.test(labels.at(-1)!) && /^(gov|com|org|edu|net|co|ac)$/.test(labels.at(-2)!);
	return labels.slice(countryShared ? -3 : -2).join('.');
}

// Whether a save of `link` that ended at `captured` captured the same document: the same site, or one
// of the hosts that serve a site's uploaded files.
function sameDocument(link: string, captured: string): boolean {
	const from = hostOf(link);
	const to = hostOf(captured);
	return from === to || siteOf(from) === siteOf(to) || onHosts(to, FILE_HOSTS);
}

function hoursSince(stamp: string | undefined, now: Date): number {
	return stamp ? (now.getTime() - Date.parse(stamp)) / 3_600_000 : Infinity;
}

function minuteKey(date: Date): string {
	return date.toISOString().slice(0, 16);
}

function countRequest(progress: Progress, now: Date): void {
	const counts = (progress.requestsByMinute ??= {});
	counts[minuteKey(now)] = (counts[minuteKey(now)] ?? 0) + 1;
	const oldest = minuteKey(new Date(now.getTime() - 24 * 3_600_000));
	for (const key of Object.keys(counts)) if (key < oldest) delete counts[key];
}

function requestsInLast(progress: Progress, now: Date, minutes: number): number {
	const from = minuteKey(new Date(now.getTime() - (minutes - 1) * 60_000));
	return Object.entries(progress.requestsByMinute ?? {}).reduce((total, [key, count]) => (key >= from ? total + count : total), 0);
}

function pause(progress: Progress, now: Date, minutes: number, reason: string): void {
	progress.pausedUntil = new Date(now.getTime() + minutes * 60_000).toISOString();
	progress.pauseReason = reason;
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

function authorization(env: Env): string {
	if (!env.ARCHIVE_ORG_ACCESS_KEY || !env.ARCHIVE_ORG_SECRET_KEY) {
		throw new Error('the archive.org keys are not set: add ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY as secrets on this Worker');
	}
	return `LOW ${env.ARCHIVE_ORG_ACCESS_KEY}:${env.ARCHIVE_ORG_SECRET_KEY}`;
}

// The capture index asked us to stop for a while.
class IndexBusy extends Error {}

// The newest capture of a link that the Archive answered with a page (not a 4xx or 5xx), or null.
// With onlyPages, only captures the Archive answered with 200, so a capture of a redirect is never taken.
// Throws IndexBusy when the index answers HTTP 429 or a server error.
async function latestCapture(link: string, onlyPages = false): Promise<Capture | null> {
	const query = new URLSearchParams({ url: link, output: 'json', fl: 'timestamp,original', filter: onlyPages ? 'statuscode:200' : '!statuscode:[45]..', limit: '-1' });
	const response = await fetch(`${CAPTURE_INDEX}?${query}`, {
		headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
		signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MILLISECONDS)
	});
	if (!response.ok) {
		await response.body?.cancel();
		if (response.status === 429 || response.status >= 500) throw new IndexBusy(`the capture index answered HTTP ${response.status}`);
		return null;
	}
	const rows = ((await response.json().catch(() => [])) as string[][]).filter((row) => /^\d{14}$/.test(row[0] ?? ''));
	const newest = rows.at(-1);
	if (!newest || hostOf(newest[1]) !== hostOf(link)) return null;
	const [stamp, original] = newest;
	return {
		service: 'wayback',
		link: `https://web.archive.org/web/${stamp}/${original}`,
		captured: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
	};
}

// For a link the Archive says it already captured recently: takes that capture.
// If the lookup finds nothing, the link waits a day without using up a try.
async function takeExistingCapture(entry: Entry, answer: string, now: Date): Promise<void> {
	let capture: Capture | null = null;
	try {
		capture = await latestCapture(entry.link);
	} catch {
		// No answer from the index: looked up again tomorrow.
	}
	entry.job = undefined;
	entry.asked = undefined;
	if (capture) {
		entry.capture = capture;
		entry.capturedAt = now.toISOString();
		entry.problem = undefined;
		entry.failed = undefined;
	} else {
		entry.failed = now.toISOString();
		entry.problem = answer;
	}
	entry.tries = Math.max((entry.tries ?? 1) - 1, 0);
}

// For a link not yet saved, or whose save failed: takes the newest capture the Archive already holds,
// if it is recent enough (FIXED_DOCUMENT_HOSTS, OLDER_CAPTURE_DAYS). Asked once before the first save
// and once after each failure. Throws IndexBusy, leaving the link to be looked up again.
async function takeOlderCapture(entry: Entry, now: Date): Promise<boolean> {
	let capture: Capture | null = null;
	try {
		capture = await latestCapture(entry.link, true);
	} catch (problem) {
		if (problem instanceof IndexBusy) throw problem;
		// A timeout or a dropped connection: counted as looked up, so the link goes on to be saved.
		entry.lookedUp = now.toISOString();
		return false;
	}
	entry.lookedUp = now.toISOString();
	if (!capture) return false;
	const ageInDays = (now.getTime() - Date.parse(capture.captured)) / 86_400_000;
	if (!onHosts(hostOf(entry.link), FIXED_DOCUMENT_HOSTS) && ageInDays > OLDER_CAPTURE_DAYS) return false;
	Object.assign(entry, { capture, capturedAt: now.toISOString(), job: undefined, asked: undefined, problem: undefined, failed: undefined });
	return true;
}

function markFailed(entry: Entry, problem: string, now: Date): void {
	entry.job = undefined;
	entry.asked = undefined;
	entry.failed = now.toISOString();
	entry.problem = problem;
	// Each failure is followed by one look for an older capture (takeOlderCapture).
	entry.lookedUp = undefined;
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
		if (!sameDocument(entry.link, captured)) {
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
	} else if (answer.status === 'error' && SAME_SNAPSHOT.test(answer.message ?? '')) {
		await takeExistingCapture(entry, answer.message!, now);
	} else if (answer.status === 'error') {
		markFailed(entry, answer.status_ext || answer.message || 'save failed', now);
	} else if (hoursSince(entry.asked, now) * 60 > MINUTES_BEFORE_GIVING_UP_ON_A_JOB) {
		markFailed(entry, 'save did not finish within the hour', now);
	}
}

// Returns false when the service says to stop asking for now.
async function askForSave(entry: Entry, signIn: string, now: Date, progress: Progress): Promise<boolean> {
	const body = new URLSearchParams({ url: entry.link, if_not_archived_within: REUSE_WITHIN, skip_first_archive: '1' });
	// A PDF is fetched with a plain GET instead of in a browser ("force_get", the API document), and a
	// plain HTML file without running its scripts: both make the capture shorter.
	let path = '';
	try {
		path = new URL(entry.link).pathname;
	} catch {
		// Save Page Now answers a link it cannot read.
	}
	if (/\.pdf$/i.test(path)) body.set('force_get', '1');
	if (onHosts(hostOf(entry.link), STATIC_PAGE_HOSTS)) body.set('js_behavior_timeout', '0');
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
	countRequest(progress, now);
	if (response.status === 401 || response.status === 403) {
		await response.body?.cancel();
		throw new Error(`Save Page Now refused the archive.org keys (HTTP ${response.status}); check the ARCHIVE_ORG_ACCESS_KEY and ARCHIVE_ORG_SECRET_KEY secrets on this Worker`);
	}
	if (response.status === 429) {
		await response.body?.cancel();
		pause(progress, now, 1, 'the Archive asked us to slow down (HTTP 429)');
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
		pause(progress, now, 1, reason === 'error:user-session-limit' ? 'the Archive is still working on our earlier saves' : 'the Archive asked us to slow down');
		return false;
	}
	if (reason === 'error:too-many-daily-captures') {
		entry.tries -= 1;
		// The API document gives this code only for one link: "This URL has been captured 10 times
		// today." Until 2026-11-27 a case-sensitive test for "this URL" missed that capital T, so one
		// link shared by three records paused every save for six hours. Only an answer that names the
		// account, not the link, now pauses the Worker.
		const text = answer.message ?? '';
		if (/\b(user|account|you)\b/i.test(text) && !/\b(this|the) url\b/i.test(text)) {
			progress.dailyLimitReached = now.toISOString();
			pause(progress, now, 60, `the Archive’s daily limit was reached (“${text.slice(0, 200)}”)`);
			return false;
		}
		// This link waits a day without using up a try; it is looked up first, since it was captured today.
		markFailed(entry, text || reason, now);
		return true;
	}
	if (SAME_SNAPSHOT.test(answer.message ?? '')) {
		await takeExistingCapture(entry, answer.message!, now);
		return true;
	}
	markFailed(entry, reason, now);
	return true;
}

// Runs `task` on each item, `atOnce` at a time, starting none after `deadline`.
async function inBatches<T>(items: T[], atOnce: number, deadline: number, task: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	const lanes = Array.from({ length: Math.min(atOnce, items.length) }, async () => {
		while (next < items.length && Date.now() < deadline) await task(items[next++]);
	});
	await Promise.all(lanes);
}

// How many capture sessions Save Page Now has free for the account, or null when it does not say.
async function freeSessions(signIn: string, progress: Progress, now: Date): Promise<number | null> {
	try {
		const response = await fetch(`${SESSION_SERVICE}?_t=${now.getTime()}`, {
			headers: { Accept: 'application/json', Authorization: signIn, 'User-Agent': USER_AGENT },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS)
		});
		if (!response.ok) {
			await response.body?.cancel();
			return null;
		}
		const answer = (await response.json()) as { available?: unknown; processing?: unknown };
		if (typeof answer.available !== 'number') return null;
		progress.sessions = { available: answer.available, processing: typeof answer.processing === 'number' ? answer.processing : 0, at: now.toISOString() };
		return answer.available;
	} catch {
		return null;
	}
}

function takeCapture(entry: Entry, capture: Capture, now: Date): void {
	Object.assign(entry, { capture, capturedAt: now.toISOString(), job: undefined, asked: undefined, problem: undefined, failed: undefined });
}

async function work(env: Env): Promise<void> {
	const now = new Date();
	const deadline = now.getTime() + RUN_BUDGET_MILLISECONDS;
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
		if ((progress.retryRound ?? 0) < RETRY_ROUND) {
			// Every link given up on gets its tries back; each is first looked up for an older capture.
			for (const entry of Object.values(progress.records)) {
				if (entry.capture || entry.job || (entry.tries ?? 0) < MOST_TRIES) continue;
				Object.assign(entry, { tries: 0, lookedUp: undefined, failed: entry.failed ?? now.toISOString() });
			}
			progress.retryRound = RETRY_ROUND;
		}
		const signIn = authorization(env);

		const jobs = Object.values(progress.records).filter((entry) => entry.job).slice(0, STATUS_CHECKS_EACH_MINUTE);
		await inBatches(jobs, STATUS_CHECKS_AT_ONCE, deadline, async (entry) => {
			try {
				await checkJob(entry, signIn, now);
			} catch {
				// No answer this minute; the job is checked again next minute.
			}
		});

		// Several records can share one link (shares_link_with): one capture serves them all, and a link
		// already being saved is not asked for again.
		const capturedLinks = new Map<string, Capture>();
		const busyLinks = new Set<string>();
		for (const entry of Object.values(progress.records)) {
			if (entry.capture) capturedLinks.set(entry.link, entry.capture);
			if (entry.job) busyLinks.add(entry.link);
		}
		// The queue's records still waiting, in its order (most important first). A record gets an entry
		// in the progress object only once something is done for it, so the object stays small.
		const waiting: { key: string; link: string }[] = [];
		const entryOf = (key: string, link: string): Entry => (progress.records[key] ??= { link });
		for (const [key, link] of progress.queue) {
			if (marks[key]) continue;
			const entry = progress.records[key];
			if (entry && entry.link !== link) Object.assign(entry, { link, tries: 0, failed: undefined, problem: undefined, capture: undefined, lookedUp: undefined });
			if (entry?.capture || entry?.job) continue;
			const shared = capturedLinks.get(link);
			if (shared) {
				takeCapture(entryOf(key, link), shared, now);
				continue;
			}
			waiting.push({ key, link });
		}

		// Look links up before saving them: the first not yet looked up, one entry for each link.
		const lookupsOpen = !progress.lookupsPausedUntil || Date.parse(progress.lookupsPausedUntil) <= now.getTime();
		if (lookupsOpen) {
			progress.lookupsPausedUntil = undefined;
			const toLookUp: Entry[] = [];
			const links = new Set<string>();
			for (const { key, link } of waiting) {
				if (toLookUp.length >= LOOKUPS_EACH_MINUTE) break;
				if (progress.records[key]?.lookedUp || busyLinks.has(link) || links.has(link)) continue;
				links.add(link);
				toLookUp.push(entryOf(key, link));
			}
			await inBatches(toLookUp, LOOKUPS_AT_ONCE, deadline, async (entry) => {
				if (progress.lookupsPausedUntil) return;
				try {
					if (await takeOlderCapture(entry, now)) capturedLinks.set(entry.link, entry.capture!);
				} catch (problem) {
					progress.lookupsPausedUntil = new Date(now.getTime() + MINUTES_LOOKUPS_PAUSE * 60_000).toISOString();
					problems.push(`${message(problem)}; lookups stop for ${MINUTES_LOOKUPS_PAUSE} minutes`);
				}
			});
		}
		const lookupsWorking = !progress.lookupsPausedUntil;

		if (hoursSince(progress.dailyLimitReached, now) >= 1 && Date.now() < deadline) {
			// Never more saves than Save Page Now has sessions free for us. The account has had 3 sessions
			// (/save/status/user, 2026-11-27) and a capture often ends within seconds, so a second round
			// later in the minute uses the sessions the first round's captures have freed.
			let saves = 0;
			let goOn = true;
			for (const startsAt of SAVE_ROUNDS_MILLISECONDS) {
				if (!goOn || saves >= SAVES_EACH_MINUTE) break;
				const wait = now.getTime() + startsAt - Date.now();
				if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
				if (Date.now() >= deadline) break;
				const free = await freeSessions(signIn, progress, new Date());
				const most = Math.min(SAVES_EACH_MINUTE, saves + (free ?? SAVES_EACH_MINUTE));
				for (const { key, link } of waiting) {
					if (saves >= most || Date.now() >= deadline) break;
					const known = progress.records[key];
					if (known?.capture || known?.job || busyLinks.has(link)) continue;
					const shared = capturedLinks.get(link);
					if (shared) {
						takeCapture(entryOf(key, link), shared, now);
						continue;
					}
					// A link is looked up before it is saved, unless the index is not answering.
					if (!known?.lookedUp && lookupsWorking) continue;
					const entry = entryOf(key, link);
					if ((entry.tries ?? 0) >= MOST_TRIES) continue;
					// Links the Archive already had, from before this Worker took existing captures: looked up straight away.
					if (SAME_SNAPSHOT.test(entry.problem ?? '') && entry.tries) {
						saves += 1;
						await takeExistingCapture(entry, entry.problem!, now);
						continue;
					}
					if (hoursSince(entry.failed, now) < HOURS_BEFORE_SAVING_AGAIN) continue;
					saves += 1;
					try {
						goOn = await askForSave(entry, signIn, now, progress);
						if (entry.job) busyLinks.add(entry.link);
						if (entry.capture) capturedLinks.set(entry.link, entry.capture);
					} catch (problem) {
						if (/refused the archive\.org keys/.test(message(problem))) throw problem;
						// A timeout or a dropped connection: try this link again tomorrow.
						entry.tries = (entry.tries ?? 0) + 1;
						markFailed(entry, `save request failed (${message(problem)})`, now);
					}
					if (!goOn) break;
				}
			}
		}
	} catch (problem) {
		problems.push(message(problem));
		if (/archive\.org keys/.test(message(problem))) progress.keysRefused = now.toISOString();
	}
	if (!problems.some((problem) => /archive\.org keys/.test(problem))) progress.keysRefused = undefined;
	if (problems.length) {
		progress.lastError = problems.join('; ');
		progress.lastErrorAt = now.toISOString();
	}
	await writeProgress(env, progress);
}

type WorkerState = 'not-running' | 'keys-refused' | 'paused-daily-limit' | 'saving' | 'waiting-to-retry' | 'idle';

const stateWords: Record<WorkerState, string> = {
	'not-running': 'Not running',
	'keys-refused': 'Stopped: the archive.org keys are missing or refused',
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
	const retryTimes = [...queued]
		.map((key) => progress.records[key])
		.filter((entry) => entry && !entry.capture && !entry.job && (entry.tries ?? 0) < MOST_TRIES && entry.failed)
		.map((entry) => Date.parse(entry!.failed!) + HOURS_BEFORE_SAVING_AGAIN * 3_600_000);
	const nextRetry = retryTimes.length ? Math.min(...retryTimes) : null;
	const paused = progress.pausedUntil && Date.parse(progress.pausedUntil) > now.getTime() ? { until: progress.pausedUntil, reason: progress.pauseReason ?? '' } : null;
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
		capturedLastHour: captured.filter(([, entry]) => hoursSince(entry.capturedAt, now) < 1).length,
		waiting,
		savingNow: entries
			.filter(([, entry]) => entry.job)
			.sort(([, a], [, b]) => (a.asked ?? '').localeCompare(b.asked ?? ''))
			.map(([key, entry]) => ({ key, link: entry.link, askedAt: entry.asked ?? null })),
		paused,
		nextRetryAt: dueNow === 0 && nextRetry !== null ? new Date(Math.max(nextRetry, now.getTime())).toISOString() : null,
		requests: {
			lastMinute: requestsInLast(progress, now, 1),
			lastHour: requestsInLast(progress, now, 60),
			last24Hours: requestsInLast(progress, now, 24 * 60),
			ourLimitEachMinute: SAVES_EACH_MINUTE,
			archiveLimitEachMinute: ARCHIVE_SAVES_EACH_MINUTE,
			archiveLimitEachDay: ARCHIVE_SAVES_EACH_DAY
		},
		archiveSessions: progress.sessions ?? null,
		lookupsPausedUntil: progress.lookupsPausedUntil && Date.parse(progress.lookupsPausedUntil) > now.getTime() ? progress.lookupsPausedUntil : null,
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

function pacific(stamp: string): string {
	return new Date(stamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles' }) + ' Pacific';
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
	const minutesAgo = (stamp: string | null) => {
		if (!stamp) return '';
		const minutes = Math.max(0, Math.round((Date.now() - Date.parse(stamp)) / 60_000));
		return minutes === 0 ? 'asked this minute' : `asked ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
	};
	const requests = status.requests;
	const rightNow = [
		status.paused ? `<p class="error">Paused until ${escape(pacific(status.paused.until))}: ${escape(status.paused.reason)}.</p>` : '',
		status.nextRetryAt ? `<p>Nothing new to save. The next failed link is tried again at ${escape(pacific(status.nextRetryAt))}.</p>` : '',
		status.savingNow.length
			? `<p>Waiting on the Archive for ${status.savingNow.length} save${status.savingNow.length === 1 ? '' : 's'}:</p>`
			: '<p class="quiet">No saves waiting on the Archive right now.</p>'
	].join('');
	const usage: [string, string][] = [
		['Save requests, last minute', `${requests.lastMinute} of ${requests.ourLimitEachMinute}`],
		['Save requests, last hour', `${requests.lastHour.toLocaleString('en-US')} of ${(requests.ourLimitEachMinute * 60).toLocaleString('en-US')}`],
		['Save requests, last 24 hours', `${requests.last24Hours.toLocaleString('en-US')} of ${requests.archiveLimitEachDay.toLocaleString('en-US')}`],
		['Captured in the last hour', status.capturedLastHour.toLocaleString('en-US')]
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
<h2>Right now</h2>
${rightNow}
${status.savingNow.length ? rows(status.savingNow.map((item) => ({ key: item.key, link: item.link, note: minutesAgo(item.askedAt) }))) : ''}
<dl>${usage.map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>
<p class="quiet">The Worker asks for at most ${requests.ourLimitEachMinute} saves a minute, under the Archive’s limit of ${requests.archiveLimitEachMinute} a minute and ${requests.archiveLimitEachDay.toLocaleString('en-US')} a day for a signed-in account. A save waits for the Archive to finish it, usually a minute or two.</p>
<h2>All links</h2>
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
