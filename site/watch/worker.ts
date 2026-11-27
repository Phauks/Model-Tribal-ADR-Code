/**
 * The source watch Worker (docs/source-watch.md, decision record 0059). Every
 * minute it:
 *
 * 1. starts each watcher that is due as its own Workflows instance (WatchRun
 *    below), so every step of a run is retried on its own;
 * 2. asks the models about a few items the rules left in the middle band, or
 *    hands them to people when the triage provider is off
 *    (src/lib/server/watch/model-triage.ts), and on Mondays at 05:13 UTC has
 *    the top model check a sample of the cheap model's answers;
 * 3. writes watch/progress.json to the private bucket, which its progress page,
 *    its /status.json and the site's Service checks page read.
 *
 * It answers:
 *
 *   GET /              a progress page: counts and each watcher's last run,
 *                      never an item's title or text
 *   GET /status.json   the same, for machines
 *
 * Nothing it finds is published without a person: candidates wait on the
 * workspace's Source watch page.
 */
import type { D1Database, DurableObjectNamespace, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep, type WorkflowStepConfig } from 'cloudflare:workers';
import { lookupFor, type KnownIdentifiers, type KnownLookup } from '../src/lib/server/watch/known.ts';
import { dollars } from '../src/lib/server/watch/model-prices.ts';
import { checkSample, triageWaiting } from '../src/lib/server/watch/model-triage.ts';
import { ComeBackLater, NotAllowed, type Desks } from '../src/lib/server/watch/polite-fetch.ts';
import { readWatchProgress, watchState, watchStateWords, writeWatchProgress, type ModelProgress, type WatchProgress, type WatcherProgress } from '../src/lib/server/watch/progress.ts';
import { runWatcher, type RunDependencies, type RunReport, type RunSteps } from '../src/lib/server/watch/run.ts';
import { isDue, nextDue } from '../src/lib/server/watch/schedule.ts';
import { candidateCounts, latestRuns, spendSince } from '../src/lib/server/watch/store.ts';
import { chooseTriageProvider, chosenModels, type TriageSettings } from '../src/lib/server/watch/triage.ts';
import { watcherIsOn } from '../src/lib/server/watch/watcher.ts';
import { HostDesk } from './host-desk.ts';
import builtIndex from './known-identifiers.json';
import { watcherNamed, watchers } from './watchers/index.ts';

export { HostDesk };

export interface WatchEnvironment extends TriageSettings {
	database: D1Database;
	sourceDocuments: R2Bucket;
	hostDesks: DurableObjectNamespace<HostDesk>;
	watchRuns: Workflow<RunParameters>;
	/** Watchers to turn on or off without a code change, separated by commas (wrangler.jsonc "vars"). */
	WATCH_TURN_ON?: string;
	WATCH_TURN_OFF?: string;
}

interface RunParameters {
	watcher: string;
}

/** The weekly sample check: Mondays at 05:13 UTC. */
export const sampleSchedule = '13 5 * * 1';
/** A run still marked running after this long is taken to have died, and the watcher may start again. */
const runningLongestMilliseconds = 3_600_000;

/* The host desks ---------------------------------------------------------- */

function desksFor(environment: WatchEnvironment): Desks {
	const desk = (host: string) => environment.hostDesks.get(environment.hostDesks.idFromName(host));
	return {
		ticket: (host, request) => desk(host).ticket(host, request),
		report: (host, status, retryAfter) => desk(host).report(host, status, retryAfter)
	};
}

/* The index of known identifiers ------------------------------------------ */

let knownCache: { index: KnownIdentifiers; lookup: KnownLookup } | null = null;

/**
 * The index of the records this Worker was built with (make-known-identifiers.ts
 * writes it during the build; Workers Builds rebuilds the Worker when the
 * records change). Its lookups are made once per isolate.
 */
function knownIdentifiers(): { index: KnownIdentifiers; lookup: KnownLookup } {
	if (!knownCache) {
		const index = builtIndex as KnownIdentifiers;
		knownCache = { index, lookup: lookupFor(index) };
	}
	return knownCache;
}

function runDependencies(environment: WatchEnvironment): RunDependencies {
	return {
		database: environment.database,
		bucket: environment.sourceDocuments,
		desks: desksFor(environment),
		known: async () => knownIdentifiers().index,
		modelAvailable: chooseTriageProvider(environment).ready === true
	};
}

/* One run, as a Workflows instance ---------------------------------------- */

type StepResult<Value> = { value: Value } | { later: { host: string; retryAt: number; reason: string } } | { refused: string };

/**
 * Steps backed by Workflows. A host that asks us to wait, or a robots.txt that
 * says no, is not retried by Workflows: it is carried out of the step and
 * thrown again, so the run ends and the next one asks again.
 */
export function workflowSteps(step: Pick<WorkflowStep, 'do'>): RunSteps {
	return {
		async do<Value>(name: string, work: () => Promise<Value>): Promise<Value> {
			// Workflows types a step's result as serializable; run.ts's steps return plain data, which is.
			const doStep = step.do.bind(step) as unknown as (name: string, config: WorkflowStepConfig, work: () => Promise<StepResult<Value>>) => Promise<StepResult<Value>>;
			const result = await doStep(name, { retries: { limit: 2, delay: '30 seconds', backoff: 'exponential' }, timeout: '10 minutes' }, async () => {
				try {
					return { value: await work() };
				} catch (problem) {
					if (problem instanceof ComeBackLater) return { later: { host: problem.host, retryAt: problem.retryAt, reason: problem.message } };
					if (problem instanceof NotAllowed) return { refused: problem.message };
					throw problem;
				}
			});
			if ('later' in result) throw new ComeBackLater(result.later.host, result.later.retryAt, result.later.reason);
			if ('refused' in result) throw new NotAllowed(result.refused);
			return result.value;
		}
	};
}

export class WatchRun extends WorkflowEntrypoint<WatchEnvironment, RunParameters> {
	override async run(event: Readonly<WorkflowEvent<RunParameters>>, step: WorkflowStep): Promise<RunReport | { problem: string }> {
		const watcher = watcherNamed(event.payload.watcher);
		if (!watcher) return { problem: `No watcher is named ${event.payload.watcher}.` };
		return runWatcher(watcher, event.instanceId, runDependencies(this.env), workflowSteps(step));
	}
}

/* Every minute ------------------------------------------------------------ */

function minuteStamp(date: Date): string {
	return date.toISOString().slice(0, 16).replace(/[-:T]/g, '');
}

async function stillRunning(database: D1Database, watcher: string, now: Date): Promise<boolean> {
	const row = await database
		.prepare(`SELECT identifier FROM watch_runs WHERE watcher = ? AND outcome = 'running' AND started_at > ? LIMIT 1`)
		.bind(watcher, new Date(now.getTime() - runningLongestMilliseconds).toISOString())
		.first<{ identifier: string }>();
	return row !== null;
}

/** Starts each watcher that is due and not still running from last time. */
async function startDueWatchers(environment: WatchEnvironment, now: Date): Promise<string[]> {
	const problems: string[] = [];
	for (const watcher of watchers) {
		if (!watcherIsOn(watcher, environment).on || !isDue(watcher.schedule, now)) continue;
		try {
			if (await stillRunning(environment.database, watcher.identifier, now)) continue;
			await environment.watchRuns.create({ id: `${watcher.identifier}-${minuteStamp(now)}`, params: { watcher: watcher.identifier } });
		} catch (problem) {
			// The same minute's instance already exists when the cron fires twice; anything else is reported.
			const words = problem instanceof Error ? problem.message : String(problem);
			if (!/already exists/i.test(words)) problems.push(`${watcher.identifier}: ${words}`);
		}
	}
	return problems;
}

async function tick(environment: WatchEnvironment, now: Date): Promise<void> {
	const previous = await readWatchProgress(environment.sourceDocuments).catch(() => null);
	const problems = await startDueWatchers(environment, now);

	const provider = chooseTriageProvider(environment);
	const models: ModelProgress = {
		provider: provider.name,
		ready: provider.ready === true,
		problem: provider.ready === true ? null : provider.ready.problem,
		gateway: provider.name === 'ai-gateway' ? environment.WATCH_GATEWAY : undefined,
		cheapModel: chosenModels(environment)?.cheap,
		topModel: chosenModels(environment)?.top,
		lastCallAt: previous?.models.lastCallAt ?? null,
		lastProblemAt: previous?.models.lastProblemAt ?? null,
		lastSample: previous?.models.lastSample ?? null
	};
	let knownIndex: WatchProgress['knownIndex'] = previous?.knownIndex ?? null;
	try {
		const { index, lookup } = knownIdentifiers();
		knownIndex = index.buildHash ? { buildHash: index.buildHash, madeAt: index.madeAt, readAt: now.toISOString() } : null;
		const triage = await triageWaiting(environment.database, provider, provider.ready === true ? lookup : null, now);
		if (triage.asked > 0) models.lastCallAt = now.toISOString();
		if (triage.problem) {
			models.problem = triage.problem;
			models.lastProblemAt = now.toISOString();
		}
		if (provider.ready === true && isDue(sampleSchedule, now)) {
			const sample = await checkSample(environment.database, provider, now);
			models.lastSample = { at: now.toISOString(), checked: sample.checked, disagreed: sample.disagreed };
			if (sample.problem) problems.push(`Sample check: ${sample.problem}`);
		}
	} catch (problem) {
		problems.push(problem instanceof Error ? problem.message : String(problem));
	}

	const runs = new Map((await latestRuns(environment.database)).map((run) => [run.watcher, run]));
	const watcherProgress: Record<string, WatcherProgress> = {};
	for (const watcher of watchers) {
		const run = runs.get(watcher.identifier);
		const state = watcherIsOn(watcher, environment);
		watcherProgress[watcher.identifier] = {
			title: watcher.title,
			tier: String(watcher.tier),
			driver: watcher.driver,
			schedule: watcher.schedule,
			enabled: state.on,
			off: state.off,
			lastStartedAt: run?.startedAt,
			lastFinishedAt: run?.finishedAt ?? undefined,
			lastOutcome: run?.outcome,
			lastProblem: run?.problem ?? null,
			nextDueAt: state.on ? (nextDue(watcher.schedule, new Date(now.getTime() + 60_000))?.toISOString() ?? null) : null,
			found: run?.found,
			newItems: run?.newItems,
			closedByRules: run?.closedByRules,
			toReview: run?.toReview
		};
	}
	models.spend30Days = await spendSince(environment.database, new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10));
	const problem = problems.length > 0 ? problems.join(' ') : null;
	await writeWatchProgress(environment.sourceDocuments, {
		lastTick: now.toISOString(),
		lastError: problem ?? previous?.lastError ?? null,
		lastErrorAt: problem ? now.toISOString() : (previous?.lastErrorAt ?? null),
		knownIndex,
		counts: await candidateCounts(environment.database),
		watchers: watcherProgress,
		models
	});
}

/* The progress page ------------------------------------------------------- */

function escape(text: string): string {
	return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

function pacific(stamp: string | null | undefined): string {
	if (!stamp) return '';
	return new Date(stamp).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
}

const countLabels: [string, string][] = [
	['to-review', 'To review'],
	['held', 'Held'],
	['waiting-for-model', 'Waiting for a model'],
	['closed-by-rules', 'Closed by rules'],
	['added', 'Added'],
	['new-version', 'Added as new versions'],
	['same-as', 'Same as a record'],
	['not-relevant', 'Not relevant']
];

export function progressPage(progress: WatchProgress | null, now: Date): string {
	const { state } = watchState(progress, now);
	const counts = progress?.counts ?? {};
	const watcherRows = Object.entries(progress?.watchers ?? {})
		.map(([identifier, watcher]) => {
			const last = watcher.lastStartedAt ? `${pacific(watcher.lastStartedAt)}: ${watcher.lastOutcome ?? ''}${watcher.lastOutcome === 'finished' ? `, ${watcher.found ?? 0} found, ${watcher.newItems ?? 0} new` : ''}` : 'Not run yet';
			const next = watcher.enabled ? pacific(watcher.nextDueAt) : `Off: ${watcher.off ?? ''}`;
			return `<tr><td>${escape(watcher.title)}<br><span class="quiet">${escape(identifier)}, tier ${escape(watcher.tier)}</span></td><td>${escape(last)}${watcher.lastProblem ? `<br><span class="error">${escape(watcher.lastProblem)}</span>` : ''}</td><td>${escape(next)}</td></tr>`;
		})
		.join('');
	const models = progress?.models;
	const spend = (models?.spend30Days ?? []).map((row) => `<tr><td>${escape(row.model)}</td><td>${row.calls.toLocaleString('en-US')}</td><td>${escape(dollars(row.costMicrodollars))}</td></tr>`).join('');
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="60">
<meta name="robots" content="noindex">
<title>Source watch</title>
<style>
:root { --text: #1d1d1b; --quiet: #5f5e5a; --line: #d8d6cf; --page: #fbfaf7; --error: #9b2c1f; }
@media (prefers-color-scheme: dark) { :root { --text: #ecebe6; --quiet: #a7a59e; --line: #3b3a36; --page: #1a1a18; --error: #f08a7a; } }
body { margin: 0; padding: 24px 16px 48px; background: var(--page); color: var(--text); font: 16px/1.5 system-ui, sans-serif; }
main { max-width: 860px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 32px 0 8px; }
.quiet { color: var(--quiet); }
.error { color: var(--error); }
.state { display: inline-block; margin: 8px 0; padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px; font-weight: 600; }
.state-not-running, .state-problem { color: var(--error); border-color: currentColor; }
dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 16px 0 0; }
dl div { border: 1px solid var(--line); border-radius: 8px; padding: 12px; }
dt { color: var(--quiet); font-size: 0.875rem; }
dd { margin: 4px 0 0; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { text-align: left; color: var(--quiet); font-weight: 500; padding: 6px 8px 6px 0; }
td { border-top: 1px solid var(--line); padding: 6px 8px 6px 0; vertical-align: top; overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
<h1>Source watch</h1>
<p class="state state-${state}">${escape(watchStateWords[state])}</p>
<p class="quiet">Watches public sources for new and changed Native legal material. Nothing it finds is published without a person. ${progress ? `Last checked ${escape(pacific(progress.lastTick))}.` : ''} This page refreshes every minute.</p>
${progress?.lastError ? `<p class="error">Last problem (${escape(pacific(progress.lastErrorAt))}): ${escape(progress.lastError)}</p>` : ''}
<h2>Found items</h2>
<dl>${countLabels.map(([status, label]) => `<div><dt>${escape(label)}</dt><dd>${(counts[status] ?? 0).toLocaleString('en-US')}</dd></div>`).join('')}</dl>
<h2>Watchers</h2>
<table><thead><tr><th>Watcher</th><th>Last run</th><th>Next run</th></tr></thead><tbody>${watcherRows}</tbody></table>
<h2>Models</h2>
<p>${models ? (models.ready ? `Triage by ${escape(models.cheapModel ?? '')}, hard cases by ${escape(models.topModel ?? '')}${models.provider === 'ai-gateway' ? `, through AI Gateway ${escape(models.gateway ?? '')}` : models.provider === 'workers-ai' ? ', on Workers AI' : ''}.` : `Off: ${escape(models.problem ?? '')} Items the rules cannot decide go to people.`) : ''}</p>
${models?.lastSample ? `<p class="quiet">Last sample check ${escape(pacific(models.lastSample.at))}: ${models.lastSample.checked} checked, ${models.lastSample.disagreed} disagreed.</p>` : ''}
${spend ? `<table><thead><tr><th>Model</th><th>Calls, 30 days</th><th>Spend, 30 days</th></tr></thead><tbody>${spend}</tbody></table>` : '<p class="quiet">No model calls in the last 30 days.</p>'}
<h2>Records index</h2>
<p class="quiet">${progress?.knownIndex ? `Made from the records on ${escape(pacific(progress.knownIndex.madeAt))}.` : 'Empty: this Worker was built without it (site/watch/README.md).'}</p>
</main>
</body>
</html>`;
}

export default {
	async scheduled(controller: ScheduledController, environment: WatchEnvironment, context: ExecutionContext): Promise<void> {
		const now = new Date(Math.floor(controller.scheduledTime / 60_000) * 60_000);
		context.waitUntil(tick(environment, now));
	},

	async fetch(request: Request, environment: WatchEnvironment): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (request.method !== 'GET' || (path !== '/' && path !== '/status.json')) return new Response('Not found', { status: 404 });
		const progress = await readWatchProgress(environment.sourceDocuments);
		const now = new Date();
		if (path === '/status.json') return Response.json({ ...watchState(progress, now), progress }, { headers: { 'cache-control': 'no-store' } });
		return new Response(progressPage(progress, now), {
			headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" }
		});
	}
} satisfies ExportedHandler<WatchEnvironment>;
