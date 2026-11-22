/**
 * The "Document history" section of a nation page: each document of the
 * nation that has recorded versions (content/documents/, decision record
 * 0018), oldest version first, with what each version did to the ones before
 * it and how its key clauses changed. Like every fact on the page, each
 * version carries the markers of its sources, which link to the page's
 * Sources section.
 */
import { humanize } from '../nation-labels.ts';
import { documentHistories, type DocumentHistoryRecord, type DocumentVersion } from './content.ts';
import type { CitationMark, SourceUses } from './source-uses.ts';

export interface VersionChangeView {
	topic: string;
	change: string;
	summary?: string;
}

export interface VersionView {
	id: string;
	label: string;
	event: string;
	status: string;
	inEffect: boolean;
	/** The dates the sources give, in the order events happen, e.g. "Approved 2003-01-24; published 2003-02-05". */
	dates?: string;
	/** What the version did to earlier ones, e.g. "Replaced the 1993 compact". */
	relation?: string;
	changes: VersionChangeView[];
	/** The markers of the version's source and of its approval notice. */
	citations: CitationMark[];
}

export interface DocumentHistoryView {
	id: string;
	title: string;
	kind: string;
	summary?: string;
	/** The versions in effect, as one phrase, e.g. "2021 compact, as amended by …". */
	inEffect?: string;
	versions: VersionView[];
}

const DATE_LABELS: [keyof NonNullable<DocumentVersion['dates']>, string][] = [
	['signed', 'signed'],
	['adopted', 'adopted'],
	['submitted', 'submitted'],
	['approved', 'approved'],
	['published', 'published'],
	['effective', 'effective'],
	['listed', 'listed'],
	['ended', 'ended']
];

const EVENT_LABELS: Record<string, string> = {
	original: 'Original',
	amendment: 'Amendment',
	revision: 'Revision',
	restatement: 'Amended and restated',
	replacement: 'Replacement',
	extension: 'Extension',
	renewal: 'Renewal',
	edition: 'New edition',
	repeal: 'Repeal',
	expiration: 'Expiration',
	disapproval: 'Disapproval',
	withdrawal: 'Withdrawal',
	other: 'Other'
};

const CHANGE_LABELS: Record<string, string> = {
	added: 'added',
	removed: 'removed',
	changed: 'changed',
	reworded: 'reworded, same process',
	renumbered: 'renumbered',
	unchanged: 'unchanged',
	'not-compared': 'not compared yet'
};

function sentenceCase(text: string): string {
	return text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);
}

function datesPhrase(version: DocumentVersion): string | undefined {
	if (!version.dates) return 'No date found in the text';
	const dates = version.dates;
	const parts = DATE_LABELS.filter(([field]) => dates[field]).map(([field, label]) => `${label} ${dates[field]}`);
	return parts.length > 0 ? sentenceCase(parts.join('; ')) : undefined;
}

function labelOf(version: DocumentVersion | undefined, fallback: string): string {
	return version?.label ?? fallback;
}

function relationPhrase(version: DocumentVersion, byId: Map<string, DocumentVersion>): string | undefined {
	const names = (ids: string[] | undefined) => (ids ?? []).map((id) => labelOf(byId.get(id), id));
	const parts: string[] = [];
	const amended = names(version.amends);
	const replaced = names(version.supersedes);
	if (amended.length > 0) parts.push(`amended the ${amended.join(' and the ')}`);
	if (replaced.length > 0) parts.push(`replaced the ${replaced.join(' and the ')}`);
	return parts.length > 0 ? sentenceCase(parts.join('; ')) : undefined;
}

/** The versions in effect, the earliest first, read as "X, as amended by Y". */
function inEffectPhrase(versions: DocumentVersion[]): string | undefined {
	const current = versions.filter((version) => version.status === 'in-effect');
	if (current.length === 0) return undefined;
	const [first, ...rest] = current.map((version) => labelOf(version, version.id));
	return rest.length > 0 ? `${first}, as amended by ${rest.join(' and ')}` : first;
}

/** The part of SourceUses this section needs, so tests can pass a stand-in. */
type SourceRecorder = Pick<SourceUses, 'cite' | 'citeFact'>;

export function documentHistoryView(
	record: DocumentHistoryRecord,
	sources: SourceRecorder
): DocumentHistoryView {
	const byId = new Map(record.versions.map((version) => [version.id, version]));
	const versions = record.versions.map((version): VersionView => {
		const label = labelOf(version, version.id);
		const citations: CitationMark[] = [];
		sources.citeFact(version, record.title, label, citations);
		if (version.approval?.source) {
			sources.cite(
				version.approval.source,
				{
					section: record.title,
					text: `${label}: ${humanize(version.approval.action).toLocaleLowerCase('en-US')}`,
					where: version.approval.locator
				},
				citations
			);
		}
		return {
			id: version.id,
			label,
			event: EVENT_LABELS[version.event] ?? humanize(version.event),
			status: humanize(version.status),
			inEffect: version.status === 'in-effect',
			dates: datesPhrase(version),
			relation: relationPhrase(version, byId),
			changes: (version.changes ?? []).map((change) => ({
				topic: humanize(change.topic),
				change: CHANGE_LABELS[change.change] ?? change.change,
				summary: change.summary
			})),
			citations
		};
	});
	return {
		id: record.id,
		title: record.title,
		kind: humanize(record.kind),
		summary: record.summary,
		inEffect: inEffectPhrase(record.versions),
		versions
	};
}

/** The document histories that name this nation, each recording its sources. */
export function documentHistoriesFor(nationId: string, sources: SourceRecorder): DocumentHistoryView[] {
	return documentHistories()
		.filter((record) => record.nations?.includes(nationId))
		.map((record) => documentHistoryView(record, sources));
}
