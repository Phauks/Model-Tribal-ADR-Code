/**
 * The entries of the shared timeline (src/lib/timeline.ts), gathered at build
 * time from the records that carry a date:
 *
 * - a nation's treaties (`treaties[].signed`) and how its land was set aside
 *   (`land_establishment[].date`), in the row "Treaties and land";
 * - the versions of its laws and agreements (content/documents/, the earliest
 *   date each version's sources give), its dated agreements with states and
 *   agencies (`jurisdiction_agreements[].date`), its gaming ordinances
 *   (`gaming.ordinances[].approved`) and Indian lands opinions
 *   (`gaming.indian_lands_opinions[].date`), in "Laws and agreements". The
 *   compacts in `gaming.compacts` are the same documents as their version
 *   histories, so only the histories are used;
 * - court decisions whose source record names the nation (`tribes`), in
 *   "Court decisions";
 * - the nation's published court opinions, counted by year
 *   (research/tribal-court-opinions/opinions.csv, decision record 0047);
 * - federal statutes and executive orders: on a nation's timeline, those
 *   whose source record names the nation, and a short list of laws that
 *   apply to every nation, drawn faintly for context.
 *
 * On a nation's page each entry carries the markers of its sources, which
 * link to the page's References list. Stories have no date field yet, so
 * they are not on the timeline.
 */
import { displayName, stateName } from '../nation-labels.ts';
import { webLink } from '../contact-links.ts';
import { copyPagePath } from '../public-copies.ts';
import type { CitationItem } from '../citation-formats.ts';
import { isTimelineDate, timelineRows, type OpinionYear, type TimelineEntry, type TimelineRow } from '../timeline.ts';
import { courtAbbreviation } from './case-citations.ts';
import { casePreviewList } from './case-previews.ts';
import {
	documentHistories,
	nations,
	publicCopyFor,
	sources as sourceRecords,
	type DocumentHistoryRecord,
	type NationRecord,
	type SourceRecord
} from './content.ts';
import { documentHeading, documentHistoryView, nationDocumentHistories, type DocumentHistoryView } from './document-history.ts';
import { SourceUses, whereInSource, type CitationMark } from './source-uses.ts';
import { opinionsSourceKey, tribalCourtOpinions } from './tribal-court-opinions.ts';
import { lawNames } from '../law-names.ts';

/** The heading the timeline's sources are filed under in a page's References list. */
export const timelineHeading = 'Timeline';

/**
 * Federal laws that apply to every nation, drawn faintly on each nation's
 * timeline for context, with the names they are known by. A project choice:
 * the statutes on criminal and civil jurisdiction, self-government, children,
 * gaming and Tribal courts that the legal history essay treats as the
 * framework for Tribal justice (content/essays/i-legal-history-timeline.md).
 */
export const contextLaws: Record<string, string> = lawNames;

const caseKinds = new Set(['federal-case', 'state-case', 'territorial-case']);
const federalKinds = new Set(['federal-statute', 'executive-order']);

/** A source record's date: YYYY, YYYY-MM or YYYY-MM-DD from its `issued` date parts. */
export function issuedDate(record: SourceRecord): string | undefined {
	const parts = record.citation.issued?.['date-parts']?.[0];
	if (!parts?.[0]) return undefined;
	const [year, month, day] = parts;
	const date = [String(year).padStart(4, '0'), month ? String(month).padStart(2, '0') : undefined, month && day ? String(day).padStart(2, '0') : undefined]
		.filter(Boolean)
		.join('-');
	return isTimelineDate(date) ? date : undefined;
}

/** A source record's own address: this site's copy of it when it keeps one, else where it was published. */
function recordLink(record: SourceRecord): string | undefined {
	const copy = publicCopyFor(record.original_link) ?? publicCopyFor(record.citation.URL);
	if (copy) return copyPagePath(copy);
	return webLink(record.original_link) ?? webLink(record.citation.URL);
}

const reporterNames: Record<string, string> = { 'United States Reports': 'U.S.' };

/** A case's citation after its name, as the Indigo Book gives it: "358 U.S. 217 (1959)", "272 F.2d 131 (10th Cir. 1959)". */
export function caseCitation(record: SourceRecord): string {
	const citation = record.citation;
	const reporter = citation['container-title'] ? (reporterNames[citation['container-title']] ?? citation['container-title']) : undefined;
	const year = citation.issued?.['date-parts']?.[0]?.[0];
	const court = courtAbbreviation(citation.authority, { ...citation, 'container-title': reporter });
	const parenthetical = [typeof court === 'string' ? court : '', year ? String(year) : ''].filter(Boolean).join(' ');
	return [[citation.volume, reporter, citation.page].filter(Boolean).join(' '), parenthetical ? `(${parenthetical})` : '']
		.filter(Boolean)
		.join(' ');
}

/**
 * A statute's or order's citation after its name, as the approved mockups show it beside the
 * entry's date: "82 Stat. 77", "61 Fed. Reg. 4729". Copying the citation adds the year
 * (entryCitation in src/lib/timeline.ts). Empty when its title already holds one.
 */
export function lawCitation(record: SourceRecord, title: string): string {
	const citation = record.citation;
	if (/\bStat\.|Pub\. L\./.test(title)) return '';
	const container = citation['container-title'] ?? '';
	const reporter = /Statutes at Large/i.test(container) ? 'Stat.' : /Federal Register/i.test(container) ? 'Fed. Reg.' : undefined;
	if (!reporter || !citation.volume || !citation.page) return '';
	return `${citation.volume} ${reporter} ${citation.page}`;
}

/** A law's name without its citation, to find two records of the same law: "Menominee Restoration Act". */
export function lawKey(title: string): string {
	return title.split(/,\s*(?:Pub\. L\.|\d+ Stat\.)/)[0].trim().toLocaleLowerCase('en-US');
}

function lawTitle(record: SourceRecord): string {
	const citation = record.citation as SourceRecord['citation'] & { 'title-short'?: string };
	return contextLaws[record.key] ?? citation.title?.trim() ?? record.key;
}

function caseEntry(record: SourceRecord): TimelineEntry | undefined {
	const date = issuedDate(record);
	if (!date || !record.citation.title) return undefined;
	return {
		id: `case-${record.key}`,
		kind: 'case',
		date,
		title: record.citation.title,
		italic: true,
		citation: caseCitation(record),
		// The court, where the citation does not already name it: the Supreme Court's reporter says only "U.S.".
		detail: /^Supreme Court of the United States$/.test(record.citation.authority ?? '') ? 'Supreme Court of the United States' : undefined,
		link: caseLink(record),
		nations: record.tribes
	};
}

/** A land base's line: "Navajo Reservation first set aside", where the record says it was first set aside. */
export function landTitle(area: string, detail: string | undefined): { title: string; detail?: string } {
	if (detail && /^first set aside$/i.test(detail)) return { title: `${area.replace(/\s*\([^)]*\)$/, '')} first set aside` };
	return { title: area, detail };
}

/**
 * An agreement's line: who it is with in the title, and what it covers after it.
 * "Title IV-E agreement (maintenance costs only)" with New Mexico Children, Youth and Families Department reads
 * "Title IV-E agreement with New Mexico Children, Youth and Families Department, Maintenance costs only";
 * "Agreement for state police commissions …" with New Mexico State Police reads "Agreement with New Mexico State Police, State police commissions …".
 */
export function agreementTitle(agreement: string | undefined, party: string): { title: string; citation?: string } {
	const capital = (text: string) => text.charAt(0).toLocaleUpperCase('en-US') + text.slice(1);
	if (!agreement) return { title: `Agreement with ${party}` };
	const covering = /^Agreement for (.+)$/i.exec(agreement);
	if (covering) return { title: `Agreement with ${party}`, citation: capital(covering[1]) };
	const parenthetical = /^(.*?)\s*\(([^)]*)\)$/.exec(agreement);
	if (parenthetical) return { title: `${parenthetical[1]} with ${party}`, citation: capital(parenthetical[2]) };
	return { title: `${agreement} with ${party}` };
}

function lawEntry(record: SourceRecord, context: boolean): TimelineEntry | undefined {
	const date = issuedDate(record);
	if (!date) return undefined;
	const title = lawTitle(record);
	return {
		id: `law-${record.key}`,
		kind: 'federal',
		date,
		title,
		citation: lawCitation(record, title) || undefined,
		link: recordLink(record),
		nations: record.tribes,
		context: context || undefined
	};
}

/**
 * Where a case's name links: the copy of the opinion this site keeps, else
 * where it was published, with a Caselaw Access Project data file read as
 * its web page. Not the case's box in the legal history essay, which is
 * published from the database and may not be published yet.
 */
function caseLink(record: SourceRecord): string | undefined {
	const preview = caseLinks().get(record.key);
	if (preview) return preview;
	return recordLink(record)?.replace(/^(https:\/\/static\.case\.law\/.+)\/cases\/([^/]+)\.json$/, '$1/html/$2.html');
}

let caseLinkCache: Map<string, string> | undefined;

/** The links case previews use for cases with no box in an essay: the copy on this site or the published opinion. */
function caseLinks(): Map<string, string> {
	caseLinkCache ??= new Map(
		casePreviewList()
			.cases.filter((preview) => preview.opens !== 'box')
			.map((preview) => [preview.id, preview.link])
	);
	return caseLinkCache;
}

/** The topics of an opinion, as words, that the full timeline's "Mediation or arbitration" filter finds. */
const mediationTopics = new Set(['mediation', 'arbitration', 'alternative dispute resolution']);

/** The opinions of one nation, or of every nation, counted by year (and by nation on the full timeline). */
function opinionYears(nationId?: string): OpinionYear[] {
	const counts = new Map<string, OpinionYear>();
	for (const opinion of tribalCourtOpinions()) {
		const year = Number(opinion.year);
		if (!Number.isFinite(year)) continue;
		const owners = nationId ? (opinion.nations.includes(nationId) ? [undefined] : []) : opinion.nations;
		for (const nation of owners) {
			const key = `${year}|${nation ?? ''}`;
			const entry = counts.get(key) ?? { year, count: 0, peacemaking: 0, mediation: 0, both: 0, ...(nation ? { nation } : {}) };
			const peacemaking = opinion.topics.includes('peacemaking');
			const mediation = opinion.topics.some((topic) => mediationTopics.has(topic));
			entry.count += 1;
			if (peacemaking) entry.peacemaking += 1;
			if (mediation) entry.mediation = (entry.mediation ?? 0) + 1;
			if (peacemaking && mediation) entry.both = (entry.both ?? 0) + 1;
			counts.set(key, entry);
		}
	}
	return [...counts.values()].sort((first, second) => first.year - second.year || (first.nation ?? '').localeCompare(second.nation ?? ''));
}

/** "Gaming ordinance" or "Gaming ordinance amendment", from the column of the commission's table the date came from. */
function ordinanceTitle(fact: { locator?: string }): string {
	return /amendment/i.test(fact.locator ?? '') ? 'Gaming ordinance amendment' : 'Gaming ordinance';
}

type Marker = (key: string | undefined, text: string, where?: string) => CitationMark[] | undefined;

/**
 * The entries of one nation's own records: treaties, land, laws and
 * agreements. `mark` gives each its source's markers on a nation's page;
 * the full timeline passes none.
 */
function nationRecordEntries(
	record: NationRecord,
	documents: { history: DocumentHistoryRecord; view: DocumentHistoryView; heading: string }[],
	mark: Marker,
	pageLink: string
): TimelineEntry[] {
	const entries: TimelineEntry[] = [];
	(record.treaties ?? []).forEach((fact, index) => {
		if (!isTimelineDate(fact.signed)) return;
		entries.push({
			id: `treaty-${record.id}-${index + 1}`,
			kind: 'treaty',
			date: fact.signed,
			title: fact.title,
			citation: fact.statutes_at_large,
			link: webLink(fact.kappler?.link) ?? `${pageLink}#ties-heading`,
			nations: [record.id],
			citations: mark(fact.source, fact.title, whereInSource(fact))
		});
	});
	(record.land_establishment ?? []).forEach((fact, index) => {
		if (!isTimelineDate(fact.date)) return;
		const { title, detail } = landTitle(fact.land_area, fact.detail);
		entries.push({
			id: `land-${record.id}-${index + 1}`,
			kind: 'treaty',
			date: fact.date,
			title,
			citation: fact.instrument,
			detail,
			link: `${pageLink}#ties-heading`,
			nations: [record.id],
			citations: mark(fact.source, fact.land_area, whereInSource(fact))
		});
	});
	for (const { history, view, heading } of documents) {
		view.versions.forEach((version, index) => {
			if (!version.date) return;
			const source = history.versions[index];
			const marks = [
				...(mark(source?.source, version.label, whereInSource(source ?? {})) ?? []),
				...(mark(source?.approval?.source, version.label, source?.approval?.locator) ?? [])
			];
			entries.push({
				id: `document-${history.id}-${version.id}`,
				kind: 'document',
				date: version.date,
				title: `${heading}, ${version.label}`,
				// The Federal Register notice of its approval, where the record gives one: "68 Fed. Reg. 5912 (Feb. 5, 2003)".
				citation: /Fed\. Reg\./.test(source?.approval?.locator ?? '') ? source?.approval?.locator : undefined,
				detail: version.inEffect ? 'In effect' : undefined,
				link: version.link ?? `${pageLink}#document-${history.id}`,
				nations: history.nations ?? [record.id],
				citations: marks.length > 0 ? marks : undefined
			});
		});
	}
	(record.jurisdiction_agreements ?? []).forEach((fact, index) => {
		if (!isTimelineDate(fact.date)) return;
		const { title, citation } = agreementTitle(fact.agreement, fact.other_party);
		entries.push({
			id: `agreement-${record.id}-${index + 1}`,
			kind: 'document',
			date: fact.date,
			title,
			citation,
			link: `${pageLink}#jurisdiction-heading`,
			nations: [record.id],
			citations: mark(fact.source, title, whereInSource(fact))
		});
	});
	(record.gaming?.ordinances ?? []).forEach((fact, index) => {
		const date = fact.approved;
		if (!isTimelineDate(date)) return;
		const title = ordinanceTitle(fact);
		entries.push({
			id: `ordinance-${record.id}-${index + 1}`,
			kind: 'document',
			date,
			title,
			citation: /^nigc-gaming-ordinances/.test(fact.source ?? '') ? 'National Indian Gaming Commission ordinance table' : undefined,
			link: webLink(fact.link) ?? pageLink,
			nations: [record.id],
			citations: mark(fact.source, title, whereInSource(fact))
		});
	});
	(record.gaming?.indian_lands_opinions ?? []).forEach((fact, index) => {
		if (!isTimelineDate(fact.date)) return;
		const title = `Indian lands opinion on gaming: ${fact.parcel}`;
		entries.push({
			id: `lands-opinion-${record.id}-${index + 1}`,
			kind: 'document',
			date: fact.date,
			title,
			link: webLink(fact.link) ?? `${pageLink}#ties-heading`,
			nations: [record.id],
			citations: mark(fact.source, title, whereInSource(fact))
		});
	});
	return entries;
}

let datedSourceCache: Map<string, SourceRecord[]> | undefined;

/** The dated court decisions, statutes and orders whose source record names each nation. */
function datedSourcesByNation(): Map<string, SourceRecord[]> {
	if (!datedSourceCache) {
		datedSourceCache = new Map();
		for (const source of sourceRecords().values()) {
			if (!(caseKinds.has(source.kind) || federalKinds.has(source.kind)) || !issuedDate(source)) continue;
			for (const nation of source.tribes ?? []) datedSourceCache.set(nation, [...(datedSourceCache.get(nation) ?? []), source]);
		}
	}
	return datedSourceCache;
}

/** What a nation's page shows in its Timeline section. */
export interface NationTimeline {
	entries: TimelineEntry[];
	opinions: OpinionYear[];
	/** The nation's opinions, where the counts lead. */
	opinionsLink?: string;
	opinionCitations?: CitationMark[];
}

/**
 * A nation's timeline for its page. Call it after the page has cited the
 * sections the timeline repeats, so an entry's marker reuses its source's
 * number rather than adding a line to the References list.
 */
export function nationTimeline(
	record: NationRecord,
	sources: SourceUses,
	documents: (DocumentHistoryView & { heading: string })[]
): NationTimeline {
	const histories = new Map(documentHistories().map((history) => [history.id, history]));
	const pageLink = `/nations/${record.id}`;
	const documentsOf = () =>
		documents.flatMap((view) => {
			const history = histories.get(view.id);
			return history ? [{ history, view, heading: view.heading }] : [];
		});
	// A nation with nothing dated of its own gets no timeline, and its page
	// cites nothing for one.
	const ownSources = datedSourcesByNation().get(record.id) ?? [];
	const opinions = opinionYears(record.id);
	if (nationRecordEntries(record, documentsOf(), () => undefined, '').length === 0 && ownSources.length === 0 && opinions.length === 0) {
		return { entries: [], opinions: [] };
	}
	sources.part(timelineHeading);
	const mark: Marker = (key, text, where) => (key ? [sources.again(key, { section: timelineHeading, text, where })] : undefined);
	const entries: TimelineEntry[] = nationRecordEntries(record, documentsOf(), mark, '').map((entry) => ({ ...entry, link: entry.link === '' ? pageLink : entry.link, nations: undefined }));

	const records = sourceRecords();
	const contextSources = Object.keys(contextLaws)
		.map((key) => records.get(key))
		.filter((source): source is SourceRecord => !!source && !ownSources.includes(source));
	for (const source of [...ownSources, ...contextSources]) {
		const own = ownSources.includes(source);
		const entry = caseKinds.has(source.kind) ? caseEntry(source) : lawEntry(source, !own);
		if (!entry) continue;
		// A law shown for context is drawn but not listed, and links to the law itself, so it has no marker.
		entries.push({ ...entry, nations: undefined, citations: own ? mark(source.key, entry.title) : undefined });
	}

	const opinionCitations = opinions.length > 0 ? [sources.again(opinionsSourceKey, { section: timelineHeading, text: 'Published opinions, counted by year' })] : undefined;
	return {
		entries,
		opinions,
		opinionsLink: opinions.length > 0 ? `${pageLink}/opinions` : undefined,
		opinionCitations
	};
}

/** A nation as the full timeline names it, with the states its filter uses. */
export interface TimelineNation {
	name: string;
	states: { code: string; name: string }[];
}

/** What the full timeline (/nations/timeline) shows. */
export interface SiteTimeline {
	entries: TimelineEntry[];
	opinions: OpinionYear[];
	nations: Record<string, TimelineNation>;
	/** The keys of the source records the entries come from, for the "Sources of the entries" files. */
	sources: string[];
}

let siteCache: SiteTimeline | undefined;

/** Every dated record of every nation, and every dated federal law and court decision. */
export function siteTimeline(): SiteTimeline {
	if (siteCache) return siteCache;
	const published = nations().filter((record) => record.review?.status !== 'withdrawn-at-request' && !record.example);
	const byId = new Map(published.map((record) => [record.id, record]));
	const histories = documentHistories();
	// The full timeline shows no markers; it only notes each entry's sources for its download files.
	const used = new Set<string>();
	const noMarks: Marker = (key) => {
		if (key) used.add(key);
		return undefined;
	};
	const stub = { cite: () => ({ number: 0, anchor: '' }), citeFact: () => undefined };

	const entries: TimelineEntry[] = [];
	const treaties = new Map<string, TimelineEntry>();
	for (const record of published) {
		const names = [record.names.official, displayName(record.names.official)];
		const documents = histories
			// A document shared by several nations is listed once, under the first of them.
			.filter((history) => history.nations?.[0] === record.id)
			.map((history) => ({ history, view: documentHistoryView(history, stub), heading: documentHeading(history.title, names) }));
		for (const entry of nationRecordEntries(record, documents, noMarks, `/nations/${record.id}`)) {
			if (entry.kind !== 'treaty' || !entry.id.startsWith('treaty-')) {
				entries.push(entry);
				continue;
			}
			// One treaty signed by several nations is one entry naming them all.
			const key = `${entry.title}|${entry.date}`;
			const same = treaties.get(key);
			if (same) same.nations = [...(same.nations ?? []), record.id];
			else {
				const shared = { ...entry, id: `treaty-${treaties.size + 1}` };
				treaties.set(key, shared);
				entries.push(shared);
			}
		}
	}

	const laws = new Map<string, TimelineEntry>();
	for (const source of sourceRecords().values()) {
		const entry = caseKinds.has(source.kind) ? caseEntry(source) : federalKinds.has(source.kind) ? lawEntry(source, false) : undefined;
		if (!entry) continue;
		used.add(source.key);
		const named = { ...entry, nations: entry.nations?.filter((id) => byId.has(id)) };
		if (entry.kind !== 'federal') {
			entries.push(named);
			continue;
		}
		// Some laws have two source records, one under the law's name and one under its public law
		// number (the Menominee Restoration Act, the Texas Band of Kickapoo Act): one entry for both.
		const key = `${entry.date}|${lawKey(entry.title)}`;
		const same = laws.get(key);
		if (!same) {
			laws.set(key, named);
			entries.push(named);
		} else {
			same.nations = [...new Set([...(same.nations ?? []), ...(named.nations ?? [])])];
			same.citation ??= named.citation;
		}
	}

	const opinions = opinionYears().filter((year) => !year.nation || byId.has(year.nation));
	const named = new Set([...entries.flatMap((entry) => entry.nations ?? []), ...opinions.flatMap((year) => (year.nation ? [year.nation] : []))]);
	const nationsNamed: Record<string, TimelineNation> = {};
	for (const id of [...named].sort()) {
		const record = byId.get(id);
		if (!record) continue;
		const codes = [...new Set((record.states ?? []).map((fact) => fact.state))].sort();
		nationsNamed[id] = { name: displayName(record.names.official), states: codes.map((code) => ({ code, name: stateName(code) })) };
	}
	if (opinions.length > 0) used.add(opinionsSourceKey);
	siteCache = {
		entries: entries.map((entry) => (entry.nations?.length ? entry : { ...entry, nations: undefined })),
		opinions,
		nations: nationsNamed,
		sources: [...used].filter((key) => sourceRecords().has(key)).sort()
	};
	return siteCache;
}

/** One nation's timeline as rows for its download files; undefined for a nation with no published page. */
export function nationTimelineFile(nationId: string): TimelineRow[] | undefined {
	const record = nations().find((candidate) => candidate.id === nationId);
	if (!record || record.review?.status === 'withdrawn-at-request') return undefined;
	const names = [record.names.official, displayName(record.names.official)];
	const stub = { cite: () => ({ number: 0, anchor: '' }), citeFact: () => undefined };
	const documents = nationDocumentHistories(nationId).map((history) => ({
		...documentHistoryView(history, stub),
		heading: documentHeading(history.title, names)
	}));
	const timeline = nationTimeline(record, new SourceUses(), documents);
	const pageLink = `/nations/${nationId}`;
	const entries = timeline.entries.map((entry) => ({ ...entry, link: entry.link?.startsWith('#') ? `${pageLink}${entry.link}` : entry.link }));
	return timelineRows(entries, timeline.opinions);
}

/** The sources of the full timeline's entries as citation data, for its CSL JSON, RIS and BibTeX files. */
export function siteTimelineCitationItems(): CitationItem[] {
	const records = sourceRecords();
	return siteTimeline().sources.flatMap((key) => {
		const source = records.get(key);
		return source ? [{ ...(source.citation as Omit<CitationItem, 'id'>), id: key }] : [];
	});
}
