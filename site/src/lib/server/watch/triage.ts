/**
 * Triage, steps 2 and 3: the models (docs/source-watch.md, "Triage" and
 * "Where the models run"). The provider is a setting on the watch Worker,
 * WATCH_TRIAGE_PROVIDER, swapped like the scanner's SCAN_PROVIDER:
 *
 * - "workers-ai" (the default): the Worker asks a model that Cloudflare
 *   runs itself, through its Workers AI binding, billed on the account's
 *   Workers Paid plan. Nothing to set up: no gateway, no credits, no key and
 *   no secret. Trevor asked for this on Nov. 26, 2026, after finding the AI
 *   Gateway steps hard to follow. The model is Inkling 2 Small
 *   (@cf/thinkingmachines/inkling-2-small), the most capable open model on
 *   Workers AI when chosen: added Nov. 12, 2026, with function calling, zero
 *   data retention, and $0.30 a million input tokens and $1.00 a million
 *   output tokens (https://developers.cloudflare.com/workers-ai/models/inkling-2-small/,
 *   https://developers.cloudflare.com/changelog/post/2026-11-12-inkling-2-small-workers-ai/).
 *   It reads the middle band with low reasoning effort and the hard cases
 *   and the weekly sample check with high effort.
 * - "ai-gateway": the Worker asks Claude through Cloudflare AI Gateway with
 *   the same binding, billed to the account's Unified Billing credits.
 *   Claude Haiku 5.5 reads the middle band; Claude Opus 5.5 takes the hard
 *   cases and checks a sample of Haiku's answers each week. Kept as an
 *   option; it needs a gateway named source-watch and loaded credits.
 * - "none": rules only. The middle band goes straight to a person on the
 *   review page.
 * - "nightly-task": option A of the design, a nightly scheduled task. Not
 *   built; the setting is kept so the choice stays swappable.
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

export const triageProviderNames = ['workers-ai', 'ai-gateway', 'none', 'nightly-task'] as const;
export type TriageProviderName = (typeof triageProviderNames)[number];

export const defaultTriageProvider: TriageProviderName = 'workers-ai';
export const defaultGateway = 'source-watch';

/** Each provider's models when WATCH_CHEAP_MODEL or WATCH_TOP_MODEL is left empty. */
export const defaultModels = {
	'workers-ai': { cheap: '@cf/thinkingmachines/inkling-2-small', top: '@cf/thinkingmachines/inkling-2-small' },
	'ai-gateway': { cheap: 'anthropic/claude-haiku-5.5', top: 'anthropic/claude-opus-5.5' }
} as const;

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
	/** The Worker's AI binding (wrangler.jsonc "ai"), for Workers AI and for AI Gateway. */
	models?: ModelBinding;
}

/** The part of the AI binding the watch uses: env.AI.run(model, input), with { gateway: { id } } for AI Gateway. */
export interface ModelBinding {
	run(model: string, input: Record<string, unknown>, options?: { gateway: { id: string } }): Promise<unknown>;
}

/** The provider the settings name; an empty or unknown setting means the default. */
export function providerName(settings: TriageSettings): TriageProviderName {
	const chosen = (settings.WATCH_TRIAGE_PROVIDER ?? '').trim().toLowerCase();
	return (triageProviderNames as readonly string[]).includes(chosen) ? (chosen as TriageProviderName) : defaultTriageProvider;
}

/** The models the chosen provider asks, or null when it asks none. */
export function chosenModels(settings: TriageSettings): { cheap: string; top: string } | null {
	const name = providerName(settings);
	if (name !== 'workers-ai' && name !== 'ai-gateway') return null;
	return { cheap: settings.WATCH_CHEAP_MODEL?.trim() || defaultModels[name].cheap, top: settings.WATCH_TOP_MODEL?.trim() || defaultModels[name].top };
}

const unanswerable = (problem: string) => async (): Promise<ModelCall> => {
	throw new Error(problem);
};

/** The provider the settings name. A provider that is named but not ready says why, and the middle band goes to people. */
export function chooseTriageProvider(settings: TriageSettings): TriageProvider {
	const name = providerName(settings);
	if (name === 'workers-ai' || name === 'ai-gateway') {
		if (!settings.models) {
			const problem = 'The watch Worker has no AI binding named models (site/watch/wrangler.jsonc).';
			return { name, ready: { problem }, classify: unanswerable(problem), decideHard: unanswerable(problem) };
		}
		const chosen = chosenModels(settings) ?? defaultModels[name];
		const models = { cheapModel: chosen.cheap, topModel: chosen.top };
		if (name === 'workers-ai') return workersProvider(settings.models, models);
		return gatewayProvider(settings.models, { gateway: settings.WATCH_GATEWAY?.trim() || defaultGateway, ...models });
	}
	if (name === 'nightly-task') {
		const problem = 'The nightly-task provider is not built. Set WATCH_TRIAGE_PROVIDER to workers-ai, ai-gateway or none.';
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
	const usage = body.usage ?? {};
	return {
		answer: tidyAnswer(call.input as Partial<TriageAnswer>),
		use: {
			inputTokens: usage.input_tokens ?? 0,
			outputTokens: usage.output_tokens ?? 0,
			cacheReadTokens: usage.cache_read_input_tokens ?? 0,
			cacheWriteTokens: usage.cache_creation_input_tokens ?? 0
		}
	};
}

/**
 * Reads the classify call out of a Workers AI answer: the Chat Completions
 * shape (choices[0].message.tool_calls, with arguments as a JSON string) the
 * current models give, or the older shape with tool_calls at the top.
 */
export function readWorkersAnswer(message: unknown): { answer: TriageAnswer; use: TokenUse } {
	type Call = { name?: string; arguments?: unknown; function?: { name?: string; arguments?: unknown } };
	const body = message as {
		choices?: { message?: { tool_calls?: Call[] } }[];
		tool_calls?: Call[];
		usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
	};
	const calls = body.choices?.[0]?.message?.tool_calls ?? body.tool_calls ?? [];
	const call = calls.find((each) => (each.function?.name ?? each.name) === 'classify');
	let input = call?.function?.arguments ?? call?.arguments;
	if (typeof input === 'string') {
		try {
			input = JSON.parse(input);
		} catch {
			input = null;
		}
	}
	if (!input || typeof input !== 'object') throw new Error('The model did not answer with the classify tool.');
	const usage = body.usage ?? {};
	const cached = usage.prompt_tokens_details?.cached_tokens ?? 0;
	return {
		answer: tidyAnswer(input as Partial<TriageAnswer>),
		// Chat Completions counts cached tokens inside prompt_tokens.
		use: { inputTokens: Math.max(0, (usage.prompt_tokens ?? 0) - cached), outputTokens: usage.completion_tokens ?? 0, cacheReadTokens: cached, cacheWriteTokens: 0 }
	};
}

/** Keeps only the answer's known fields, in range. */
function tidyAnswer(input: Partial<TriageAnswer>): TriageAnswer {
	const sensitivity = (Array.isArray(input.sensitivity) ? input.sensitivity : []).filter((flag): flag is SensitivityFlag => flag === 'child-or-family-case' || flag === 'protection-order');
	const proposed = (['add', 'new-version', 'note', 'not-relevant'] as const).find((value) => value === input.proposed) ?? 'note';
	return {
		relevant: input.relevant === true,
		collection: typeof input.collection === 'string' ? input.collection : 'none',
		nations: Array.isArray(input.nations) ? input.nations.filter((name): name is string => typeof name === 'string').slice(0, 20) : [],
		proposed,
		hard: input.hard === true,
		sensitivity,
		confidence: typeof input.confidence === 'number' ? Math.min(1, Math.max(0, input.confidence)) : 0,
		reason: typeof input.reason === 'string' ? input.reason.slice(0, 400) : ''
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

function workersInput(question: TriageQuestion, earlier: TriageAnswer | null, maxTokens: number, effort: 'low' | 'high'): Record<string, unknown> {
	return {
		messages: [
			{ role: 'system', content: triageInstructions },
			{ role: 'user', content: questionText(question, earlier) }
		],
		tools: [{ type: 'function', function: { name: 'classify', description: 'Record where this item belongs.', parameters: answerSchema } }],
		tool_choice: 'required',
		reasoning_effort: effort,
		// Reasoning counts toward the limit, so it is well above the answer's size.
		max_completion_tokens: maxTokens
	};
}

function workersProvider(binding: ModelBinding, options: { cheapModel: string; topModel: string }): TriageProvider {
	const ask = async (model: string, question: TriageQuestion, earlier: TriageAnswer | null, maxTokens: number, effort: 'low' | 'high'): Promise<ModelCall> => {
		const message = await binding.run(model, workersInput(question, earlier, maxTokens, effort));
		const { answer, use } = readWorkersAnswer(message);
		return { answer, model, use, costMicrodollars: costMicrodollars(model, use) };
	};
	return {
		name: 'workers-ai',
		ready: true,
		classify: (question) => ask(options.cheapModel, question, null, 4000, 'low'),
		decideHard: (question, earlier) => ask(options.topModel, question, earlier, 16000, 'high')
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
