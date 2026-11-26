/**
 * What the watch Worker has done, as one JSON object in the private bucket at
 * watch/progress.json (docs/source-watch.md, "How a run works"), written every
 * minute. The Worker's progress page, its /status.json, and the site's Service
 * checks rows "Source watch" and "Source watch models" read it, the site from
 * the bucket, so the site needs no binding to the Worker.
 */
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { TriageProviderName } from './triage.ts';

export const progressObject = 'watch/progress.json';
/** The watch Worker's public progress page (site/watch/README.md). */
export const watchWorkerAddress = 'https://tribal-law-project-watch.trevordgoldsmith.workers.dev';

export interface WatcherProgress {
	title: string;
	tier: string;
	driver: string;
	schedule: string;
	enabled: boolean;
	/** Why it is off, when it is. */
	off?: string;
	lastStartedAt?: string;
	lastFinishedAt?: string;
	lastOutcome?: string;
	lastProblem?: string | null;
	nextDueAt?: string | null;
	/** The latest run's counts. */
	found?: number;
	newItems?: number;
	closedByRules?: number;
	toReview?: number;
}

export interface ModelProgress {
	provider: TriageProviderName;
	ready: boolean;
	problem?: string | null;
	gateway?: string;
	cheapModel?: string;
	topModel?: string;
	lastCallAt?: string | null;
	lastProblemAt?: string | null;
	/** Spend in the last 30 days by model, in millionths of a dollar, and calls. */
	spend30Days?: { model: string; calls: number; costMicrodollars: number }[];
	lastSample?: { at: string; checked: number; disagreed: number } | null;
}

export interface WatchProgress {
	lastTick: string;
	lastError?: string | null;
	lastErrorAt?: string | null;
	knownIndex?: { buildHash: string; madeAt: string; readAt: string } | null;
	counts?: Record<string, number>;
	watchers: Record<string, WatcherProgress>;
	models: ModelProgress;
}

export type WatchState = 'not-running' | 'running' | 'problem' | 'idle';

export const watchStateWords: Record<WatchState, string> = {
	'not-running': 'Not running',
	running: 'Running',
	problem: 'Running, with a problem',
	idle: 'Idle: every watcher is off'
};

/** The Worker's cron runs every minute, so a tick older than this means the schedule stopped. */
export const minutesBeforeNotRunning = 5;

export function watchState(progress: WatchProgress | null, now: Date): { state: WatchState; minutesSinceTick: number | null } {
	if (!progress) return { state: 'not-running', minutesSinceTick: null };
	const minutesSinceTick = Math.floor((now.getTime() - Date.parse(progress.lastTick)) / 60_000);
	if (minutesSinceTick > minutesBeforeNotRunning) return { state: 'not-running', minutesSinceTick };
	const watchers = Object.values(progress.watchers);
	if (watchers.length > 0 && watchers.every((watcher) => !watcher.enabled)) return { state: 'idle', minutesSinceTick };
	const recentError = progress.lastErrorAt && now.getTime() - Date.parse(progress.lastErrorAt) < 3_600_000;
	const failing = watchers.some((watcher) => watcher.enabled && watcher.lastOutcome === 'failed');
	return { state: recentError || failing ? 'problem' : 'running', minutesSinceTick };
}

export async function readWatchProgress(bucket: R2Bucket): Promise<WatchProgress | null> {
	const object = await bucket.get(progressObject);
	return object ? ((await object.json()) as WatchProgress) : null;
}

export async function writeWatchProgress(bucket: R2Bucket, progress: WatchProgress): Promise<void> {
	await bucket.put(progressObject, JSON.stringify(progress), { httpMetadata: { contentType: 'application/json' } });
}
