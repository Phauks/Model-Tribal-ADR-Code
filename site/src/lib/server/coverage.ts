/**
 * Coverage: which sections of each nation's page say "None Identified"
 * (improvements report, Nov. 24, 2026, idea 6), so contributors and nations
 * can see where help is needed. Each test is the one the nation page uses to
 * decide that a section is empty (src/routes/nations/[id]/+page.server.ts).
 */
import { nations, type NationRecord } from './content.ts';
import { nationDocumentHistories } from './document-history.ts';
import { nationIndexRows } from './nation-index.ts';
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

/** The governance aspects the Government section shows. */
const governmentAspects = new Set([
	'form', 'governing-body', 'governing-body-size', 'governing-body-selection', 'governing-body-term', 'general-council',
	'head-of-government', 'head-of-government-selection', 'head-of-government-term', 'other-officers', 'voting-age',
	'election-authority', 'separation-of-powers', 'judicial-selection', 'judicial-term', 'judicial-independence',
	'secretarial-approval', 'recall-and-removal', 'indian-reorganization-act', 'oklahoma-indian-welfare-act',
	'alaska-indian-reorganization-act', 'written-constitution-other'
]);

function found(record: NationRecord): Record<CoverageSection, boolean> {
	const kinds = new Set((record.governing_documents ?? []).map((fact) => fact.kind));
	const histories = nationDocumentHistories(record.id).map((history) => history.kind);
	const governing = ['constitution', 'articles-of-association'];
	const contacts = record.contacts as { websites?: unknown[]; offices?: unknown[] } | unknown[] | undefined;
	const hasContacts = Array.isArray(contacts) ? contacts.length > 0 : Boolean(contacts && ((contacts.websites?.length ?? 0) > 0 || (contacts.offices?.length ?? 0) > 0));
	return {
		contacts: hasContacts,
		government:
			(record.government_structure ?? []).length > 0 ||
			(record.governance ?? []).some((fact) => governmentAspects.has(fact.aspect)),
		courts:
			(record.justice_institutions ?? []).length > 0 ||
			(record.dispute_resolution?.forums ?? []).length > 0 ||
			(record.court_practice ?? []).length > 0,
		constitution:
			governing.some((kind) => kinds.has(kind)) ||
			histories.some((kind) => governing.map(humanize).includes(kind) || governing.includes(kind)),
		laws:
			['law-code', 'court-rules', 'other'].some((kind) => kinds.has(kind)) || (record.dispute_resolution_law ?? []).length > 0,
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
			const sections = found(record!);
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
