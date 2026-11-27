/**
 * One run of one watcher (docs/source-watch.md, "How a run works"). The watch
 * Worker runs this as a Cloudflare Workflows instance, so each step (ask the
 * source; fetch, store and scan files; apply the rules; write the candidates)
 * is durable and retried on its own. Tests run it with steps that simply call
 * through.
 *
 * The cursor is saved only after every item is written, so a run that fails
 * part way asks again from the same place next time; finding an item twice
 * does nothing.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { readSettings, restrictsAnything } from '../../nation-restrictions.ts';
import { storeCapture } from './capture.ts';
import { bucketPageTexts } from './drivers/page.ts';
import { lookupFor, matchKnown, nationsNamedIn, type KnownIdentifiers, type KnownLookup, type MatchInput } from './known.ts';
import { ComeBackLater, NotAllowed, politeFetch, type Desks } from './polite-fetch.ts';
import { applyRules } from './rules.ts';
import { addCandidate, candidateExists, finishRun, pageMemory, readCursor, startRun, writeCursor, type RunCounts } from './store.ts';
import type { CheckContext, FoundItem, WatcherDefinition } from './watcher.ts';

/** The part of a Workflows step a run uses. */
export interface RunSteps {
	do<Value>(name: string, work: () => Promise<Value>): Promise<Value>;
}

/** Steps that just call through, for tests and for running outside Workflows. */
export const directSteps: RunSteps = { do: (_name, work) => work() };

export interface RunDependencies {
	database: D1Database;
	bucket: R2Bucket;
	desks: Desks;
	/** The known-identifiers index (./known.ts). */
	known(): Promise<KnownIdentifiers>;
	/** Whether a model will look at the middle band (./triage.ts). */
	modelAvailable: boolean;
	fetcher?: typeof fetch;
	now?: () => Date;
}

export interface RunReport extends RunCounts {
	outcome: 'finished' | 'come-back-later' | 'failed';
	problem: string | null;
	more: boolean;
}

const itemsPerStep = 10;

/** Nations whose newest choice restricts how the site shows their laws, opinions or agreements (decision record 0056). */
export async function restrictedNations(database: D1Database): Promise<Set<string>> {
	try {
		const { results } = await database
			.prepare(
				`SELECT nation_identifier, settings FROM nation_restriction_changes AS change
				 WHERE made_at = (SELECT MAX(made_at) FROM nation_restriction_changes WHERE nation_identifier = change.nation_identifier)`
			)
			.all<{ nation_identifier: string; settings: string }>();
		return new Set(results.filter((row) => restrictsAnything(readSettings(JSON.parse(row.settings)))).map((row) => row.nation_identifier));
	} catch {
		// Without the table (a fresh database), no nation restricts anything yet.
		return new Set();
	}
}

/** A changed regulation section's title, part and section, from the facts the eCFR watcher gives (watch/watchers/ecfr.ts). */
export function regulationOf(item: FoundItem): MatchInput['regulation'] {
	if (!item.kind.startsWith('regulation-section')) return null;
	const { title, part, section } = item.facts ?? {};
	if ((typeof title !== 'number' && typeof title !== 'string') || typeof section !== 'string') return null;
	return { title, part: typeof part === 'string' && part ? part : section.split('.')[0], section };
}

function message(problem: unknown): string {
	return problem instanceof Error ? problem.message : String(problem);
}

export async function runWatcher(watcher: WatcherDefinition, runIdentifier: string, dependencies: RunDependencies, steps: RunSteps = directSteps): Promise<RunReport> {
	const now = () => dependencies.now?.() ?? new Date();
	const { database, bucket } = dependencies;
	const counts: RunCounts = { found: 0, newItems: 0, closedByRules: 0, toReview: 0 };
	await steps.do('start', async () => {
		await startRun(database, runIdentifier, watcher.identifier, now());
		return true;
	});

	let lookup: KnownLookup | null = null;
	const known = async () => (lookup ??= lookupFor(await dependencies.known())).index;
	const fetchPolitely = (address: string, options = {}) => politeFetch(dependencies.desks, address, options, dependencies.fetcher);

	let checked: { items: FoundItem[]; cursor: string | null; more: boolean; notes: string[] };
	try {
		checked = await steps.do('check', async () => {
			const notes: string[] = [];
			const context: CheckContext = {
				cursor: await readCursor(database, watcher.identifier),
				now: now(),
				fetch: fetchPolitely,
				known,
				keep: (sourceIdentifier, file) => storeCapture(bucket, database, watcher.identifier, sourceIdentifier, file, now()),
				pages: pageMemory(database, watcher.identifier),
				pageTexts: bucketPageTexts(bucket),
				note: (line) => notes.push(line)
			};
			const result = await watcher.check(context);
			return { items: result.items, cursor: result.cursor, more: result.more ?? false, notes };
		});
	} catch (problem) {
		const later = problem instanceof ComeBackLater;
		const outcome = later ? 'come-back-later' : 'failed';
		await steps.do('finish', async () => {
			await finishRun(database, runIdentifier, outcome, counts, message(problem), now());
			return true;
		});
		return { ...counts, outcome, problem: message(problem), more: false };
	}

	counts.found = checked.items.length;
	const restricted = await steps.do('restrictions', async () => [...(await restrictedNations(database))]);
	const restrictedSet = new Set(restricted);

	for (let start = 0; start < checked.items.length; start += itemsPerStep) {
		const batch = checked.items.slice(start, start + itemsPerStep);
		const result = await steps.do(`items-${start}`, async () => {
			const batchCounts = { newItems: 0, closedByRules: 0, toReview: 0, later: null as string | null };
			lookup ??= lookupFor(await dependencies.known());
			for (const item of batch) {
				if (await candidateExists(database, watcher.identifier, item.sourceIdentifier)) continue;
				let capture = item.capture ?? null;
				let noModelText = item.noModelText ?? false;
				const federalRegisterNumber = typeof item.facts?.documentNumber === 'string' ? item.facts.documentNumber : null;
				const regulation = regulationOf(item);
				const nations = nationsNamedIn(lookup, `${item.title} ${item.summary ?? ''}`);
				const decide = () => {
					const match = matchKnown(lookup as KnownLookup, { title: item.title, link: item.link ?? item.fileAddress ?? null, federalRegisterNumber, sha256: capture?.sha256 ?? null, regulation });
					return { match, ruled: applyRules({ watcher, item: { ...item, noModelText }, match, nations, restrictedNations: restrictedSet, modelAvailable: dependencies.modelAvailable, now: now() }) };
				};
				let { match, ruled } = decide();
				// The file is fetched only for an item the rules did not close, so routine notices cost no download.
				if (!capture && item.fileAddress && ruled.status !== 'closed-by-rules') {
					try {
						const { response, modelMayRead } = await fetchPolitely(item.fileAddress);
						if (response.ok) {
							const bytes = await response.arrayBuffer();
							capture = await storeCapture(bucket, database, watcher.identifier, item.sourceIdentifier, { bytes, mediaType: response.headers.get('content-type') ?? 'application/octet-stream', address: item.fileAddress, entityTag: response.headers.get('etag'), lastModified: response.headers.get('last-modified') }, now());
							noModelText ||= !modelMayRead;
							({ match, ruled } = decide());
						} else {
							await response.body?.cancel();
						}
					} catch (problem) {
						// The host asked us to wait: leave this item and the rest for the next run, before the cursor moves.
						if (problem instanceof ComeBackLater) {
							batchCounts.later = message(problem);
							break;
						}
						if (!(problem instanceof NotAllowed)) throw problem;
					}
				}
				const added = await addCandidate(
					database,
					{
						watcher: watcher.identifier,
						sourceIdentifier: item.sourceIdentifier,
						kind: item.kind,
						title: item.title.slice(0, 1000),
						publishedOn: item.date ?? null,
						link: item.link ?? null,
						feeds: ruled.feeds,
						nations,
						// The matched record's title, for the review page, which cannot read the records.
						facts: { ...(item.facts ?? {}), ...(match.record && lookup?.titles.get(match.record) ? { matchTitle: lookup.titles.get(match.record) } : {}) },
						summary: item.summary?.slice(0, 8000) ?? null,
						captureKey: capture?.key ?? null,
						captureSha256: capture?.sha256 ?? null,
						previousCaptureKey: item.change?.previousKey ?? null,
						difference: item.change?.difference ?? null,
						matchKind: match.kind,
						matchRecord: match.record,
						proposed: ruled.proposed,
						relevance: ruled.relevance,
						triage: [ruled.step],
						sensitivity: ruled.sensitivity,
						noModelText,
						hosting: watcher.hosting,
						tier: watcher.tier,
						status: ruled.status
					},
					now()
				);
				if (!added) continue;
				batchCounts.newItems += 1;
				if (ruled.status === 'closed-by-rules') batchCounts.closedByRules += 1;
				if (ruled.status === 'to-review') batchCounts.toReview += 1;
			}
			return batchCounts;
		});
		counts.newItems += result.newItems;
		counts.closedByRules += result.closedByRules;
		counts.toReview += result.toReview;
		if (result.later) {
			await steps.do('finish', async () => {
				await finishRun(database, runIdentifier, 'come-back-later', counts, result.later, now());
				return true;
			});
			return { ...counts, outcome: 'come-back-later', problem: result.later, more: false };
		}
	}

	await steps.do('finish', async () => {
		await writeCursor(database, watcher.identifier, checked.cursor, now());
		await finishRun(database, runIdentifier, 'finished', counts, null, now());
		for (const line of checked.notes) console.log(`${watcher.identifier}: ${line}`);
		return true;
	});
	return { ...counts, outcome: 'finished', problem: null, more: checked.more };
}
