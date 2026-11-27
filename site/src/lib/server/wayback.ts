/**
 * The Wayback Worker's progress and the lead author's marks on the links it
 * could not save (site/WAYBACK.md, "Links that fail"). The Worker keeps its
 * progress in the source documents bucket; the workspace's Wayback captures
 * page reads it from the same bucket and writes the marks beside it, which the
 * Worker reads every minute.
 */
import type { Fetcher, R2Bucket } from '@cloudflare/workers-types/index.ts';

export const progressObject = 'wayback/progress.json';
export const marksObject = 'wayback/marks.json';

export interface WaybackEntry {
	link: string;
	job?: string;
	capture?: { service: 'wayback'; link: string; captured: string };
	capturedAt?: string;
	problem?: string;
	failed?: string;
	tries?: number;
}

export interface WaybackProgress {
	queue: [string, string][];
	records: Record<string, WaybackEntry>;
	lastRun?: string;
	lastError?: string;
}

export type MarkKind = 'saved-by-hand' | 'failed-by-hand' | 'file-sent';

export interface WaybackMark {
	kind: MarkKind;
	at: string;
	by: string;
	/** The original link the mark is about, so a later change to the record's link is noticed. */
	link: string;
	/** For saved-by-hand: the Wayback link of the capture. */
	capture?: { service: 'wayback'; link: string; captured: string };
}

export type WaybackMarks = Record<string, WaybackMark>;

export const markLabels: Record<MarkKind, string> = {
	'saved-by-hand': 'Saved by hand',
	'failed-by-hand': 'Failed by hand too',
	'file-sent': 'File sent'
};

export async function readWaybackProgress(bucket: R2Bucket): Promise<WaybackProgress | null> {
	const object = await bucket.get(progressObject);
	return object ? ((await object.json()) as WaybackProgress) : null;
}

export async function readWaybackMarks(bucket: R2Bucket): Promise<WaybackMarks> {
	const object = await bucket.get(marksObject);
	return object ? ((await object.json()) as WaybackMarks) : {};
}

async function writeWaybackMarks(bucket: R2Bucket, marks: WaybackMarks): Promise<void> {
	await bucket.put(marksObject, JSON.stringify(marks), { httpMetadata: { contentType: 'application/json' } });
}

function hostOf(link: string): string {
	try {
		return new URL(link).hostname.replace(/^www\./, '');
	} catch {
		// expected: a link that is not a web address has no host.
		return '';
	}
}

/**
 * A Wayback Machine capture link of the original link, such as
 * https://web.archive.org/web/20261124174500/https://example.org/page, or
 * null with the reason it cannot be used.
 */
export function readCaptureLink(typed: string, originalLink: string): { capture: WaybackMark['capture'] } | { problem: string } {
	const match = /^https?:\/\/web\.archive\.org\/web\/(\d{14})(?:[a-z_]{0,4})?\/(.+)$/.exec(typed.trim());
	if (!match) return { problem: 'Paste the Wayback link of the capture, which starts with https://web.archive.org/web/ and a 14-digit date.' };
	const [, stamp, captured] = match;
	if (hostOf(captured) !== hostOf(originalLink)) {
		return { problem: `That capture is of ${hostOf(captured) || 'another site'}, not ${hostOf(originalLink)}.` };
	}
	return {
		capture: {
			service: 'wayback',
			link: `https://web.archive.org/web/${stamp}/${captured}`,
			captured: `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
		}
	};
}

/** Sets or clears one record's mark. Marks are few and set by one person, so the last write wins. */
export async function setWaybackMark(bucket: R2Bucket, key: string, mark: WaybackMark | null): Promise<void> {
	const marks = await readWaybackMarks(bucket);
	if (mark) marks[key] = mark;
	else delete marks[key];
	await writeWaybackMarks(bucket, marks);
}

/** The Save Page Now address a person opens to save a link from their own browser. */
export function saveItYourselfLink(link: string): string {
	return `https://web.archive.org/save/${link}`;
}

/** The Wayback Worker's public progress page. */
export const waybackWorkerAddress = 'https://tribal-law-project-wayback.trevordgoldsmith.workers.dev';

export type WaybackState = 'not-running' | 'keys-refused' | 'paused-daily-limit' | 'saving' | 'waiting-to-retry' | 'idle';

/** What the Wayback Worker's /status.json answers (site/wayback/worker.ts, summary). */
export interface WaybackStatus {
	state: WaybackState;
	stateWords: string;
	minutesSinceLastRun: number | null;
	lastError: string | null;
	left: number;
	captured: number;
	capturedLast24Hours: number;
	/** Missing from a Worker deployed before the "Right now" section. */
	capturedLastHour?: number;
	waiting: number;
	failedWillRetry: number;
	gaveUp: number;
	markedByHand: number;
	savingNow?: { key: string; link: string; askedAt: string | null }[];
	paused?: { until: string; reason: string } | null;
	nextRetryAt?: string | null;
	requests?: { lastMinute: number; lastHour: number; last24Hours: number; ourLimitEachMinute: number; archiveLimitEachMinute: number; archiveLimitEachDay: number };
}

/**
 * Asks the Wayback Worker for its progress through the waybackWorker service
 * binding. A Worker cannot fetch another Worker's workers.dev address on the
 * same account (it answers 404), so the binding is the only way in.
 */
export async function readWaybackStatus(worker: Fetcher | undefined): Promise<{ status: WaybackStatus } | { problem: string }> {
	if (!worker) return { problem: 'The waybackWorker binding is missing.' };
	const response = await worker.fetch('https://wayback/status.json');
	if (!response.ok) {
		await response.body?.cancel();
		return { problem: `The Wayback Worker answered ${response.status}.` };
	}
	return { status: (await response.json()) as WaybackStatus };
}
