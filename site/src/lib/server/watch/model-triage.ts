/**
 * Asking the models about the middle band (./triage.ts). The watch Worker
 * runs this every minute when a provider is set: a few candidates waiting for
 * a model go to the cheap model, and the hard ones on to the top model. Once
 * a week the top model reads a sample of the cheap model's answers, and the
 * share it disagrees with is shown on the progress page.
 *
 * A candidate never reaches a model if it is held (./rules.ts) or its host
 * bars models from its text. When no provider is ready, waiting candidates go
 * to people instead, so nothing is stuck.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { nationsNamedIn, type KnownLookup } from './known.ts';
import { holdingFlags } from './rules.ts';
import { candidateFromRow, candidatesWithStatus, recordModelUse, recordTriage, type StoredCandidate, type TriageStep } from './store.ts';
import type { ModelCall, TriageAnswer, TriageProvider, TriageQuestion } from './triage.ts';
import type { SensitivityFlag } from './watcher.ts';

/** At most this many candidates a minute; AI Gateway allows 200 requests a minute per gateway. */
export const candidatesEachMinute = 10;
/** A "not relevant" answer at least this sure closes the item without a person; anything less goes to review. */
export const closeWhenSure = 0.85;
export const sampleSize = 10;

export function questionFor(candidate: StoredCandidate): TriageQuestion {
	return {
		candidate: candidate.identifier,
		watcher: candidate.watcher,
		title: candidate.title,
		date: candidate.publishedOn,
		link: candidate.link,
		summary: candidate.summary,
		facts: candidate.facts,
		feeds: candidate.feeds,
		possibleMatch: candidate.matchRecord
	};
}

/** Whether a candidate may be shown to a model at all. */
export function modelMayRead(candidate: StoredCandidate): boolean {
	return !candidate.noModelText && !candidate.sensitivity.some((flag) => holdingFlags.includes(flag));
}

function step(kind: TriageStep['step'], call: ModelCall, now: Date): TriageStep {
	const answer = call.answer.relevant ? `${call.answer.proposed} → ${call.answer.collection}` : 'not-relevant';
	return { step: kind, by: call.model, answer, reason: call.answer.reason, at: now.toISOString() };
}

async function useOf(database: D1Database, call: ModelCall, now: Date): Promise<void> {
	await recordModelUse(database, { model: call.model, ...call.use, costMicrodollars: call.costMicrodollars }, now);
}

export interface TriageReport {
	asked: number;
	toReview: number;
	closed: number;
	held: number;
	released: number;
	problem: string | null;
}

/** What the answer means for the candidate. */
export function outcomeOf(answer: TriageAnswer, lookup: KnownLookup | null, current: StoredCandidate) {
	const sensitivity: SensitivityFlag[] = [...new Set([...current.sensitivity, ...answer.sensitivity])];
	const nations = lookup ? [...new Set([...current.nations, ...nationsNamedIn(lookup, answer.nations.join('; '))])] : current.nations;
	const feeds = answer.collection && answer.collection !== 'none' ? [answer.collection, ...current.feeds.filter((feed) => feed !== answer.collection)] : current.feeds;
	if (answer.sensitivity.length > 0) return { status: 'held' as const, sensitivity, nations, feeds, proposed: null, relevance: answer.confidence };
	if (!answer.relevant && answer.proposed === 'not-relevant' && answer.confidence >= closeWhenSure) {
		return { status: 'closed-by-rules' as const, sensitivity, nations, feeds, proposed: null, relevance: 1 - answer.confidence };
	}
	const proposed = answer.proposed === 'not-relevant' ? null : answer.proposed;
	return { status: 'to-review' as const, sensitivity, nations, feeds, proposed, relevance: answer.relevant ? answer.confidence : 1 - answer.confidence };
}

/** Asks the models about up to `limit` waiting candidates. */
export async function triageWaiting(database: D1Database, provider: TriageProvider, lookup: KnownLookup | null, now: Date, limit = candidatesEachMinute): Promise<TriageReport> {
	const report: TriageReport = { asked: 0, toReview: 0, closed: 0, held: 0, released: 0, problem: null };
	const waiting = await candidatesWithStatus(database, ['waiting-for-model'], limit);
	for (const candidate of waiting) {
		if (provider.ready !== true || !modelMayRead(candidate)) {
			const reason = provider.ready === true ? 'No model may read this item, so a person decides.' : `${provider.ready.problem} A person decides.`;
			await recordTriage(database, candidate.identifier, { step: 'rules', by: 'triage', answer: 'to-review', reason, at: now.toISOString() }, { status: 'to-review' }, now);
			report.released += 1;
			continue;
		}
		try {
			const cheap = await provider.classify(questionFor(candidate));
			await useOf(database, cheap, now);
			report.asked += 1;
			let final = cheap;
			if (cheap.answer.hard || cheap.answer.proposed === 'new-version') {
				await recordTriage(database, candidate.identifier, step('cheap-model', cheap, now), {}, now);
				final = await provider.decideHard(questionFor(candidate), cheap.answer);
				await useOf(database, final, now);
			}
			const outcome = outcomeOf(final.answer, lookup, candidate);
			await recordTriage(database, candidate.identifier, step(final === cheap ? 'cheap-model' : 'top-model', final, now), outcome, now);
			if (outcome.status === 'to-review') report.toReview += 1;
			if (outcome.status === 'closed-by-rules') report.closed += 1;
			if (outcome.status === 'held') report.held += 1;
		} catch (problem) {
			// The candidate keeps waiting; the progress page shows the problem.
			report.problem = problem instanceof Error ? problem.message : String(problem);
			break;
		}
	}
	return report;
}

export interface SampleReport {
	checked: number;
	disagreed: number;
	problem: string | null;
}

/** The weekly check: the top model reads a random sample of the cheap model's answers from the last week. */
export async function checkSample(database: D1Database, provider: TriageProvider, now: Date, size = sampleSize): Promise<SampleReport> {
	const report: SampleReport = { checked: 0, disagreed: 0, problem: null };
	if (provider.ready !== true) return { ...report, problem: provider.ready.problem };
	const since = new Date(now.getTime() - 7 * 86_400_000).toISOString();
	const { results } = await database
		.prepare(`SELECT identifier FROM watch_candidates WHERE updated_at >= ? AND triage LIKE '%"step":"cheap-model"%' AND triage NOT LIKE '%"step":"top-model"%' ORDER BY RANDOM() LIMIT ?`)
		.bind(since, size)
		.all<{ identifier: number }>();
	for (const { identifier } of results) {
		const row = await database.prepare('SELECT * FROM watch_candidates WHERE identifier = ?').bind(identifier).first<Parameters<typeof candidateFromRow>[0]>();
		if (!row) continue;
		const candidate = candidateFromRow(row);
		if (!modelMayRead(candidate)) continue;
		const cheapStep = [...candidate.triage].reverse().find((entry) => entry.step === 'cheap-model');
		try {
			const top = await provider.decideHard(questionFor(candidate), null);
			await useOf(database, top, now);
			const cheapRelevant = cheapStep ? cheapStep.answer !== 'not-relevant' : true;
			const agrees = cheapRelevant === top.answer.relevant && (!top.answer.relevant || (cheapStep?.answer.endsWith(top.answer.collection) ?? false));
			report.checked += 1;
			if (!agrees) report.disagreed += 1;
			await recordTriage(database, candidate.identifier, { ...step('sample-check', top, now), answer: `${agrees ? 'agrees' : 'disagrees'}: ${top.answer.relevant ? `${top.answer.proposed} → ${top.answer.collection}` : 'not-relevant'}` }, {}, now);
		} catch (problem) {
			report.problem = problem instanceof Error ? problem.message : String(problem);
			break;
		}
	}
	return report;
}
