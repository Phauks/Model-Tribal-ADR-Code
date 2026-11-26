/**
 * Triage, steps 2 and 3: the models (docs/source-watch.md, "Triage" and
 * "Where the models run"). The provider is a setting on the watch Worker,
 * WATCH_TRIAGE_PROVIDER, swapped like the scanner's SCAN_PROVIDER:
 *
 * - "none" (the default): rules only. The middle band goes straight to a
 *   person on the review page.
 * - "ai-gateway": the Worker asks Claude through Cloudflare AI Gateway with
 *   its AI binding, billed to the account's Unified Billing credits. No
 *   Anthropic key and no secret on the Worker. Trevor chose this on
 *   Nov. 26, 2026. Claude Haiku 5.5 reads the middle band; Claude Opus 5.5
 *   takes the hard cases and checks a sample of Haiku's answers each week.
 * - "nightly-task": option A of the design, a nightly scheduled task. Not
 *   built, since Trevor chose AI Gateway; the setting is kept so the choice
 *   stays swappable.
 *
 * What a model may read: an item's title, the summary its source published,
 * its facts (agency, document type, C.F.R. parts) and the title of a record
 * it may match. Never a held item (a child or family case, a protection
 * order, a Tribal court opinion, a nation's restricted material), never text
 * from a host whose robots.txt or content signals bar AI use, and never
 * anything about the project's users. Tribal court opinions are held by rule
 * before this step (./rules.ts), so no opinion text reaches a model until the
 * initials step of decision record 0057 runs inside the Worker.
 */
import { costMicrodollars, type TokenUse } from './model-prices.ts';
import type { Feed, ProposedAction, SensitivityFlag } from './watcher.ts';

export const triageProviderNames = ['none', 'ai-gateway', 'nightly-task'] as const;
export type TriageProviderName = (typeof triageProviderNames)[number];

export const defaultGateway = 'source-watch';
export const defaultCheapModel = 'anthropic/claude-haiku-5.5';
export const defaultTopModel = 'anthropic/claude-opus-5.5';

/** What a model is shown about one item. */
export interface TriageQuestion {
	candidate: number;
	watcher: string;
	title: string;
	date: string | null;
	link: string | null;
	summary: string | null;
	facts: Record<string, unknown>;
	/** The collections the item might join, as the watcher and rules see it. */
	feeds: Feed[];
	/** A record the dedupe step thinks it may match. */
	possibleMatch: string | null;
}

/** A model's structured answer. */
export interface TriageAnswer {
	relevant: boolean;
	collection: string;
	nations: string[];
	proposed: ProposedAction | 'not-relevant';
	/** For the top model: does this amend or replace something we hold, do sources disagree, is a flag in doubt. */
	hard: boolean;
	sensitivity: SensitivityFlag[];
	confidence: number;
	reason: string;
}

export interface ModelCall {
	answer: TriageAnswer;
	model: string;
	use: TokenUse;
	costMicrodollars: number;
}

export interface TriageProvider {
	name: TriageProviderName;
	/** Whether it is set up enough to be asked; when not, why. */
	ready: true | { problem: string };
	/** The cheap model's answer. */
	classify(question: TriageQuestion): Promise<ModelCall>;
	/** The top model's answer, for a hard case or a sample check. */
	decideHard(question: TriageQuestion, earlier: TriageAnswer | null): Promise<ModelCall>;
}

export interface TriageSettings {
	WATCH_TRIAGE_PROVIDER?: string;
	WATCH_GATEWAY?: string;
	WATCH_CHEAP_MODEL?: string;
	WATCH_TOP_MODEL?: string;
	/** The Worker's AI binding (wrangler.jsonc "ai"). */
	modelGateway?: ModelBinding;
}

/** The part of the AI binding the watch uses: env.AI.run(model, input, { gateway: { id } }). */
export interface ModelBinding {
	run(model: string, input: Record<string, unknown>, options: { gateway: { id: string } }): Promise<unknown>;
}

export function providerName(settings: TriageSettings): TriageProviderName {
	const chosen = (settings.WATCH_TRIAGE_PROVIDER ?? 'none').trim().toLowerCase();
	return (triageProviderNames as readonly string[]).includes(chosen) ? (chosen as TriageProviderName) : 'none';
}

const unanswerable = (problem: string) => async (): Promise<ModelCall> => {
	throw new Error(problem);
};

/** The provider the settings name. A provider that is named but not ready says why, and the middle band goes to people. */
export function chooseTriageProvider(settings: TriageSettings): TriageProvider {
	const name = providerName(settings);
	if (name === 'ai-gateway') {
		if (!settings.modelGateway) {
			const problem = 'The watch Worker has no AI binding named modelGateway (site/watch/wrangler.jsonc).';
			return { name, ready: { problem }, classify: unanswerable(problem), decideHard: unanswerable(problem) };
		}
		return gatewayProvider(settings.modelGateway, {
			gateway: settings.WATCH_GATEWAY?.trim() || defaultGateway,
			cheapModel: settings.WATCH_CHEAP_MODEL?.trim() || defaultCheapModel,
			topModel: settings.WATCH_TOP_MODEL?.trim() || defaultTopModel
		});
	}
	if (name === 'nightly-task') {
		const problem = 'The nightly-task provider is not built; Trevor chose AI Gateway on Nov. 26, 2026. Set WATCH_TRIAGE_PROVIDER to ai-gateway or none.';
		return { name, ready: { problem }, classify: unanswerable(problem), decideHard: unanswerable(problem) };
	}
	const problem = 'Triage by model is off (WATCH_TRIAGE_PROVIDER is none).';
	return { name: 'none', ready: { problem }, classify: unanswerable(problem), decideHard: unanswerable(problem) };
}

/* The questions ----------------------------------------------------------- */

const collectionsList = [
	'native-nations: a nation’s recognition, name or listing',
	'governing-documents: a nation’s constitution, code or compact over time',
	'tribal-constitutions',
	'tribal-codes: a nation’s codes, ordinances and court rules',
	'intergovernmental-agreements: compacts and agreements between a nation and a state or the United States',
	'federal-statutes',
	'federal-regulations',
	'executive-orders',
	'federal-register-notices: other Federal Register notices about Native nations’ law',
	'supreme-court-cases',
	'other-court-cases',
	'nation:land_establishment: reservations and land taken into trust',
	'nation:jurisdiction: criminal and civil jurisdiction',
	'nation:gaming',
	'none: not about Native nations’ law or government'
];

/**
 * The fixed instructions, sent with a cache mark so repeated calls read them
 * from the cache (Haiku 5.5's cached input is a tenth of its input price).
 */
export const triageInstructions = `You sort items found by the Tribal Law Project's source watch, a nonprofit public library of Native nations' law. Each item is a document a government source published: its title, the summary the source gave, and facts such as the agency. Decide whether the library should hold it, and where.

Answer only with the classify tool. Rules:
- relevant is true only if the item is about the law, government, courts, lands, gaming, recognition or rights of Native nations (federally recognized tribes, Alaska Native villages) or federal Indian law. A notice from another agency that merely mentions consultation with tribes is not relevant.
- collection is one identifier from this list:
${collectionsList.map((line) => `  - ${line}`).join('\n')}
- nations lists the nations the item names, exactly as written in it. Do not guess nations it does not name.
- proposed is "add" for a new item, "new-version" if it amends, extends or replaces a compact, code or constitution, "note" for a proposed rule or an item worth noting but not holding, or "not-relevant".
- hard is true if deciding needs a careful legal reading: whether it amends, extends or replaces a specific compact or code and which clauses changed, or whether two sources disagree.
- sensitivity lists "child-or-family-case" if anything suggests a juvenile, child welfare, Indian Child Welfare Act, adoption, guardianship or custody matter, and "protection-order" for a protection or restraining order. Otherwise an empty list.
- confidence is 0 to 1.
- reason is one or two plain sentences, under 300 characters. Never quote more than a few words, and never write a summary of the document for publication.`;

const answerSchema = {
	type: 'object',
	properties: {
		relevant: { type: 'boolean' },
		collection: { type: 'string' },
		nations: { type: 'array', items: { type: 'string' } },
		proposed: { type: 'string', enum: ['add', 'new-version', 'note', 'not-relevant'] },
		hard: { type: 'boolean' },
		sensitivity: { type: 'array', items: { type: 'string', enum: ['child-or-family-case', 'protection-order'] } },
		confidence: { type: 'number' },
		reason: { type: 'string' }
	},
	required: ['relevant', 'collection', 'nations', 'proposed', 'hard', 'sensitivity', 'confidence', 'reason']
} as const;

export function questionText(question: TriageQuestion, earlier: TriageAnswer | null = null): string {
	const lines = [
		`Title: ${question.title}`,
		question.date ? `Published: ${question.date}` : '',
		question.link ? `Link: ${question.link}` : '',
		`Found by: ${question.watcher}`,
		Object.keys(question.facts).length > 0 ? `Facts: ${JSON.stringify(question.facts)}` : '',
		question.feeds.length > 0 ? `The watcher thinks it may join: ${question.feeds.join(', ')}` : '',
		question.possibleMatch ? `It may be the same as, or a new version of, the record: ${question.possibleMatch}` : '',
		question.summary ? `Summary from the source:\n${question.summary.slice(0, 4000)}` : 'The source gave no summary.',
		earlier ? `A first reading answered: ${JSON.stringify(earlier)}. Check it carefully and give your own answer.` : ''
	];
	return lines.filter(Boolean).join('\n');
}

/** Reads the classify tool's input out of an Anthropic Messages answer. */
export function readAnswer(message: unknown): { answer: TriageAnswer; use: TokenUse } {
	const body = message as {
		content?: { type: string; name?: string; input?: unknown }[];
		usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
	};
	const call = body.content?.find((block) => block.type === 'tool_use' && block.name === 'classify');
	if (!call || typeof call.input !== 'object' || call.input === null) throw new Error('The model did not answer with the classify tool.');
	const input = call.input as Partial<TriageAnswer>;
	const sensitivity = (Array.isArray(input.sensitivity) ? input.sensitivity : []).filter((flag): flag is SensitivityFlag => flag === 'child-or-family-case' || flag === 'protection-order');
	const proposed = (['add', 'new-version', 'note', 'not-relevant'] as const).find((value) => value === input.proposed) ?? 'note';
	const answer: TriageAnswer = {
		relevant: input.relevant === true,
		collection: typeof input.collection === 'string' ? input.collection : 'none',
		nations: Array.isArray(input.nations) ? input.nations.filter((name): name is string => typeof name === 'string').slice(0, 20) : [],
		proposed,
		hard: input.hard === true,
		sensitivity,
		confidence: typeof input.confidence === 'number' ? Math.min(1, Math.max(0, input.confidence)) : 0,
		reason: typeof input.reason === 'string' ? input.reason.slice(0, 400) : ''
	};
	const usage = body.usage ?? {};
	return {
		answer,
		use: {
			inputTokens: usage.input_tokens ?? 0,
			outputTokens: usage.output_tokens ?? 0,
			cacheReadTokens: usage.cache_read_input_tokens ?? 0,
			cacheWriteTokens: usage.cache_creation_input_tokens ?? 0
		}
	};
}

function messagesInput(question: TriageQuestion, earlier: TriageAnswer | null, maxTokens: number): Record<string, unknown> {
	return {
		max_tokens: maxTokens,
		system: [{ type: 'text', text: triageInstructions, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content: questionText(question, earlier) }],
		tools: [{ name: 'classify', description: 'Record where this item belongs.', input_schema: answerSchema }],
		tool_choice: { type: 'tool', name: 'classify' }
	};
}

function gatewayProvider(binding: ModelBinding, options: { gateway: string; cheapModel: string; topModel: string }): TriageProvider {
	const ask = async (model: string, question: TriageQuestion, earlier: TriageAnswer | null, maxTokens: number): Promise<ModelCall> => {
		const message = await binding.run(model, messagesInput(question, earlier, maxTokens), { gateway: { id: options.gateway } });
		const { answer, use } = readAnswer(message);
		return { answer, model, use, costMicrodollars: costMicrodollars(model, use) };
	};
	return {
		name: 'ai-gateway',
		ready: true,
		classify: (question) => ask(options.cheapModel, question, null, 600),
		decideHard: (question, earlier) => ask(options.topModel, question, earlier, 1200)
	};
}
