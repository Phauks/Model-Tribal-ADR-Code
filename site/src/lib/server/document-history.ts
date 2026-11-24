/**
 * The "Document history" section of a nation page: each document of the
 * nation that has recorded versions (content/documents/, decision record
 * 0018), oldest version first, with what each version did to the ones before
 * it. The records' clause comparisons and summaries, which a small model read
 * from excerpts, are not shown (Trevor, Nov. 22, 2026), nor is the record's
 * generated summary. Like every fact on the page, each
 * version carries the markers of its sources, which link to the page's
 * Sources section.
 */
import { humanize } from '../nation-labels.ts';
import { readableDate } from '../readable-date.ts';
import { copyPagePath } from '../public-copies.ts';
import {
	documentHistories,
	publicCopyFor,
	publicCopyWithDigest,
	sources as sourceRecords,
	type DocumentHistoryRecord,
	type DocumentVersion
} from './content.ts';
import type { CitationMark, SourceUses } from './source-uses.ts';

export interface VersionView {
	id: string;
	label: string;
	event: string;
	status: string;
	inEffect: boolean;
	/** Where the text of this version can be read: its source's public copy, or an archived copy. */
	link?: string;
	/** The dates the sources give, in the order events happen, e.g. "Approved 2003-01-24; published 2003-02-05". */
	dates?: string;
	/** What the version did to earlier ones, e.g. "Replaced the 1993 compact". */
	relation?: string;
	/** The earliest date the sources give for the version (YYYY-MM-DD), which places it on the timeline. */
	date?: string;
	/** The markers of the version's source and of its approval notice. */
	citations: CitationMark[];
}

export interface DocumentHistoryView {
	id: string;
	title: string;
	kind: string;
	/** The versions in effect, as one phrase, e.g. "2021 compact, as amended by …". */
	inEffect?: string;
	/**
	 * When no version is in effect, how the document ended, from its last
	 * version: "Expired Dec. 31, 2024" or "Superseded May 10, 2024".
	 */
	ended?: string;
	/**
	 * The documents that took this one's place under another name, such as
	 * Secretarial Procedures issued where no compact was reached, so a reader
	 * of an ended compact sees what governs now (Trevor, Nov. 23, 2026).
	 */
	replacedBy: RelatedDocumentView[];
	/** The documents this one took the place of, such as an expired compact. */
	replaces: RelatedDocumentView[];
	versions: VersionView[];
}

export interface RelatedDocumentView {
	id: string;
	/** Its heading on the nation's page, such as "Secretarial Procedures (California)". */
	heading: string;
	/** Its versions in effect, as one phrase, if any are. */
	inEffect?: string;
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

/** A version's pill: a text that another took the place of reads "Replaced", as the approved nation page mockup has it (layout A, Nov. 22, 2026). */
const STATUS_LABELS: Record<string, string> = {
	superseded: 'Replaced'
};

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

function sentenceCase(text: string): string {
	return text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);
}

/**
 * The version's dates in words, events on the same day named together:
 * "Published and listed Feb. 5, 2003".
 */
function datesPhrase(version: DocumentVersion): string | undefined {
	if (!version.dates) return 'No date found in the text';
	const dates = version.dates;
	const byDate = new Map<string, string[]>();
	for (const [field, label] of DATE_LABELS) {
		const date = dates[field];
		if (!date) continue;
		byDate.set(date, [...(byDate.get(date) ?? []), label]);
	}
	const parts = [...byDate.entries()].map(([date, labels]) => `${labels.join(' and ')} ${readableDate(date)}`);
	return parts.length > 0 ? sentenceCase(parts.join('; ')) : undefined;
}

/**
 * A document's heading on its nation's page, without the nation's name the
 * page already shows: "Navajo Nation, Arizona, New Mexico, & Utah–State of
 * Arizona Gaming Compact" becomes "Gaming compact with Arizona", and
 * "Constitution of the Ione Band of Miwok Indians of California" becomes
 * "Constitution". Other titles lose only the nation's name at the start.
 */
export function documentHeading(title: string, names: string[]): string {
	let rest = title;
	for (const name of names) {
		for (const dash of ['–', '-', '—']) {
			if (rest.startsWith(`${name}${dash}`)) rest = rest.slice(name.length + 1);
		}
	}
	const compact = /^State of (.+?) (?:Class III )?Gaming Compact$/i.exec(rest);
	if (compact) return `Gaming compact with ${compact[1]}`;
	// "Secretarial Procedures for Alturas Indian Rancheria, California (California)"
	const procedures = /^Secretarial Procedures for (.+) \(([^()]+)\)$/.exec(rest);
	if (procedures && names.some((name) => name === procedures[1] || procedures[1].startsWith(name))) {
		return `Secretarial Procedures (${procedures[2]})`;
	}
	const constitution = /^(Constitution|Constitution and Bylaws)(?: of (?:the )?(.+))?$/i.exec(rest);
	if (constitution && (!constitution[2] || names.some((name) => name.includes(constitution[2]) || constitution[2].includes(name)))) {
		return sentenceCase(constitution[1].toLocaleLowerCase('en-US'));
	}
	return rest;
}

/** The earliest of a version's recorded dates, leaving out the date it ended. */
export function earliestDate(version: DocumentVersion): string | undefined {
	const dates = DATE_LABELS.filter(([field]) => field !== 'ended')
		.map(([field]) => version.dates?.[field])
		.filter((date): date is string => typeof date === 'string' && /^\d{4}(-\d{2}){0,2}$/.test(date))
		.sort();
	return dates[0];
}

export function labelOf(version: DocumentVersion | undefined, fallback: string): string {
	return version?.label ?? fallback;
}

function relationPhrase(version: DocumentVersion, byIdentifier: Map<string, DocumentVersion>): string | undefined {
	const names = (ids: string[] | undefined) => (ids ?? []).map((id) => labelOf(byIdentifier.get(id), id));
	const parts: string[] = [];
	const amended = names(version.amends);
	const replaced = names(version.supersedes);
	// An extension or renewal changes only the term (25 C.F.R. § 293.5), so it says so.
	const extended = version.event === 'extension' || version.event === 'renewal';
	if (amended.length > 0) parts.push(`${extended ? 'extended the term of' : 'amended'} the ${amended.join(' and the ')}`);
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

/** Versions that never took effect, which say nothing about how a document ended. */
const NEVER_IN_EFFECT = new Set(['disapproved', 'withdrawn', 'proposed']);

/**
 * How a document none of whose versions is in effect ended, from its last
 * version that took effect: "Expired Dec. 31, 2024". Undefined while any
 * version is in effect, or when the sources do not say.
 */
function endedPhrase(versions: DocumentVersion[]): string | undefined {
	if (versions.some((version) => version.status === 'in-effect')) return undefined;
	const last = versions.filter((version) => !NEVER_IN_EFFECT.has(version.status)).at(-1);
	if (!last || last.status === 'unknown') return undefined;
	const ended = last.dates?.ended;
	return ended ? `${humanize(last.status)} ${readableDate(ended)}` : humanize(last.status);
}

/** The documents a record names with one relation, each with its heading and what of it is in effect. */
function relatedDocuments(record: DocumentHistoryRecord, relation: string, names: string[]): RelatedDocumentView[] {
	const wanted = (record.related ?? []).filter((link) => link.relation === relation).map((link) => link.document);
	if (wanted.length === 0) return [];
	const byIdentifier = new Map(documentHistories().map((other) => [other.id, other]));
	return wanted.flatMap((id) => {
		const other = byIdentifier.get(id);
		if (!other) return [];
		return [{ id, heading: documentHeading(other.title, names), inEffect: inEffectPhrase(other.versions) }];
	});
}

/**
 * The public copy of a version's text, so the history links to the document
 * itself (Trevor, Nov. 22, 2026): the copy this site serves when it keeps
 * one (src/lib/public-copies.ts), matched first by the version's capture
 * and then by its source's address, else the source's own address, else its
 * first archived copy.
 */
export function textLink(version: DocumentVersion): string | undefined {
	const capture = publicCopyWithDigest(version.capture?.sha256);
	if (capture) return copyPagePath(capture);
	if (!version.source) return undefined;
	const record = sourceRecords().get(version.source);
	const saved = publicCopyFor(record?.original_link);
	if (saved) return copyPagePath(saved);
	if (record?.original_link) return record.original_link;
	const archived = record?.archives?.find((copy) => copy.link ?? copy.url);
	return archived?.link ?? archived?.url;
}

/** The part of SourceUses this section needs, so tests can pass a stand-in. */
type SourceRecorder = Pick<SourceUses, 'cite' | 'citeFact'>;

export function documentHistoryView(
	record: DocumentHistoryRecord,
	sources: SourceRecorder,
	/** The nation's names, which related documents' headings leave out. */
	names: string[] = []
): DocumentHistoryView {
	const byIdentifier = new Map(record.versions.map((version) => [version.id, version]));
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
			status: STATUS_LABELS[version.status] ?? humanize(version.status),
			inEffect: version.status === 'in-effect',
			link: textLink(version),
			dates: datesPhrase(version),
			relation: relationPhrase(version, byIdentifier),
			date: earliestDate(version),
			citations
		};
	});
	return {
		id: record.id,
		title: record.title,
		kind: humanize(record.kind),
		inEffect: inEffectPhrase(record.versions),
		ended: endedPhrase(record.versions),
		replacedBy: relatedDocuments(record, 'replaced-by', names),
		replaces: relatedDocuments(record, 'replaces', names),
		versions
	};
}

/** The document histories that name this nation, each recording its sources. */
/** The document histories that name a nation, such as its gaming compacts. */
export function nationDocumentHistories(nationIdentifier: string): DocumentHistoryRecord[] {
	return documentHistories().filter((record) => record.nations?.includes(nationIdentifier));
}
