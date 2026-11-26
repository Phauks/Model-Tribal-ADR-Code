/**
 * Triage, step 1: the rules (docs/source-watch.md, "Triage"). Scripts decide
 * first. Each watcher's own rules run, then the shared ones below: labels for
 * titles that always mean the same thing, sensitivity flags, and the dedupe
 * result. Clear matches go to the review queue; clear misses are closed with
 * the rule that closed them (the review page shows them under "Closed by
 * rules", so a bad rule can be caught); the rest are the middle band, which a
 * model looks at when a triage provider is set (./triage.ts) and a person
 * otherwise.
 *
 * Sensitivity flags are set here, by rule, before any model reads anything,
 * and a flagged item is held: only the lead author sees it, and no model
 * reads it (decision record 0057).
 */
import type { CandidateStatus, TriageStep } from './store.ts';
import type { Match } from './known.ts';
import type { Feed, FoundItem, ProposedAction, SensitivityFlag, WatcherDefinition } from './watcher.ts';

export interface TitleRule {
	name: string;
	pattern: RegExp;
	action: 'review' | 'close';
	feeds?: Feed[];
	proposed?: ProposedAction;
	relevance: number;
	reason: string;
}

/**
 * Titles that always mean the same thing. Federal Register titles are the
 * main use: compact notices begin "Indian Gaming;", liquor ordinances are
 * nations' laws the Bureau of Indian Affairs publishes, and some notice kinds
 * are never about Native nations' law.
 */
export const titleRules: TitleRule[] = [
	{ name: 'compact-extension', pattern: /^Indian Gaming;\s*Extension of/i, action: 'review', feeds: ['intergovernmental-agreements', 'governing-documents', 'nation:gaming'], proposed: 'new-version', relevance: 0.95, reason: 'Title begins "Indian Gaming; Extension of": a compact extension.' },
	{ name: 'compact-amendment', pattern: /^Indian Gaming;.*\bAmendment/i, action: 'review', feeds: ['intergovernmental-agreements', 'governing-documents', 'nation:gaming'], proposed: 'new-version', relevance: 0.95, reason: 'An "Indian Gaming" notice of a compact amendment.' },
	{ name: 'compact-approval', pattern: /^Indian Gaming;\s*(Approval|Deemed Approved|Approved)\b/i, action: 'review', feeds: ['intergovernmental-agreements', 'governing-documents', 'nation:gaming'], proposed: 'add', relevance: 0.95, reason: 'An "Indian Gaming" notice approving a compact, including approval by operation of law.' },
	{ name: 'secretarial-procedures', pattern: /Secretarial Procedures|Class III Gaming Procedures/i, action: 'review', feeds: ['intergovernmental-agreements', 'governing-documents', 'nation:gaming'], proposed: 'add', relevance: 0.95, reason: 'Secretarial Procedures for Class III gaming.' },
	{ name: 'indian-gaming-other', pattern: /^Indian Gaming;/i, action: 'review', feeds: ['intergovernmental-agreements', 'nation:gaming'], relevance: 0.8, reason: 'Title begins "Indian Gaming;".' },
	{ name: 'liquor-ordinance', pattern: /Liquor Control (Ordinance|Code|Statute)|Alcoholic Beverages? (Ordinance|Code|Control)|Sale of Alcoholic Beverages|Liquor Ordinance/i, action: 'review', feeds: ['tribal-codes', 'governing-documents'], proposed: 'add', relevance: 0.9, reason: 'A nation’s liquor ordinance, published by the Bureau of Indian Affairs.' },
	{ name: 'recognized-entities-list', pattern: /Indian Entities Recognized/i, action: 'review', feeds: ['native-nations', 'nation:recognition', 'federal-register-notices'], proposed: 'add', relevance: 1, reason: 'The yearly list of federally recognized Indian entities.' },
	{ name: 'acknowledgment', pattern: /Federal Acknowledgment|Acknowledgment of the .* as an Indian Tribe|Final Determination .* Acknowledgment|Proposed Finding/i, action: 'review', feeds: ['native-nations', 'nation:recognition', 'federal-register-notices'], relevance: 0.85, reason: 'A federal acknowledgment petition, finding or determination.' },
	{ name: 'reservation-proclamation', pattern: /Proclaiming Certain Lands|Reservation Proclamation|as a Reservation for|Reservation for the .* Tribe/i, action: 'review', feeds: ['nation:land_establishment', 'federal-register-notices'], relevance: 0.85, reason: 'A reservation proclamation.' },
	{ name: 'land-into-trust', pattern: /Land Acquisitions?;|Land Into Trust|Fee-to-Trust/i, action: 'review', feeds: ['nation:land_establishment', 'federal-register-notices'], relevance: 0.7, reason: 'Land taken into trust for a nation.' },
	{ name: 'retrocession', pattern: /Retrocession|Public Law 280|Assumption of (Concurrent )?Jurisdiction/i, action: 'review', feeds: ['nation:jurisdiction', 'federal-register-notices'], relevance: 0.85, reason: 'Jurisdiction retroceded or assumed.' },
	{ name: 'information-collection', pattern: /^Agency Information Collection Activities/i, action: 'close', relevance: 0.05, reason: 'A Paperwork Reduction Act notice about a form, not law.' },
	{ name: 'meeting-notice', pattern: /Notice of (Public )?Meetings?|Advisory (Board|Committee)|Sunshine Act/i, action: 'close', relevance: 0.1, reason: 'A meeting notice.' },
	{ name: 'grant-notice', pattern: /Grant (Pilot )?Program|Funding Opportunity|Solicitation of Proposals/i, action: 'close', relevance: 0.1, reason: 'A grant or funding notice.' },
	{ name: 'irrigation-rates', pattern: /Rate Adjustments for Indian Irrigation Projects|Power Rates/i, action: 'close', relevance: 0.15, reason: 'A yearly rate notice for an irrigation or power project.' },
	{ name: 'inflation-adjustment', pattern: /Civil (Monetary )?Penalt(y|ies) Inflation Adjustments?/i, action: 'close', relevance: 0.2, reason: 'A routine yearly penalty adjustment.' }
];

const childOrFamily = /\b(juvenile|minor child|child welfare|Indian Child Welfare Act|ICWA|adoption|adoptive|guardianship|custody|termination of parental rights|parental rights|foster care|in re (the )?(welfare|matter|interest) of|dependency)\b/i;
const protectionOrder = /\b(protection order|protective order|restraining order|domestic violence|order of protection|stalking)\b/i;

/** Sensitivity flags from an item's words and where it would go (docs/source-watch.md, "Privacy"). */
export function sensitivityOf(item: FoundItem, feeds: Feed[]): SensitivityFlag[] {
	const words = `${item.title} ${item.summary ?? ''}`;
	const flags: SensitivityFlag[] = [];
	if (childOrFamily.test(words)) flags.push('child-or-family-case');
	if (protectionOrder.test(words)) flags.push('protection-order');
	if (feeds.includes('tribal-court-opinions')) flags.push('tribal-court-opinion');
	return flags;
}

/** Flags that hold an item from the ordinary queue and from every model. */
export const holdingFlags: SensitivityFlag[] = ['child-or-family-case', 'protection-order', 'nation-restriction', 'tribal-court-opinion'];

export interface RulesOutcome {
	status: CandidateStatus;
	feeds: Feed[];
	proposed: ProposedAction | null;
	relevance: number | null;
	sensitivity: SensitivityFlag[];
	step: TriageStep;
}

export interface RulesInput {
	watcher: WatcherDefinition;
	item: FoundItem;
	match: Match;
	/** Nations the name matcher found. */
	nations: string[];
	/** Nations that restrict how the site shows their laws or opinions (decision record 0056). */
	restrictedNations: ReadonlySet<string>;
	/** Whether a model may be asked about the middle band. */
	modelAvailable: boolean;
	now: Date;
}

/** Applies the watcher's rules, the shared title rules, the flags and the dedupe result. */
export function applyRules(input: RulesInput): RulesOutcome {
	const { watcher, item, match, now } = input;
	const at = now.toISOString();
	let feeds: Feed[] = item.feeds ?? [];
	let proposed: ProposedAction | null = null;
	let relevance: number | null = null;
	let decided: { action: 'close' | 'review'; by: string; reason: string } | null = null;

	for (const rule of watcher.rules ?? []) {
		const answer = rule.decide(item);
		if (!answer) continue;
		decided = { action: answer.action, by: `${watcher.identifier}:${rule.name}`, reason: answer.reason };
		feeds = answer.feeds ?? feeds;
		proposed = answer.proposed ?? proposed;
		relevance = answer.relevance ?? relevance;
		break;
	}
	if (!decided) {
		const rule = titleRules.find((candidate) => candidate.pattern.test(item.title));
		if (rule) {
			decided = { action: rule.action, by: rule.name, reason: rule.reason };
			feeds = rule.feeds ?? feeds;
			proposed = rule.proposed ?? null;
			relevance = rule.relevance;
		}
	}

	const sensitivity = sensitivityOf(item, feeds);
	if (input.nations.some((nation) => input.restrictedNations.has(nation))) sensitivity.push('nation-restriction');
	const step = (answer: string, by: string, reason: string): TriageStep => ({ step: 'rules', by, answer, reason, at });

	// Already held: closed without a person seeing it.
	if (match.kind === 'same') {
		return { status: 'closed-by-rules', feeds, proposed: 'same-as', relevance, sensitivity, step: step('already-have-it', 'dedupe', match.reason) };
	}
	if (sensitivity.some((flag) => holdingFlags.includes(flag))) {
		return { status: 'held', feeds, proposed, relevance, sensitivity, step: step('held', 'sensitivity', `Held for the lead author: ${sensitivity.join(', ')}.`) };
	}
	if (match.kind === 'new-version') {
		return { status: 'to-review', feeds, proposed: 'new-version', relevance: relevance ?? 0.9, sensitivity, step: step('review', 'dedupe', match.reason) };
	}
	if (decided?.action === 'close') {
		return { status: 'closed-by-rules', feeds, proposed: null, relevance, sensitivity, step: step('close', decided.by, decided.reason) };
	}
	if (match.kind === 'possible-duplicate') {
		return { status: 'to-review', feeds, proposed: 'same-as', relevance: relevance ?? 0.6, sensitivity, step: step('review', 'dedupe', match.reason) };
	}
	if (decided) {
		return { status: 'to-review', feeds, proposed: proposed ?? 'add', relevance, sensitivity, step: step('review', decided.by, decided.reason) };
	}
	// The middle band: no rule decided.
	const reason = 'No rule decided; a model or a person looks at it.';
	if (input.modelAvailable && !item.noModelText) return { status: 'waiting-for-model', feeds, proposed: null, relevance: null, sensitivity, step: step('middle-band', 'rules', reason) };
	return { status: 'to-review', feeds, proposed: null, relevance: null, sensitivity, step: step('middle-band', 'rules', item.noModelText ? `${reason} The host bars models from its text, so a person reads it.` : reason) };
}
