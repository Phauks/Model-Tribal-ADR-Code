/**
 * The one list of the collections the site holds, counted when the site is
 * built for the Statistics page (/stats). Trevor asked on Nov. 24, 2026 for a
 * page counting our materials that grows as new data sets are added, so a
 * thread that adds a collection adds one entry here, and the page's card and the
 * collection's own list (/stats/<identifier>), with its downloads, pick it up.
 *
 * docs/data-roadmap.md is the living list of every collection we plan, by
 * tier, with its status; when a collection there lands, add its entry here.
 *
 * Counts are of what the site shows: each `items` calls the same loader the
 * collection's own pages use, so a restricted record, one held for a nation's
 * approval, or an opinion held back for a privacy review is never counted or
 * listed. The count is the number of items, so the card and its list agree.
 * Where items are held back, `heldBack` gives only how many, never which.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { documentHistories, glossary, nations, publicCopies, publicCopyFor, repositoryRoot, sources, type SourceRecord } from './content.ts';
import { parseCsv } from '../csv.ts';
import { stateName } from '../nation-labels.ts';
import { biographies, biographyPath } from './biographies.ts';
import { peopleIndex } from './justice-pages.ts';
import { courtsWithPages } from './supreme-court-pages.ts';
import { courtPath } from './supreme-courts.ts';
import { courts as namedCourts } from './courts.ts';
import { heldBackOpinionCount, tribalCourtOpinions } from './tribal-court-opinions.ts';
import { storySummaries } from './stories.ts';
import { buildFormCatalog } from './form-catalog.ts';
import { copyPagePath, isSavedWebPage, mediaLabel, type PublicCopy } from '../public-copies.ts';
import { isNativeNation, recognitionStatus } from './recognition-status.ts';
import type { Holding } from '../holding.ts';
import { dataChartList, dataChartTrail } from '../data-chart-list.ts';
import { landCessions, royceSheets } from './land-cessions.ts';
import { historicMapScans } from './historic-map-scans.ts';
import type { ResultGroup } from '../search-everything.ts';
import { allSections } from './title-25-sections.ts';
import { isLawRecord } from './law-records.ts';
import { nationsInPrograms, programSummaries } from './federal-programs.ts';
import { federalProgramPage } from '../federal-programs.ts';

/** The headings the collections are grouped under, in page order. */
export const collectionGroups = ['Native nations', 'Federal law', 'State law', 'Courts and cases', 'People', 'Reference'] as const;
export type CollectionGroup = (typeof collectionGroups)[number];

/** One item a collection counts, as a row of its list. */
export interface CollectionItem {
	title: string;
	/** Its page on this site, or where it is published. */
	href?: string;
	/** The year it was made, decided or issued, when known. */
	year?: number;
	/** One more fact for the list's third column, such as the court or nation. */
	detail?: string;
	/** The source record it is, when it is one, so search can send a reader to the record's own page. */
	key?: string;
	/** The copies this site keeps of it, counted as documents, their pages and saved web pages. Read on the server only: a list sends its holdingOf. */
	copies?: PublicCopy[];
}

/** What a set of copies holds, or nothing when there are none. */
export function holdingOf(copies: Iterable<PublicCopy>): Holding | undefined {
	const holding: Holding = { documents: 0, pages: 0, webPages: 0 };
	for (const copy of copies) {
		if (isSavedWebPage(copy)) holding.webPages += 1;
		else {
			holding.documents += 1;
			holding.pages += copy.pages ?? 0;
		}
	}
	return holding.documents + holding.webPages > 0 ? holding : undefined;
}

const counted = (value: number, one: string, many: string) => `${value.toLocaleString('en-US')} ${value === 1 ? one : many}`;

/**
 * A document collection's number in parts that add up to it (Trevor, Nov. 27, 2026: "if a stat is giving a number, provide
 * more info about that number"): the items the site keeps as a document, with those documents' pages; those it keeps only
 * as a saved web page; and those it has no copy of. Nothing for a collection none of whose items has a copy.
 */
export function documentBreakdown(items: CollectionItem[]): string[] {
	let documents = 0;
	let webPages = 0;
	let without = 0;
	const files = new Map<string, PublicCopy>();
	for (const item of items) {
		const copies = item.copies ?? [];
		const documentCopies = copies.filter((copy) => !isSavedWebPage(copy));
		if (documentCopies.length > 0) {
			documents += 1;
			for (const copy of documentCopies) files.set(copy.key, copy);
		} else if (copies.length > 0) webPages += 1;
		else without += 1;
	}
	if (documents + webPages === 0) return [];
	const pages = [...files.values()].reduce((sum, copy) => sum + (copy.pages ?? 0), 0);
	return [
		documents ? `${counted(documents, 'document', 'documents')}${pages ? ` (${counted(pages, 'page', 'pages')})` : ''}` : '',
		webPages ? counted(webPages, 'saved web page', 'saved web pages') : '',
		without ? `${without.toLocaleString('en-US')} without a copy` : ''
	].filter(Boolean);
}

/** How many of each value items have, most first, such as courts by kind. */
function tally(values: string[], describe: (value: string, count: number) => string): string[] {
	const counts = new Map<string, number>();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return [...counts]
		.sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]))
		.map(([value, count]) => describe(value, count));
}

/** State statutes by state, the five with the most first, then the rest together. */
function stateBreakdown(items: CollectionItem[]): string[] {
	const counts = new Map<string, number>();
	for (const item of items) {
		const state = item.detail?.replace(/ \(.*$/, '') || 'without a state';
		counts.set(state, (counts.get(state) ?? 0) + 1);
	}
	const named = [...counts].filter(([state]) => state !== 'without a state').sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0]));
	const shown = named.slice(0, 5).map(([state, count]) => `${count.toLocaleString('en-US')} ${state}`);
	const rest = named.slice(5).reduce((sum, [, count]) => sum + count, 0);
	const stateless = counts.get('without a state') ?? 0;
	return [...shown, ...(rest ? [`${rest.toLocaleString('en-US')} in ${counted(named.length - 5, 'other state', 'other states')}`] : []), ...(stateless ? [`${stateless.toLocaleString('en-US')} without a state`] : [])];
}

/** How many different values items have, such as the chapters sections are in. */
const distinct = (values: (string | undefined)[]) => new Set(values.filter(Boolean)).size;

/** The Native nations by recognition status, as the Recognition section counts them (recognition-status.ts). */
function nationBreakdown(): string[] {
	const statuses = nations()
		.filter(isNativeNation)
		.map((record) => recognitionStatus(record) ?? 'Not recognized');
	return ['Federally recognized', 'State recognized only', 'Not recognized'].flatMap((status) => {
		const count = statuses.filter((candidate) => candidate === status).length;
		return count ? [`${count.toLocaleString('en-US')} ${status.toLowerCase()}`] : [];
	});
}

/** Where the site's own copies come from: documents by kind of file, with their pages; saved web pages by website. */
function copyFileBreakdown(items: CollectionItem[]): string[] {
	const copies = items.flatMap((item) => item.copies ?? []);
	const pages = copies.reduce((sum, copy) => sum + (copy.pages ?? 0), 0);
	return tally(
		copies.map((copy) => mediaLabel(copy.mediaType)),
		(kind, count) =>
			kind === 'PDF' ? `${counted(count, 'PDF', 'PDFs')}${pages ? ` (${counted(pages, 'page', 'pages')})` : ''}` : kind === 'text' ? counted(count, 'text file', 'text files') : counted(count, kind, `${kind}s`)
	);
}

function webPageBreakdown(items: CollectionItem[]): string[] {
	const sites = distinct(
		items.flatMap((item) => item.copies ?? []).map((copy) => {
			try {
				return new URL(copy.links[0] ?? '').hostname.replace(/^www\./, '');
			} catch {
				return undefined;
			}
		})
	);
	return sites ? [`from ${counted(sites, 'website', 'websites')}`] : [];
}

let copyIndexes: { byRecord: Map<string, PublicCopy[]>; byNation: Map<string, PublicCopy[]>; byKey: Map<string, PublicCopy> } | undefined;

/** The copies the site serves, by the records and the nations they belong to and by their own key. */
function copiesIndexed() {
	if (!copyIndexes) {
		const byRecord = new Map<string, PublicCopy[]>();
		const byNation = new Map<string, PublicCopy[]>();
		const add = (map: Map<string, PublicCopy[]>, key: string, copy: PublicCopy) => map.set(key, [...(map.get(key) ?? []), copy]);
		for (const copy of publicCopies()) {
			for (const record of copy.records) add(byRecord, record, copy);
			for (const nation of copy.nations) add(byNation, nation, copy);
		}
		copyIndexes = { byRecord, byNation, byKey: new Map(publicCopies().map((copy) => [copy.key, copy])) };
	}
	return copyIndexes;
}

/** The copies of a source record: those that name it, and the one of the address it cites. */
function copiesOfRecord(record: SourceRecord, linked: PublicCopy | undefined): PublicCopy[] {
	const copies = new Map((copiesIndexed().byRecord.get(record.key) ?? []).map((copy) => [copy.key, copy]));
	if (linked) copies.set(linked.key, linked);
	return [...copies.values()];
}

/** Every copy that names a nation. */
export const nationCopies = (nation: string) => copiesIndexed().byNation.get(nation) ?? [];

/** One copy as a list row of its own. */
const copyItem = (copy: PublicCopy): CollectionItem => ({ title: copy.title ?? copy.key, href: copyPagePath(copy), copies: [copy] });

export interface Collection {
	/** Unique and stable: the address of its list, /stats/<identifier>. */
	identifier: string;
	/** Plural, as it reads on its card, such as "Executive Orders". */
	title: string;
	group: CollectionGroup;
	/** Every item the site shows, which is what the card counts. */
	items: () => CollectionItem[];
	/** The header of the list's third column, when items have a detail. */
	detailHeader?: string;
	/** An existing page that lists exactly these items; the card links there instead of /stats/<identifier>. */
	list?: string;
	/** Another page about the same items, linked from the list, such as Coverage for the nations. */
	related?: { label: string; href: string };
	/** The years covered, when the items' own years don't say it, such as each Court's whole tenure. */
	years?: () => string;
	/** The source record kinds it counts (schemas/source.schema.json), so a test can catch a new kind nobody counts. */
	sourceKinds?: string[];
	/** How many items exist but are held back, such as opinions awaiting a privacy review. Never which ones. */
	heldBack?: () => number;
	/** Why they are held back, read after the number: "held back for a privacy review". */
	heldBackReason?: string;
	/**
	 * More about its number, as short parts read after it (Trevor, Nov. 27, 2026: "if a stat is giving a number, provide
	 * more info about that number"). Without it, a collection whose items have copies on the site is split into
	 * documents (with their pages), saved web pages and items without a copy (documentBreakdown).
	 */
	breakdown?: (items: CollectionItem[]) => string[];
	/** Its list gives each item's documents, pages and saved web pages as numbers, for items that gather many copies, such as nations. */
	copyCounts?: boolean;
	/**
	 * Where the site search lists its items (src/lib/server/search-index.ts),
	 * so every collection is searchable and a new one is too. 'nation',
	 * 'document', 'story' and 'term' are searched through their own indexes;
	 * any other group gets one result per item, with `label` (one item, such
	 * as "Executive order") leading its detail line. tests/search-coverage.test.ts
	 * checks that every item is found.
	 */
	search: { group: ResultGroup; label?: string };
}

const kindOf = (record: SourceRecord) => (record as SourceRecord & { kind?: string }).kind ?? '';
const typeOf = (record: SourceRecord) => (record.citation as { type?: string }).type ?? '';

/** A source record as a list row: a case or law links to its page, anything else to our copy or else where it is published. */
function sourceItem(record: SourceRecord, detail?: string): CollectionItem {
	const link = record.original_link ?? record.citation.URL;
	const copy = publicCopyFor(link);
	const href = typeOf(record) === 'legal_case' ? `/cases/${record.key}` : isLawRecord(record) ? `/laws/${record.key}` : copy ? copyPagePath(copy) : publishedAt(record, link);
	const copies = copiesOfRecord(record, copy);
	return { title: record.citation.title ?? record.key, href, year: record.citation.issued?.['date-parts']?.[0]?.[0], detail, key: record.key, ...(copies.length ? { copies } : {}) };
}

/**
 * Where a source with no copy on this site is published: its own address, an
 * archived copy when the file is gone from there, or nowhere, so a list never
 * links to a page that answers "not found" (three filings in Oklahoma's
 * register have no file at the State's site; Trevor, Nov. 27, 2026).
 */
function publishedAt(record: SourceRecord, link: string | undefined): string | undefined {
	if (record.history?.status !== 'removed') return link;
	const archived = record.archives?.find((archive) => archive.url ?? archive.link);
	return archived?.url ?? archived?.link;
}

/**
 * The filings in the Oklahoma Secretary of State's register of tribal compacts and agreements
 * (scripts/agreements/oklahoma_register.py), a collection of their own, so they are not counted again
 * among the compacts and agreements from other sources.
 */
const oklahomaTopic = 'oklahoma-state-tribal-agreement';
const isOklahomaFiling = (record: SourceRecord) => (record.topics ?? []).includes(oklahomaTopic);
const oklahomaAgreements = () => [...sources().values()].filter(isOklahomaFiling);

/**
 * Native nations' laws a federal agency approved: leasing regulations under the HEARTH Act, water quality standards, and EPA's
 * decisions that a nation may run an environmental program as a state would (scripts/law/approved_nation_laws.py), a collection
 * of their own, so they are not counted again among the codes and laws. EPA's two list pages the nation-page facts cite are left out.
 */
const approvedLawTopic = 'approved-nation-laws';
const isApprovedNationLaw = (record: SourceRecord) => (record.topics ?? []).includes(approvedLawTopic) && kindOf(record) !== 'web-page';
function approvedNationLaws(): CollectionItem[] {
	return [...sources().values()].filter(isApprovedNationLaw).map((record) => sourceItem(record, [(record.citation as { genre?: string }).genre, tribesOf(record)].filter(Boolean).join(': ') || undefined));
}
/** Source records of some kinds (schemas/source.schema.json), less treaties, which are their own collection, Oklahoma's register and the approved nations' laws. */
function sourcesOfKind(kinds: string[], detail?: (record: SourceRecord) => string | undefined): () => CollectionItem[] {
	return () =>
		[...sources().values()]
			.filter((record) => kinds.includes(kindOf(record)) && typeOf(record) !== 'treaty' && !isOklahomaFiling(record) && !isApprovedNationLaw(record))
			.map((record) => sourceItem(record, detail?.(record)));
}

/** Treaties and the agreements ratified like them, cited as treaties whatever their kind. */
function treaties(): CollectionItem[] {
	return [...sources().values()].filter((record) => typeOf(record) === 'treaty').map((record) => sourceItem(record, tribesOf(record)));
}

/**
 * State statute sections, each named by its citation and heading ("Okla. Stat. tit. 10, § 40: Short title"), with its state and,
 * for a section a state's Indian law sweep found, whether it is core or incidental Indian law (scripts/law/state_statutes/).
 */
function stateStatutes(): CollectionItem[] {
	return [...sources().values()]
		.filter((record) => kindOf(record) === 'state-statute')
		.map((record) => {
			const short = (record.citation as { 'title-short'?: string })['title-short'];
			const states = ((record as SourceRecord & { jurisdictions?: { level?: string; state?: string }[] }).jurisdictions ?? []).flatMap((entry) => (entry.level === 'state' && entry.state ? [stateName(entry.state)] : []));
			const state = [...new Set(states)].join('; ');
			const relevance = record.state_law?.relevance;
			const item = sourceItem(record, relevance ? `${state} (${relevance})` : state || undefined);
			return short && record.citation.title ? { ...item, title: `${short}: ${record.citation.title}` } : item;
		});
}

const stateOpinionTopic = 'state-court-indian-law';
const isStateOpinion = (record: SourceRecord) => (record.topics ?? []).includes(stateOpinionTopic);

/** State court opinions found by scripts/caselaw/state_court_opinions.py, less those held for a privacy review. */
const stateCourtOpinions = () =>
	[...sources().values()].filter((record) => isStateOpinion(record) && record.citation.title).map((record) => sourceItem(record, record.citation.authority));

/** How many state court opinions the script held for a privacy review (research/state-court-opinions/summary.json). */
function heldBackStateOpinions(): number {
	const file = path.join(repositoryRoot, 'research/state-court-opinions/summary.json');
	return existsSync(file) ? Number((JSON.parse(readFileSync(file, 'utf8')) as { held_for_privacy_review?: number }).held_for_privacy_review ?? 0) : 0;
}

const federalOpinionTopic = 'federal-court-indian-law';
const isFederalOpinion = (record: SourceRecord) => (record.topics ?? []).includes(federalOpinionTopic);

/** Lower federal court opinions found by scripts/caselaw/state_court_opinions.py --courts federal, less those held for a privacy review. */
const federalCourtOpinions = () =>
	[...sources().values()].filter((record) => isFederalOpinion(record) && record.citation.title).map((record) => sourceItem(record, record.citation.authority));

/** How many federal court opinions the script held for a privacy review (research/federal-court-opinions/summary.json). */
function heldBackFederalOpinions(): number {
	const file = path.join(repositoryRoot, 'research/federal-court-opinions/summary.json');
	return existsSync(file) ? Number((JSON.parse(readFileSync(file, 'utf8')) as { held_for_privacy_review?: number }).held_for_privacy_review ?? 0) : 0;
}

/** Court cases with a name, by the citation's authority, less the state and federal court opinions, which are collections of their own. */
function casesBy(test: (authority: string) => boolean): () => CollectionItem[] {
	return () =>
		[...sources().values()]
			.filter((record) => typeOf(record) === 'legal_case' && record.citation.title && !isStateOpinion(record) && !isFederalOpinion(record) && test(record.citation.authority ?? ''))
			.map((record) => sourceItem(record, record.citation.authority));
}

const supremeCourt = (authority: string) => authority === 'Supreme Court of the United States';
/** Decisions of Interior's appeals board, their own collection (scripts/law/ibia_decisions.py). */
const indianAppealsBoard = (authority: string) => authority === 'Interior Board of Indian Appeals';

/** The Board's decisions held back for a privacy review (decisions about a child or a protected person), by citation only. */
function heldBackBoardDecisions(): number {
	const file = path.join(repositoryRoot, 'research/ibia/held-back.csv');
	return existsSync(file) ? parseCsv(readFileSync(file, 'utf8')).length : 0;
}

const gamingCommission = 'National Indian Gaming Commission';

/** The Gaming Commission's reading room: its opinions, letters, enforcement actions and bulletins, and its final decisions, which are cases (scripts/law/nigc_documents.py). */
function gamingCommissionDocuments(): CollectionItem[] {
	return [...sources().values()]
		.filter((record) => (kindOf(record) === 'federal-agency-document' && record.citation.author?.some((author) => author.literal === gamingCommission)) || (typeOf(record) === 'legal_case' && record.citation.authority === gamingCommission))
		.map((record) => sourceItem(record, (record.citation as { genre?: string }).genre ?? 'Commission final decision'));
}

const acknowledgmentOffice = 'U.S. Department of the Interior, Office of Federal Acknowledgment';

/** The Department's documents in each federal acknowledgment petition: proposed findings, final determinations and the rest (scripts/law/acknowledgment_petitions.py). */
function acknowledgmentDocuments(): CollectionItem[] {
	return [...sources().values()]
		.filter((record) => kindOf(record) === 'federal-agency-document' && record.citation.author?.some((author) => author.literal === acknowledgmentOffice))
		.map((record) => sourceItem(record, (record.citation as { genre?: string }).genre));
}

const solicitorOffice = 'U.S. Department of the Interior, Office of the Solicitor';

/** The Solicitor's opinions on Indian affairs, 1917-1974 and since 1993 (scripts/law/solicitor_opinions.py). */
function solicitorOpinions(): CollectionItem[] {
	return [...sources().values()]
		.filter((record) => kindOf(record) === 'federal-agency-document' && record.citation.author?.some((author) => author.literal === solicitorOffice))
		.map((record) => sourceItem(record, (record.citation as { number?: string }).number));
}

function nationNameOf(): (id: string) => string {
	const names = new Map(nations().map((nation) => [nation.id, nation.names.official]));
	return (id) => names.get(id) ?? id;
}

const tribesOf = (record: SourceRecord) => {
	const name = nationNameOf();
	return record.tribes?.map(name).join('; ') || undefined;
};

export const collections: Collection[] = [
	// Native nations
	{
		identifier: 'native-nations', search: { group: 'nation' },
		title: 'Native Nations',
		group: 'Native nations',
		detailHeader: 'States',
		related: { label: 'Coverage', href: '/nations/coverage' },
		// The nations by recognition, not by what the site holds about them (Trevor, Nov. 27, 2026: "native nations should go by count").
		breakdown: nationBreakdown,
		copyCounts: true,
		items: () =>
			nations()
				.filter((nation) => nation.entity_type === 'native-nation')
				.map((nation) => ({ title: nation.names.official, href: `/nations/${nation.id}`, detail: [...new Set(nation.states?.map((place) => place.state))].join(', ') || undefined, copies: nationCopies(nation.id) }))
	},
	{
		identifier: 'governing-documents', search: { group: 'document' },
		title: 'Governing Document Histories',
		group: 'Native nations',
		breakdown: () => {
			const histories = documentHistories();
			return [counted(histories.reduce((sum, history) => sum + history.versions.length, 0), 'version', 'versions'), `for ${counted(distinct(histories.flatMap((history) => history.nations ?? [])), 'nation', 'nations')}`];
		},
		detailHeader: 'Nation',
		items: () => {
			const name = nationNameOf();
			return documentHistories().map((history) => ({
				title: history.title,
				href: history.nations?.[0] ? `/nations/${history.nations[0]}#document-${history.id}` : undefined,
				detail: history.nations?.map(name).join('; ')
			}));
		}
	},
	{ identifier: 'tribal-constitutions', search: { group: 'document' }, title: 'Constitutions', group: 'Native nations', detailHeader: 'Nation', sourceKinds: ['tribal-constitution'], items: sourcesOfKind(['tribal-constitution'], tribesOf) },
	{ identifier: 'tribal-codes', search: { group: 'document' }, title: 'Codes and Laws', group: 'Native nations', detailHeader: 'Nation', sourceKinds: ['tribal-code', 'tribal-court-rule'], items: sourcesOfKind(['tribal-code', 'tribal-court-rule'], tribesOf) },
	// The federal self-governance, self-determination and block grant programs nation pages list (Trevor, Nov. 26, 2026: "make self-governance a collection").
	{
		identifier: 'federal-programs',
		search: { group: 'reference', label: 'Federal program' },
		title: 'Self-Governance and Federal Programs',
		group: 'Native nations',
		detailHeader: 'Nations taking part',
		list: '/nations/federal-programs',
		items: () => programSummaries().map(({ program, count }) => ({ title: program.title, href: federalProgramPage(program.key), detail: count.toLocaleString('en-US') })),
		breakdown: () => [`${counted(nationsInPrograms(), 'nation takes', 'nations take')} part`]
	},
	{ identifier: 'intergovernmental-agreements', search: { group: 'document' }, title: 'Compacts and Agreements', group: 'Native nations', detailHeader: 'Nation', sourceKinds: ['intergovernmental-agreement'], items: sourcesOfKind(['intergovernmental-agreement'], tribesOf) },
	{
		identifier: 'oklahoma-state-tribal-agreements',
		search: { group: 'document' },
		title: 'Oklahoma State-Tribal Agreements',
		group: 'Native nations',
		detailHeader: 'Nation',
		sourceKinds: ['intergovernmental-agreement'],
		items: () => oklahomaAgreements().map((record) => sourceItem(record, tribesOf(record)))
	},
	{
		identifier: 'approved-nation-laws',
		search: { group: 'document' },
		title: 'Nations’ Laws Approved by Federal Agencies',
		group: 'Native nations',
		detailHeader: 'Kind and nation',
		sourceKinds: ['tribal-code', 'federal-agency-document'],
		items: approvedNationLaws
	},
	{
		identifier: 'stories', search: { group: 'story' },
		title: 'Stories',
		group: 'Native nations',
		detailHeader: 'Nation',
		items: () => storySummaries().map((story) => ({ title: story.title, href: `/stories/${story.id}`, detail: story.nations.map((nation) => nation.name).join('; ') || undefined })),
		breakdown: () => [`from ${counted(distinct(storySummaries().flatMap((story) => story.nations.map((nation) => nation.name))), 'nation', 'nations')}`]
	},

	// Federal law
	{ identifier: 'treaties', search: { group: 'law', label: 'Treaty' }, title: 'Treaties and Agreements', group: 'Federal law', detailHeader: 'Nation', items: treaties },
	{ identifier: 'federal-statutes', search: { group: 'law', label: 'Statute' }, title: 'Statutes', group: 'Federal law', sourceKinds: ['federal-statute'], items: sourcesOfKind(['federal-statute']) },
	{ identifier: 'federal-regulations', search: { group: 'law', label: 'Regulation' }, title: 'Regulations', group: 'Federal law', sourceKinds: ['federal-regulation'], items: sourcesOfKind(['federal-regulation']) },
	// Each section in force of Title 25 of the Code and of 25 C.F.R., listed on its chapter's or part's page (title-25-sections.ts).
	{ identifier: 'united-states-code-sections', search: { group: 'law', label: 'U.S. Code section' }, title: 'U.S. Code Sections (Title 25)', group: 'Federal law', detailHeader: 'Chapter', items: () => allSections('code'), breakdown: (items) => [`in ${counted(distinct(items.map((item) => item.detail)), 'chapter', 'chapters')}`] },
	{ identifier: 'regulation-sections', search: { group: 'law', label: 'Regulation section' }, title: 'Regulation Sections (25 C.F.R.)', group: 'Federal law', detailHeader: 'Part', items: () => allSections('regulations'), breakdown: (items) => [`in ${counted(distinct(items.map((item) => item.detail)), 'part', 'parts')}`] },
	{ identifier: 'executive-orders', search: { group: 'law', label: 'Executive order' }, title: 'Executive Orders', group: 'Federal law', sourceKinds: ['executive-order'], items: sourcesOfKind(['executive-order']) },
	{ identifier: 'federal-register-notices', search: { group: 'law', label: 'Federal Register notice' }, title: 'Federal Register Notices', group: 'Federal law', sourceKinds: ['federal-register-notice'], items: sourcesOfKind(['federal-register-notice']) },
	{ identifier: 'federal-acknowledgment', search: { group: 'law', label: 'Acknowledgment document' }, title: 'Federal Acknowledgment Petitions', group: 'Federal law', detailHeader: 'Kind', sourceKinds: ['federal-agency-document'], items: acknowledgmentDocuments },
	{ identifier: 'solicitor-opinions', search: { group: 'law', label: 'Solicitor’s opinion' }, title: 'Solicitor’s Opinions', group: 'Federal law', detailHeader: 'Number', sourceKinds: ['federal-agency-document'], items: solicitorOpinions },
	{ identifier: 'national-indian-gaming-commission', search: { group: 'law', label: 'Gaming Commission document' }, title: 'Gaming Commission Opinions and Actions', group: 'Federal law', detailHeader: 'Kind', sourceKinds: ['federal-agency-document'], items: gamingCommissionDocuments },
	// Royce's land cessions (1899), each opening on the Map page at its year (historic maps, 2026-11-26).
	{
		identifier: 'land-cessions',
		search: { group: 'law', label: 'Land cession' },
		title: 'Land Cessions',
		group: 'Federal law',
		detailHeader: 'Named in Royce’s schedule',
		items: () => landCessions().map((cession) => ({ title: `Royce cession ${cession.royce}`, href: `/nations/map?cession=${cession.royce}`, year: cession.dates[0] ? Number(cession.dates[0].slice(0, 4)) : undefined, detail: cession.schedule }))
	},

	// State law
	{ identifier: 'state-statutes', search: { group: 'law', label: 'State statute' }, title: 'State Statutes', group: 'State law', detailHeader: 'State', sourceKinds: ['state-statute'], items: stateStatutes, breakdown: stateBreakdown },

	// Courts and cases
	{ identifier: 'supreme-court-cases', search: { group: 'case', label: 'Court case' }, title: 'U.S. Supreme Court Cases', group: 'Courts and cases', items: casesBy(supremeCourt) },
	{ identifier: 'other-court-cases', search: { group: 'case', label: 'Court case' }, title: 'Other Court Cases', group: 'Courts and cases', detailHeader: 'Court', items: casesBy((authority) => !supremeCourt(authority) && !indianAppealsBoard(authority) && authority !== gamingCommission) },
	{
		identifier: 'interior-board-of-indian-appeals',
		search: { group: 'case', label: 'Interior Board of Indian Appeals decision' },
		title: 'Interior Board of Indian Appeals Decisions',
		group: 'Courts and cases',
		items: casesBy(indianAppealsBoard),
		heldBack: heldBackBoardDecisions,
		heldBackReason: 'held back for a privacy review'
	},
	{
		identifier: 'federal-court-opinions', search: { group: 'case', label: 'Lower federal court opinion' },
		title: 'Lower Federal Court Opinions',
		group: 'Courts and cases',
		detailHeader: 'Court',
		items: federalCourtOpinions,
		heldBack: heldBackFederalOpinions,
		heldBackReason: 'held back for a privacy review'
	},
	{
		identifier: 'state-court-opinions', search: { group: 'case', label: 'State court opinion' },
		title: 'State Court Opinions',
		group: 'Courts and cases',
		detailHeader: 'Court',
		items: stateCourtOpinions,
		heldBack: heldBackStateOpinions,
		heldBackReason: 'held back for a privacy review'
	},
	{
		identifier: 'tribal-court-opinions', search: { group: 'case', label: 'Tribal court opinion' },
		title: 'Tribal Court Opinions',
		group: 'Courts and cases',
		detailHeader: 'Court',
		items: () => tribalCourtOpinions().map((opinion) => ({ title: opinion.name, href: opinion.path, year: Number(opinion.year) || undefined, detail: opinion.court, copies: [copiesIndexed().byKey.get(opinion.key)].filter((copy) => copy !== undefined) })),
		heldBack: heldBackOpinionCount,
		heldBackReason: 'held back for a privacy review'
	},
	{
		identifier: 'supreme-courts', search: { group: 'case', label: 'U.S. Supreme Court' },
		title: 'U.S. Supreme Courts',
		group: 'Courts and cases',
		detailHeader: 'Years',
		items: () => courtsWithPages().map((court) => ({ title: court.name, href: courtPath(court.name) ?? undefined, year: Number(court.years.slice(0, 4)), detail: court.years.endsWith('–') ? `${court.years}today` : court.years })),
		years: () => {
			const courts = courtsWithPages();
			const last = courts.at(-1)?.years.split('–')[1];
			return courts.length ? `${courts[0].years.slice(0, 4)}–${last || 'today'}` : '';
		}
	},
	{ identifier: 'courts', search: { group: 'case', label: 'Court' }, title: 'Courts', group: 'Courts and cases', detailHeader: 'Kind', list: '/courts', items: () => namedCourts().map((court) => ({ title: court.name, href: `/courts/${court.key}`, detail: court.kind })), breakdown: (items) => tally(items.map((item) => item.detail ?? 'Court'), (kind, count) => counted(count, kind === 'Court' ? 'other court' : kind.toLowerCase(), kind === 'Court' ? 'other courts' : `${kind.toLowerCase()}s`)) },

	// People
	{ identifier: 'biographies', search: { group: 'person', label: 'Biography' }, title: 'Biographies', group: 'People', items: () => biographies().map((person) => ({ title: person.name, href: biographyPath(person.key) })) },
	{
		identifier: 'justices', search: { group: 'person', label: 'U.S. Supreme Court Justice' },
		title: 'U.S. Supreme Court Justices',
		group: 'People',
		detailHeader: 'Years',
		items: () => peopleIndex().justices.map((justice) => ({ title: justice.name, href: justice.link, year: Number(justice.start.slice(0, 4)), detail: justice.years.endsWith('–') ? `${justice.years}today` : justice.years })),
		years: () => {
			const years = peopleIndex().justices.map((justice) => Number(justice.start.slice(0, 4)));
			return years.length ? `${Math.min(...years)}–today` : '';
		}
	},
	{
		identifier: 'presidents', search: { group: 'person', label: 'U.S. President' },
		title: 'U.S. Presidents',
		group: 'People',
		detailHeader: 'Years',
		items: () => peopleIndex().presidents.map((president) => ({ title: president.name, href: president.link, year: president.start, detail: president.years.endsWith('–') ? `${president.years}today` : president.years })),
		years: () => {
			const years = peopleIndex().presidents.map((president) => president.start);
			return years.length ? `${Math.min(...years)}–today` : '';
		}
	},

	// Reference
	// Documents and saved web pages are counted apart (Trevor, Nov. 27, 2026); both are listed together at /copies.
	{ identifier: 'source-copies', search: { group: 'reference', label: 'Source document' }, title: 'Documents', group: 'Reference', list: '/copies', items: () => publicCopies().filter((copy) => !isSavedWebPage(copy)).map(copyItem), breakdown: copyFileBreakdown },
	{ identifier: 'saved-web-pages', search: { group: 'reference', label: 'Saved web page' }, title: 'Saved Web Pages', group: 'Reference', list: '/copies', items: () => publicCopies().filter(isSavedWebPage).map(copyItem), breakdown: webPageBreakdown },
	{
		identifier: 'historic-maps', search: { group: 'reference', label: 'Historic map' },
		title: 'Historic Maps',
		group: 'Reference',
		items: () => [
			...[...royceSheets().values()].map((sheet) => ({ title: `Royce’s map: ${sheet.name}`, href: sheet.image, year: 1899 })),
			...historicMapScans().map((map) => ({ title: map.title, href: map.images[0].image, year: map.year ?? undefined }))
		],
		breakdown: () => [counted(royceSheets().size, 'sheet', 'sheets') + ' of Royce’s 1899 atlas', counted(historicMapScans().length, 'other map', 'other maps')],
		years: () => {
			const years = [1899, ...historicMapScans().flatMap((map) => (map.year ? [map.year] : []))];
			return `${Math.min(...years)}–${Math.max(...years)}`;
		}
	},
	{ identifier: 'charts', search: { group: 'reference', label: 'Chart' }, title: 'Charts', group: 'Reference', detailHeader: 'Topic', items: () => dataChartList.map((chart) => ({ title: chart.title, href: dataChartTrail(chart).at(-1)?.href, detail: dataChartTrail(chart).at(-2)?.label })), breakdown: (items) => [`in ${counted(distinct(items.map((item) => item.detail)), 'topic', 'topics')}`] },
	{ identifier: 'glossary-terms', search: { group: 'term' }, title: 'Glossary Terms', group: 'Reference', items: () => glossary().map((entry) => ({ title: entry.term, href: `/glossary/${entry.id}` })) },
	{ identifier: 'forms', search: { group: 'reference', label: 'Form' }, title: 'Forms', group: 'Reference', items: () => buildFormCatalog().map((form) => ({ title: form.title, href: `/forms/${form.slug}` })) }
];

/**
 * Source record kinds that are counted only within Source documents, not as a
 * collection of their own. A kind in neither this list nor any collection's
 * sourceKinds fails tests/collections.test.ts, so a new data set is not missed.
 */
export const kindsCountedOnlyAsSources = ['web-page', 'other', 'journal-article', 'report', 'book', 'book-chapter', 'journal', 'dataset', 'territorial-statute', 'uniform-act', 'model-law', 'court-rule', 'federal-case', 'state-case', 'territorial-case', 'tribal-case'];

export interface CollectionCount {
	identifier: string;
	title: string;
	group: CollectionGroup;
	/** Where its card leads: the list of exactly what it counts. */
	href: string;
	count: number;
	/** The years its items cover, such as "1823–2025". */
	years?: string;
	heldBack?: number;
	heldBackReason?: string;
	/** More about its number, as short parts read after it. */
	breakdown?: string[];
	/** Its list's copy columns: one copy for each item, or counts of each item's copies. */
	copyColumns?: 'copy' | 'counts';
}

/** The years a list of items covers, from the earliest to the latest. */
function yearSpan(items: CollectionItem[]): string | undefined {
	const years = items.map((item) => item.year).filter((year): year is number => Boolean(year));
	if (years.length === 0) return undefined;
	const first = Math.min(...years);
	const last = Math.max(...years);
	return first === last ? String(first) : `${first}–${last}`;
}

export const collectionPath = (identifier: string) => `/stats/${identifier}`;

/** Every collection with its count, in registry order, leaving out any that count nothing yet. */
export function collectionCounts(): CollectionCount[] {
	return collections
		.map((collection) => {
			const items = collection.items();
			const held = collection.heldBack?.() ?? 0;
			const breakdown = collection.breakdown?.(items) ?? documentBreakdown(items);
			const withCopies = items.some((item) => item.copies?.length);
			return {
				identifier: collection.identifier,
				title: collection.title,
				group: collection.group,
				href: collection.list ?? collectionPath(collection.identifier),
				count: items.length,
				...(collection.years ? { years: collection.years() } : yearSpan(items) ? { years: yearSpan(items) } : {}),
				...(held > 0 ? { heldBack: held, heldBackReason: collection.heldBackReason } : {}),
				...(breakdown.length > 0 ? { breakdown } : {}),
				...(withCopies ? { copyColumns: collection.copyCounts ? ('counts' as const) : ('copy' as const) } : {})
			};
		})
		.filter((collection) => collection.count > 0);
}

/** The collections under each heading, for the page, leaving out empty headings. */
export function collectionsByGroup(): { group: CollectionGroup; collections: CollectionCount[] }[] {
	const counts = collectionCounts();
	return collectionGroups
		.map((group) => ({ group, collections: counts.filter((collection) => collection.group === group) }))
		.filter(({ collections }) => collections.length > 0);
}

/** The collections that get their own list page: every one without an existing page that lists it. */
export const listedCollections = () => collections.filter((collection) => !collection.list && collection.items().length > 0);
