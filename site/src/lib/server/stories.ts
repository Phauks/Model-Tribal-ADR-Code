/**
 * The stories as the website shows them: the list at /stories and one page
 * per story at /stories/<id>, built from content/stories/ when the site is
 * built (decision records 0019 and 0029). A record added to that folder
 * appears on the next build with no change here.
 *
 * The project never retells or summarizes a story. A page shows the story's
 * title, its nations and kind, the whole story in the teller's exact words
 * where it may be reproduced (decision record 0034: a public-domain telling,
 * a nation's own law, or permission), otherwise the excerpts the record
 * quotes with credit and pinpoint, each telling with a link to read it where
 * it was published, and any protocol a source states. Citations are
 * listed in one Sources section at the end of the page, as on nation pages.
 */
import { sourceCitations } from 'virtual:source-citations';
import {
	authorityLabels,
	labelFor,
	lengthLabels,
	protocolKindLabels,
	spaced,
	storyKindLabels
} from '../story-labels.ts';
import {
	awaitsNationReview,
	isoDate,
	shownExcerpts,
	shownFullText,
	shownTellings,
	storyIsShown,
	storiesOfNation,
	type Credit,
	type StoryRecord,
	type StoryTelling
} from '../story-visibility.ts';
import { methods, nations, sources, storyRecords } from './content.ts';
import { formatCaptureDate, formatSource } from './markdown.ts';
import { SourceUses, whereInSource, type CitationMark, type SourceEntry } from './source-uses.ts';

export interface NationReference {
	id: string;
	name: string;
	/** The nation's page, when the site publishes one. */
	link?: string;
}

export interface WebLink {
	href: string;
	host: string;
}

export interface ExcerptView {
	/** The exact words, when the record may quote them. */
	text?: string;
	/** Where in the telling, such as a page or the words it begins with. */
	locator: string;
	/** Who told or published the telling it comes from. */
	credit: string;
	/** Where to read the telling. */
	link?: WebLink;
	/** Citation markers shown beside it, on the story's own page. */
	citations?: CitationMark[];
}

/** One paragraph of a story's full text, or a marker where a passage is left out. */
export type FullTextParagraph = { text: string } | { omitted: string; locator: string };

export interface FullTextView {
	paragraphs: FullTextParagraph[];
	/** Who told or published the telling it comes from. */
	credit: string;
	/** Where in the telling the text runs. */
	locator: string;
	/** Why the whole text may be shown here, in a sentence. */
	basisNote: string;
	/** The copy it was taken from and how it was checked. */
	transcribedFrom: string;
	notes: string[];
	words: number;
	citations: CitationMark[];
}

export interface TellingView {
	id: string;
	credit: string;
	publishedBy?: string;
	teller?: string;
	authority: string;
	date?: string;
	locator?: string;
	link?: WebLink;
	citations: CitationMark[];
}

export interface ProtocolView {
	kind: string;
	statement: string;
	howFollowed?: string;
	citations: CitationMark[];
}

export interface StorySummary {
	id: string;
	title: string;
	kind: string;
	nations: NationReference[];
	community?: string;
	/** The first excerpt the page quotes, if any. */
	excerpt?: ExcerptView;
	awaitsReview: boolean;
}

export interface StoryView extends StorySummary {
	titlesInLanguage: { text: string; language: string; citations: CitationMark[] }[];
	length?: string;
	methods: string[];
	topics: string[];
	/** The whole story in the teller's words, where it may be reproduced (decision record 0034). */
	fullText?: FullTextView;
	/** Excerpts from tellings other than the one shown in full. */
	excerpts: ExcerptView[];
	tellings: TellingView[];
	protocols: ProtocolView[];
	sources: SourceEntry[];
}

function today(): string {
	return isoDate(new Date());
}

/** The stories the site shows, by title. */
export function publishedStories(): StoryRecord[] {
	const date = today();
	return storyRecords()
		.filter((record) => storyIsShown(record, date))
		.sort((first, second) =>
			plainTitle(first.title).localeCompare(plainTitle(second.title), 'en', { sensitivity: 'base' })
		);
}

/** A title without the brackets that mark a description the project wrote, for sorting. */
function plainTitle(title: string): string {
	return title.replace(/^\[/, '');
}

function nationReference(id: string): NationReference {
	const record = nations().find((candidate) => candidate.id === id);
	return record
		? { id, name: record.names.official, link: record.example ? undefined : `/nations/${id}` }
		: { id, name: spaced(id) };
}

function nationName(id: string): string {
	return nationReference(id).name;
}

/** A credit in the form the teller chose (schemas/common.schema.json, credit). */
export function creditText(credit: Credit | undefined, nameOf: (id: string) => string = nationName): string | undefined {
	if (!credit) return undefined;
	switch (credit.form) {
		case 'none':
			return undefined;
		case 'pseudonym':
			return credit.pseudonym;
		case 'role':
			return credit.role;
		default: {
			const parts = [credit.name, credit.role];
			if (credit.form === 'name-and-nation' && credit.nation) parts.push(nameOf(credit.nation));
			return parts.filter(Boolean).join(', ') || undefined;
		}
	}
}

/** "2021-06-02" as "June 2, 2021", "2022-01" as "Jan. 2022", and "2008" as it is. */
export function partialDate(value: string | number | undefined): string | undefined {
	if (value === undefined) return undefined;
	const text = String(value);
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatCaptureDate(text);
	const month = /^(\d{4})-(\d{2})$/.exec(text);
	if (month) {
		const name = formatCaptureDate(`${month[1]}-${month[2]}-01`).split(' ')[0];
		return `${name} ${month[1]}`;
	}
	return text;
}

function webLink(key: string | undefined): WebLink | undefined {
	const record = key ? sources().get(key) : undefined;
	const link = record?.original_link ?? record?.citation.URL;
	if (!link || !URL.canParse(link)) return undefined;
	const url = new URL(link);
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
	return { href: url.href, host: url.hostname.replace(/^www\./, '') };
}

function tellingCredit(telling: StoryTelling | undefined): string {
	if (!telling) return '';
	const teller = creditText(telling.teller);
	return [teller, telling.published_by].filter(Boolean).join(', ') || 'Unattributed';
}

function citationOf(key: string): string {
	return sourceCitations[key] ?? formatSource(sources().get(key), key);
}

function summaryOf(record: StoryRecord, date: string): StorySummary {
	const tellings = new Map(shownTellings(record, date).map((telling) => [telling.id, telling]));
	const first = shownExcerpts(record, date).find((excerpt) => excerpt.quoted);
	const firstTelling = first ? tellings.get(first.telling) : undefined;
	return {
		id: record.id,
		title: record.title,
		kind: labelFor(storyKindLabels, record.kind),
		nations: record.nations.map(nationReference),
		community: record.community,
		excerpt:
			first && firstTelling
				? {
						text: first.text,
						locator: first.locator,
						credit: tellingCredit(firstTelling),
						link: webLink(firstTelling.source)
					}
				: undefined,
		awaitsReview: awaitsNationReview(record)
	};
}

/** Every story the site shows, as the list page needs it. */
export function storySummaries(): StorySummary[] {
	const date = today();
	return publishedStories().map((record) => summaryOf(record, date));
}

/**
 * The stories one nation's page lists, each linked to its own page, by title.
 * A story shared by several nations is listed on each of their pages.
 */
export function nationStorySummaries(nationId: string): StorySummary[] {
	const date = today();
	return storiesOfNation(publishedStories(), nationId, date).map((record) => summaryOf(record, date));
}

/** One story's page. */
export function storyView(record: StoryRecord): StoryView {
	const date = today();
	const tellings = shownTellings(record, date);
	const byId = new Map(tellings.map((telling) => [telling.id, telling]));
	const uses = new SourceUses(citationOf);

	const titlesInLanguage = (record.titles_in_language ?? []).map((title) => {
		const citations: CitationMark[] = [];
		if (title.source) uses.cite(title.source, { section: 'Name in the language', text: title.text }, citations);
		return { text: title.text, language: title.language, citations };
	});

	const shownFull = shownFullText(record, date);
	let fullText: FullTextView | undefined;
	if (shownFull) {
		const telling = byId.get(shownFull.telling);
		const citations: CitationMark[] = [];
		if (telling?.source) {
			uses.cite(telling.source, { section: 'The story', text: 'the full text', where: shownFull.locator }, citations);
		}
		fullText = {
			paragraphs: shownFull.paragraphs.map((paragraph) =>
				typeof paragraph === 'string' ? { text: paragraph } : { omitted: paragraph.omitted, locator: paragraph.locator }
			),
			credit: tellingCredit(telling),
			locator: shownFull.locator,
			basisNote: shownFull.basis_note,
			transcribedFrom: shownFull.transcribed_from,
			notes: shownFull.notes ?? [],
			words: shownFull.words,
			citations
		};
	}

	// The full text already holds every excerpt from its own telling.
	const excerpts = shownExcerpts(record, date)
		.filter((excerpt) => !shownFull || excerpt.telling !== shownFull.telling)
		.map((excerpt) => {
			const telling = byId.get(excerpt.telling);
			const citations: CitationMark[] = [];
			if (telling?.source) {
				uses.cite(
					telling.source,
					{
						section: excerpt.quoted ? 'In the teller’s words' : 'Passages cited, not quoted',
						text: excerpt.quoted ? 'the passage quoted' : 'the passage cited',
						where: excerpt.locator
					},
					citations
				);
			}
			return {
				text: excerpt.quoted ? excerpt.text : undefined,
				locator: excerpt.locator,
				credit: tellingCredit(telling),
				link: webLink(telling?.source),
				citations
			};
		});

	const tellingViews = tellings.map((telling) => {
		const citations: CitationMark[] = [];
		if (telling.source) {
			uses.cite(
				telling.source,
				{ section: 'Tellings', text: tellingCredit(telling), where: whereInSource(telling) },
				citations
			);
		}
		return {
			id: telling.id,
			credit: tellingCredit(telling),
			publishedBy: telling.published_by,
			teller: creditText(telling.teller),
			authority: labelFor(authorityLabels, telling.authority),
			date: partialDate(telling.as_of),
			locator: telling.locator,
			link: webLink(telling.source),
			citations
		};
	});

	const protocols = (record.protocols ?? []).map((protocol) => {
		const kind = labelFor(protocolKindLabels, protocol.kind);
		const citations: CitationMark[] = [];
		uses.cite(protocol.source, { section: 'Cultural protocols', text: kind, where: protocol.locator }, citations);
		return {
			kind,
			statement: protocol.statement,
			howFollowed: protocol.how_the_project_follows_it,
			citations
		};
	});

	return {
		...summaryOf(record, date),
		titlesInLanguage,
		length: record.length ? labelFor(lengthLabels, record.length) : undefined,
		methods: (record.methods ?? []).map((id) => methods().get(id)?.name ?? spaced(id)),
		topics: (record.topics ?? []).map(spaced),
		fullText,
		excerpts,
		tellings: tellingViews,
		protocols,
		sources: uses.list
	};
}

