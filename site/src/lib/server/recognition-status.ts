/**
 * Each Native nation's recognition status, as one of three (Trevor, Nov. 27, 2026: the Statistics
 * page should "delineate between federally recognized, state, and non-recognized"), and the finer
 * breakdowns the Statistics page and the Recognition and federal services charts draw from the same
 * facts: how federal recognition came about, which part of the federal list a nation is in, and what
 * the federal record shows for a nation without federal recognition.
 *
 * A status is a legal fact, not a judgment of a nation's standing as a people. The facts are the
 * recognition facts on each nation's page (schemas/tribe.schema.json, recognition), so every count
 * leads back to a cited source. Only Native nations are counted; the Native Hawaiian community and
 * the Indigenous peoples of the territories are not tribes and are counted apart.
 */
import type { CitedFact, NationRecord } from './content.ts';

export type RecognitionFact = NonNullable<NationRecord['recognition']>[number];

/** The three statuses, in the order shown. A nation recognized by both the United States and a state counts as federally recognized. */
export const recognitionStatuses = ['Federally recognized', 'State recognized only', 'Not recognized'] as const;
export type RecognitionStatus = (typeof recognitionStatuses)[number];

const factsOf = (record: NationRecord, ...types: string[]): RecognitionFact[] => (record.recognition ?? []).filter((fact) => types.includes(fact.type));

export const isNativeNation = (record: NationRecord) => record.entity_type === 'native-nation';
export const isFederallyRecognized = (record: NationRecord) => isNativeNation(record) && factsOf(record, 'federal').length > 0;

/** A nation's status, or nothing for a record that is not a Native nation. */
export function recognitionStatus(record: NationRecord): RecognitionStatus | undefined {
	if (!isNativeNation(record)) return undefined;
	if (factsOf(record, 'federal').length > 0) return 'Federally recognized';
	if (factsOf(record, 'state').length > 0) return 'State recognized only';
	return 'Not recognized';
}

/** The facts that put a nation under its status: its federal facts, its state facts, or its petition and "no recognition" facts. */
export function statusFacts(record: NationRecord): RecognitionFact[] {
	switch (recognitionStatus(record)) {
		case 'Federally recognized':
			return factsOf(record, 'federal');
		case 'State recognized only':
			return factsOf(record, 'state');
		case 'Not recognized':
			return factsOf(record, 'petitioning', 'unrecognized');
		default:
			return [];
	}
}

/** The source of the Bureau of Indian Affairs list of recognized entities, cited as the first federal fact of every nation on it. */
const federalListSource = /^bia-recognized-entities-/;
const onFederalList = (fact: CitedFact) => typeof fact.source === 'string' && federalListSource.test(fact.source);

/**
 * How federal recognition came about, as far as the nation's page cites it (scripts/tribes/recognition_basis.py
 * holds the verified table). Each nation counts once, under the first that applies. The list itself is not a
 * basis: Pub. L. No. 103-454 only requires it to be published (Trevor, Nov. 23, 2026).
 */
export const federalBases: { slug: string; label: string; matches: (fact: RecognitionFact) => boolean }[] = [
	{ slug: 'part-83', label: 'Acknowledged under 25 C.F.R. Part 83', matches: (fact) => /final determination/i.test(fact.legal_basis ?? '') },
	{ slug: 'assistant-secretary', label: 'Decision of the Assistant Secretary', matches: (fact) => /Assistant Secretary/.test(fact.legal_basis ?? '') },
	{ slug: 'act-of-congress', label: 'Act of Congress', matches: (fact) => /Pub\. L\.|\bAct\b/.test(fact.legal_basis ?? '') }
];
export const basisNotTraced = { slug: 'not-yet-traced', label: 'On the federal list; basis not yet traced' };

/** The basis a federally recognized nation counts under, with the facts that show it. */
export function federalBasis(record: NationRecord): { slug: string; label: string; facts: RecognitionFact[] } | undefined {
	if (!isFederallyRecognized(record)) return undefined;
	const federal = factsOf(record, 'federal');
	for (const basis of federalBases) {
		const facts = federal.filter((fact) => !onFederalList(fact) && basis.matches(fact));
		if (facts.length > 0) return { slug: basis.slug, label: basis.label, facts };
	}
	return { ...basisNotTraced, facts: federal.filter(onFederalList).slice(0, 1) };
}

/**
 * The part of the federal list a nation is in. The list names the Native entities within the State of
 * Alaska apart from those within the contiguous 48 states (91 Fed. Reg. 4102, 4105, Jan. 30, 2026);
 * Metlakatla Indian Community, the one reservation in Alaska, is listed with the Alaska entities.
 */
export const listSections = [
	{ slug: 'contiguous-48-states', label: 'Within the contiguous 48 states' },
	{ slug: 'alaska', label: 'Within the State of Alaska' }
] as const;

export const inAlaska = (record: NationRecord) => (record.states ?? []).some((fact) => fact.state === 'AK');

export function listSection(record: NationRecord): (typeof listSections)[number] | undefined {
	if (!isFederallyRecognized(record)) return undefined;
	return inAlaska(record) ? listSections[1] : listSections[0];
}

/**
 * What the federal record shows for a nation without federal recognition, from the Office of Federal
 * Acknowledgment's lists, Acts of Congress and other federal sources cited on its page. Each nation counts
 * once, under the first that applies.
 */
export const withoutFederalRecords: { slug: string; label: string; facts: (record: NationRecord) => RecognitionFact[] }[] = [
	{ slug: 'petition-in-process', label: 'Petition for acknowledgment in process', facts: (record) => factsOf(record, 'petitioning') },
	{ slug: 'petition-denied', label: 'Petition for acknowledgment denied', facts: (record) => factsOf(record, 'unrecognized').filter((fact) => /^Denied/.test(String(fact.petition_stage ?? ''))) },
	{
		slug: 'terminated',
		label: 'Federal relationship ended by Congress',
		facts: (record) => factsOf(record, 'unrecognized').filter((fact) => /termination/i.test(fact.legal_basis ?? '') || /rancheria-act/.test(String(fact.source ?? '')))
	},
	{
		slug: 'letter-of-intent',
		label: 'Letter of intent to petition; no petition in process',
		facts: (record) => factsOf(record, 'unrecognized').filter((fact) => /^ofa-/.test(String(fact.source ?? '')))
	},
	{ slug: 'no-petition', label: 'No federal petition on record', facts: (record) => factsOf(record, 'unrecognized', 'state') }
];

/** The record a nation without federal recognition counts under, with the facts that show it. */
export function withoutFederalRecord(record: NationRecord): { slug: string; label: string; facts: RecognitionFact[] } | undefined {
	if (!isNativeNation(record) || isFederallyRecognized(record)) return undefined;
	for (const entry of withoutFederalRecords) {
		const facts = entry.facts(record);
		if (facts.length > 0) return { slug: entry.slug, label: entry.label, facts };
	}
	return undefined;
}

/**
 * Bands with their own page that the federal list names only inside another entity's entry, such as the
 * six component reservations of the Minnesota Chippewa Tribe. Counts of recognized entities leave them
 * out, so that no entity is counted twice (docs/decisions/0016-component-bands-own-profiles.md).
 */
export const isComponentBand = (record: NationRecord) => Boolean(record.part_of);
