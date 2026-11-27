/**
 * The source watch changes that came from the Workers AI and Claude
 * comparison (research/analyses/2026-11-26-workers-ai-vs-claude-triage.md,
 * section 7): asking again on an empty, cut-off or "too many requests"
 * answer, the Claude request without a forced tool, the narrower privacy
 * instruction and collection list, regulation sections matched to their
 * part by rule, and the Indian subparts of 43 C.F.R. part 4.
 */
import { describe, expect, it } from 'vitest';
import { emptyKnownIdentifiers, lookupFor, matchKnown, regulationKey, regulationOfCitation, type KnownIdentifiers } from '../src/lib/server/watch/known.ts';
import { costMicrodollars, modelPrices } from '../src/lib/server/watch/model-prices.ts';
import { triageWaiting } from '../src/lib/server/watch/model-triage.ts';
import { applyRules } from '../src/lib/server/watch/rules.ts';
import { regulationOf } from '../src/lib/server/watch/run.ts';
import { addCandidate, candidatesWithStatus } from '../src/lib/server/watch/store.ts';
import { askWithRetry, chooseTriageProvider, NoAnswer, readAnswer, readWorkersAnswer, tooManyRequests, triageInstructions, type TriageAnswer } from '../src/lib/server/watch/triage.ts';
import ecfr, { inWatchedSubpart, itemFor as ecfrItem } from '../watch/watchers/ecfr.ts';

import { testDatabase } from './database.ts';

const answer: TriageAnswer = { relevant: true, collection: 'tribal-codes', nations: [], proposed: 'add', hard: false, sensitivity: [], confidence: 0.9, reason: 'A code.' };
const use = { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 };

describe('asking a model again', () => {
	const noWait = async () => undefined;

	it('asks once more after an empty answer, and counts both calls', async () => {
		let calls = 0;
		const call = await askWithRetry(
			async () => {
				calls += 1;
				if (calls === 1) throw new NoAnswer('empty', use);
				return { answer, use };
			},
			'@cf/thinkingmachines/inkling-2-small',
			4000,
			noWait
		);
		expect(calls).toBe(2);
		expect(call.use.inputTokens).toBe(200);
		expect(call.costMicrodollars).toBe(costMicrodollars('@cf/thinkingmachines/inkling-2-small', call.use));
	});

	it('gives twice the room after a cut-off answer, and throws the second miss with both calls’ tokens', async () => {
		const limits: number[] = [];
		const missed = await askWithRetry(
			async (limit) => {
				limits.push(limit);
				throw new NoAnswer('cut-off', use);
			},
			'@cf/thinkingmachines/inkling-2-small',
			16000,
			noWait
		).catch((problem) => problem);
		expect(limits).toEqual([16000, 32000]);
		expect(missed).toBeInstanceOf(NoAnswer);
		expect((missed as NoAnswer).use.outputTokens).toBe(20);
	});

	it('waits and asks again after "too many requests", but not after other failures', async () => {
		const waits: number[] = [];
		let calls = 0;
		await askWithRetry(
			async () => {
				calls += 1;
				if (calls === 1) throw new Error('AiError: 3040: Capacity temporarily exceeded, please try again.');
				return { answer, use };
			},
			'm',
			4000,
			async (milliseconds) => void waits.push(milliseconds)
		);
		expect(waits).toHaveLength(1);
		expect(tooManyRequests({ status: 429 })).toBe(true);
		expect(tooManyRequests(new Error('Too Many Requests'))).toBe(true);
		calls = 0;
		await expect(askWithRetry(async () => { calls += 1; throw new Error('Bad request'); }, 'm', 4000, noWait)).rejects.toThrow('Bad request');
		expect(calls).toBe(1);
	});

	it('treats an answer stopped at the token limit as cut off, whatever it holds', () => {
		expect(() => readAnswer({ stop_reason: 'max_tokens', content: [{ type: 'tool_use', name: 'classify', input: { relevant: true } }] })).toThrow(NoAnswer);
		expect(() => readWorkersAnswer({ choices: [{ finish_reason: 'length', message: {} }], usage: { prompt_tokens: 5, completion_tokens: 4000 } })).toThrow(/cut off/);
		expect(() => readWorkersAnswer({ choices: [{ message: { content: '' } }] })).toThrow(NoAnswer);
	});
});

describe('the Claude request through AI Gateway', () => {
	it('offers the tool without forcing it, keeps it to the schema, and gives thinking room', async () => {
		const inputs: Record<string, unknown>[] = [];
		const provider = chooseTriageProvider({
			WATCH_TRIAGE_PROVIDER: 'ai-gateway',
			models: {
				run: async (_model, input) => {
					inputs.push(input);
					return { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', name: 'classify', input: answer }], usage: { input_tokens: 10, output_tokens: 5 } };
				}
			}
		});
		const question = { candidate: 1, watcher: 'federal-register', title: 'A notice', date: null, link: null, summary: null, facts: {}, feeds: [], possibleMatch: null };
		expect((await provider.classify(question)).answer.collection).toBe('tribal-codes');
		await provider.decideHard(question, null);
		for (const input of inputs) {
			expect(input.tool_choice).toEqual({ type: 'auto' });
			expect((input.tools as { strict?: boolean; input_schema: { additionalProperties?: boolean } }[])[0]).toMatchObject({ strict: true, input_schema: { additionalProperties: false } });
		}
		expect(inputs.map((input) => [input.max_tokens, (input.output_config as { effort: string }).effort])).toEqual([
			[4000, 'low'],
			[16000, 'high']
		]);
	});

	it('prices Opus 5.5 cache reads at $0.20 a million tokens', () => {
		expect(modelPrices['anthropic/claude-opus-5.5'].cachedInput).toBe(0.2);
	});
});

describe('the instructions', () => {
	it('flag particular people, not rules or pages that name kinds of cases', () => {
		expect(triageInstructions).not.toMatch(/if anything suggests/);
		expect(triageInstructions).toMatch(/particular child or family/);
		expect(triageInstructions).toMatch(/court page or list of a code’s chapters that only names these kinds of matters is not about a particular person/);
	});

	it('list regulation sections as a collection', () => {
		expect(triageInstructions).toMatch(/^ {2}- regulation-sections: /m);
	});
});

describe('a model that gives no answer twice', () => {
	const candidate = {
		watcher: 'federal-register',
		sourceIdentifier: 'x-1',
		kind: 'notice',
		title: 'A notice about water',
		publishedOn: '2026-11-26',
		link: null,
		feeds: [],
		nations: [],
		facts: {},
		summary: null,
		captureKey: null,
		captureSha256: null,
		previousCaptureKey: null,
		difference: null,
		matchKind: 'none' as const,
		matchRecord: null,
		proposed: null,
		relevance: null,
		triage: [],
		sensitivity: [],
		noModelText: false,
		hosting: 'serve' as const,
		tier: 1 as const,
		status: 'waiting-for-model' as const
	};

	it('sends the item to a person and goes on to the next', async () => {
		const database = testDatabase();
		const now = new Date('2026-11-26T12:00:00Z');
		await addCandidate(database, candidate, now);
		await addCandidate(database, { ...candidate, sourceIdentifier: 'x-2' }, now);
		let calls = 0;
		const provider = chooseTriageProvider({
			models: {
				run: async () => {
					calls += 1;
					// The first item's two calls come back empty; the second item is answered.
					return calls <= 2 ? { choices: [{ message: { content: '' } }], usage: { prompt_tokens: 10, completion_tokens: 1 } } : { choices: [{ message: { tool_calls: [{ function: { name: 'classify', arguments: JSON.stringify(answer) } }] } }] };
				}
			}
		});
		const report = await triageWaiting(database, provider, null, now);
		expect(report).toMatchObject({ asked: 2, toReview: 2, problem: null });
		const reviewed = await candidatesWithStatus(database, ['to-review'], 10);
		expect(reviewed.map((item) => item.triage.at(-1)?.reason)).toContain('The model gave no answer twice, so a person decides.');
		const spend = await database.prepare('SELECT calls, input_tokens FROM watch_model_spend').first<{ calls: number; input_tokens: number }>();
		expect(spend).toMatchObject({ calls: 2, input_tokens: 20 });
	});
});

describe('regulation sections and their parts', () => {
	const index: KnownIdentifiers = {
		...emptyKnownIdentifiers,
		sources: [
			{ key: 'cfr-25-part-522', kind: 'federal-regulation', title: 'Submission of Gaming Ordinance or Resolution', link: 'https://ecfr.gov/current/title-25/part-522', regulation: regulationKey(25, '522') },
			{ key: 'cfr-25-83-1', kind: 'federal-regulation', title: 'Definitions', link: 'https://ecfr.gov/current/title-25/section-83.1', regulation: regulationKey(25, '83', '83.1') }
		]
	};
	const lookup = lookupFor(index);

	it('reads parts and sections from records’ citations', () => {
		expect(regulationOfCitation({ 'container-title': 'Code of Federal Regulations', volume: '25', section: 'pt. 522' })).toBe('25 CFR part 522');
		expect(regulationOfCitation({ 'container-title': 'Electronic Code of Federal Regulations (LII)', volume: '42', section: 'pt. 136a' })).toBe('42 CFR part 136a');
		expect(regulationOfCitation({ 'container-title': 'Code of Federal Regulations', volume: '25', section: '83.1' })).toBe('25 CFR § 83.1');
		expect(regulationOfCitation({ 'container-title': 'United States Code', volume: '25', section: '5304' })).toBeUndefined();
	});

	it('proposes a changed section as a new version of the part we hold, or of its own record', () => {
		const version = { date: '2026-10-08', amendment_date: '2026-10-08', issue_date: '2026-10-10', identifier: '522.2', name: '§ 522.2 Submission requirements.', part: '522', substantive: true, removed: false, title: '25', type: 'section' };
		const found = ecfrItem(version);
		expect(regulationOf(found)).toEqual({ title: 25, part: '522', section: '522.2' });
		expect(matchKnown(lookup, { title: found.title, link: found.link, regulation: regulationOf(found) })).toMatchObject({ kind: 'new-version', record: 'cfr-25-part-522' });
		// The section's link is already a record, but a change to it is a new version, not "already have it".
		const own = ecfrItem({ ...version, identifier: '83.1', part: '83', name: '§ 83.1 Definitions.' });
		expect(matchKnown(lookup, { title: own.title, link: own.link, regulation: regulationOf(own) })).toMatchObject({ kind: 'new-version', record: 'cfr-25-83-1' });
		expect(matchKnown(lookup, { title: 'x', regulation: { title: 25, part: '900', section: '900.1' } }).kind).toBe('none');
	});

	it('reviews a substantive change as a new version, and keeps editorial changes closed', () => {
		const version = { date: '2026-10-08', amendment_date: '2026-10-08', issue_date: '2026-10-10', identifier: '522.2', name: '§ 522.2 Submission requirements.', part: '522', substantive: true, removed: false, title: '25', type: 'section' };
		const rules = (substantive: boolean) => {
			const found = ecfrItem({ ...version, substantive });
			const match = matchKnown(lookup, { title: found.title, link: found.link, regulation: regulationOf(found) });
			return applyRules({ watcher: ecfr, item: found, match, nations: [], restrictedNations: new Set(), modelAvailable: true, now: new Date('2026-11-26T12:00:00Z') });
		};
		expect(rules(true)).toMatchObject({ status: 'to-review', proposed: 'new-version' });
		expect(rules(false).status).toBe('closed-by-rules');
	});
});

describe('43 C.F.R. part 4', () => {
	it('watches only its Indian subparts', () => {
		expect(inWatchedSubpart({ title: '43', part: '4', subpart: 'D' })).toBe(true);
		expect(inWatchedSubpart({ title: '43', part: '4', subpart: 'K' })).toBe(true);
		expect(inWatchedSubpart({ title: '43', part: '4', subpart: 'C' })).toBe(false);
		expect(inWatchedSubpart({ title: '43', part: '4', subpart: 'L' })).toBe(false);
		// No subpart given: kept, so nothing is missed.
		expect(inWatchedSubpart({ title: '43', part: '4', subpart: null })).toBe(true);
		expect(inWatchedSubpart({ title: '25', part: '522', subpart: 'A' })).toBe(true);
	});
});
