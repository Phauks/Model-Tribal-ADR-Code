/**
 * Coverage: which sections of each nation's page say "None Identified"
 * (improvements report, Nov. 24, 2026, idea 6), so contributors and nations
 * can see where help is needed. Each test is the one the nation page uses to
 * decide that a section is empty (src/routes/nations/[id]/+page.server.ts).
 */
import { nations, type NationRecord } from './content.ts';
import { nationDocumentHistories } from './document-history.ts';
import { nationIndexRows } from './nation-index.ts';
import { governanceGroups } from '#lib/governance-groups.ts';
import { humanize } from '#lib/nation-labels.ts';

/** The sections a nation page marks "None Identified" when nothing is on record, in the page's order. */
export const coverageSections = [
	{ key: 'contacts', label: 'Government contacts' },
	{ key: 'government', label: 'Government' },
	{ key: 'courts', label: 'Courts' },
	{ key: 'constitution', label: 'Constitution' },
	{ key: 'laws', label: 'Published laws' },
	{ key: 'jurisdiction', label: 'Jurisdiction' }
] as const;

export type CoverageSection = (typeof coverageSections)[number]['key'];

/** Every aspect of `governance` the Government section shows. */
const governmentAspects = new Set(governanceGroups.flatMap((group) => Object.keys(group.aspects)));

/** Articles of association are some nations' governing document in place of a constitution. A corporate charter governs a business, so it is neither. */
const governingKinds = ['constitution', 'articles-of-association'];

/**
 * Whether the nation's constitution is on record: listed among its governing
 * documents, or with a history of its own (`historyKinds`, the humanized kinds
 * of the document histories, as the nation page has them).
 */
export function hasConstitution(record: NationRecord, historyKinds: string[]): boolean {
	const kinds = new Set((record.governing_documents ?? []).map((fact) => fact.kind));
	return governingKinds.some((kind) => kinds.has(kind)) || historyKinds.some((kind) => governingKinds.map(humanize).includes(kind));
}

/** Whether any of the nation's published laws is on record: a law code, court rules or another law. */
export function hasPublishedLaws(record: NationRecord): boolean {
	const kinds = new Set((record.governing_documents ?? []).map((fact) => fact.kind));
	return ['law-code', 'court-rules', 'other'].some((kind) => kinds.has(kind)) || (record.dispute_resolution_law ?? []).length > 0;
}

/** What each section of the nation's page has, by the page's own tests. */
export function sectionsFound(record: NationRecord): Record<CoverageSection, boolean> {
	const histories = nationDocumentHistories(record.id).map((history) => humanize(history.kind));
	return {
		contacts: (record.contacts ?? []).length > 0,
		government:
			(record.government_structure ?? []).length > 0 ||
			(record.governance ?? []).some((fact) => governmentAspects.has(fact.aspect)),
		courts:
			(record.justice_institutions ?? []).length > 0 ||
			(record.dispute_resolution?.forums ?? []).length > 0 ||
			(record.court_practice ?? []).length > 0,
		constitution: hasConstitution(record, histories),
		laws: hasPublishedLaws(record),
		jurisdiction:
			(record.jurisdiction ?? []).some((fact) => Boolean(fact.detail ?? fact.value)) ||
			(record.jurisdiction_agreements ?? []).length > 0 ||
			(record.nearby_state_courts ?? []).length > 0
	};
}

export interface CoverageRow {
	id: string;
	name: string;
	statesText: string;
	states: string[];
	found: Record<CoverageSection, boolean>;
	gaps: number;
}

/** Every nation with a page, with what each of its sections has. Withdrawn pages and the sample nation are left out. */
export function coverageRows(): CoverageRow[] {
	const records = new Map(nations().map((record) => [record.id, record]));
	return nationIndexRows()
		.map((row) => ({ row, record: records.get(row.id) }))
		.filter(({ record }) => record && record.example !== true && record.review?.status !== 'withdrawn-at-request')
		.map(({ row, record }) => {
			const sections = sectionsFound(record!);
			return {
				id: row.id,
				name: row.name,
				statesText: row.statesText,
				states: row.states,
				found: sections,
				gaps: Object.values(sections).filter((value) => !value).length
			};
		});
}
