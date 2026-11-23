/**
 * The glossary as the website shows it: one data source for the glossary
 * page, each entry's own page and /glossary/terms.json, which the hover cards
 * on glossary links read. Built from content/glossary/*.yaml
 * (docs/terminology.md) when the site is built.
 *
 * Citations follow the nation pages (site/DESIGN.md, section 6, "Citations"):
 * a numbered marker in the text, and the citation itself, in the project's
 * Indigo Book style, in one Sources section at the end of the page, which
 * links back to each marker and names every entry the source supports.
 */
import { sourceCitations } from 'virtual:source-citations';
import { usageLabels } from '../glossary-labels.ts';
import { glossary, sources, type GlossaryRecord } from './content.ts';
import { formatSource, plainText, renderMarkdown, type CitationCollector } from './markdown.ts';
import { SourceUses, type CitationMark, type SourceEntry } from './source-uses.ts';

/** Another entry, named by its headword. */
export interface TermReference {
	id: string;
	term: string;
}

/** One sense of an entry, ready to show. */
export interface GlossarySense {
	/** A label that applies to this sense only, such as "often capitalized". */
	label?: string;
	/** The sense as HTML, with term links and numbered source markers. */
	definition: string;
}

/** One entry, ready to show. */
export interface GlossaryEntryView {
	id: string;
	term: string;
	kind: GlossaryRecord['kind'];
	expansion?: string;
	usage: GlossaryRecord['usage'];
	usageLabel: string;
	basis?: GlossaryRecord['basis'];
	status: NonNullable<GlossaryRecord['status']>;
	aliases: string[];
	/** The part of speech or class shown in italics after the headword, such as "noun" or "abbreviation". */
	functionalLabel: string;
	/** The definition as HTML, with term links and numbered source markers. */
	definition: string;
	/** Every sense, the definition first; each is numbered on the page. */
	senses: GlossarySense[];
	/** The model code section that enacts a definition of the term, when one does, such as "§ 1-102". */
	codeDefinition?: string;
	/** "As used here", as HTML, when the entry has a usage note. */
	usageNote?: string;
	useInstead: TermReference[];
	seeAlso: TermReference[];
}

/** One entry as /glossary/terms.json lists it, for hover cards and other scripts. */
export interface GlossaryTermSummary {
	id: string;
	term: string;
	expansion?: string;
	usage: GlossaryRecord['usage'];
	usageLabel: string;
	/** The definition's first sentence or two, as plain text with no citations or links. */
	summary: string;
	/** The entry's own page. */
	page: string;
	/** The entry on the glossary page. */
	anchor: string;
}

/** The entries the site publishes, in alphabetical order: every one not retired. */
export function publishedGlossary(): GlossaryRecord[] {
	return glossary().filter((entry) => entry.status !== 'retired' && !entry.redirect_to);
}

function termReferences(ids: string[] | undefined): TermReference[] {
	const all = glossary();
	return (ids ?? []).map((id) => ({
		id,
		term: all.find((entry) => entry.id === id)?.term ?? id
	}));
}

/** The citation of a source, in the Indigo Book style where the build formatted one. */
function citationOf(key: string): string {
	return sourceCitations[key] ?? formatSource(sources().get(key), key);
}

/** Numbers each source on the page and records which entry, and which part of it, the source supports. */
class GlossaryCitations implements CitationCollector {
	readonly uses = new SourceUses(citationOf);
	part = { term: '', text: '' };

	cite(key: string, locator?: string): CitationMark {
		// A subdivision of a code section, such as "(d)", reads as "subsection (d)".
		const where = locator?.startsWith('(') ? `subsection ${locator}` : locator;
		return this.uses.cite(key, { section: this.part.term, text: this.part.text, where });
	}
}

/** A provision's display number from its id: 01-102 is § 1-102 (schemas/provision.schema.json). */
export function sectionNumberOf(provision: string): string {
	const [chapter, section] = provision.split('-');
	return `§ ${Number(chapter)}-${section}`;
}

/** The italic label after the headword, as a dictionary gives one: the part of speech, or the kind of entry. */
export function functionalLabelOf(record: GlossaryRecord): string {
	if (record.kind === 'acronym') return 'abbreviation';
	if (record.kind === 'phrase') return 'phrase';
	const partOfSpeech = record.part_of_speech ?? 'noun';
	return record.kind === 'legal-term' ? `${partOfSpeech}, legal term` : partOfSpeech;
}

/**
 * The given entries, rendered, and the Sources section for a page that shows
 * them all. A source the entry lists but its text does not cite is still
 * listed, under the entry, so every listed source appears.
 */
export function glossaryEntryViews(records: GlossaryRecord[]): {
	entries: GlossaryEntryView[];
	sources: SourceEntry[];
} {
	const citations = new GlossaryCitations();
	const entries = records.map((record): GlossaryEntryView => {
		citations.part = { term: record.term, text: 'definition' };
		const definition = renderMarkdown(record.definition, citations);
		const otherSenses = (record.other_senses ?? []).map((sense, index) => {
			citations.part = { term: record.term, text: `sense ${index + 2}` };
			return { label: sense.label, definition: renderMarkdown(sense.definition, citations) };
		});
		citations.part = { term: record.term, text: 'as used here' };
		const usageNote = record.usage_note ? renderMarkdown(record.usage_note, citations) : undefined;
		const citedInText = [
			record.definition,
			...(record.other_senses ?? []).map((sense) => sense.definition),
			record.usage_note ?? ''
		].join(' ');
		for (const key of record.sources ?? []) {
			if (!new RegExp(`@${key}(?![a-z0-9-])`).test(citedInText)) {
				citations.uses.add(key, {
					section: record.term,
					text: 'listed as a source'
				});
			}
		}
		return {
			id: record.id,
			term: record.term,
			kind: record.kind,
			expansion: record.expansion,
			usage: record.usage,
			usageLabel: usageLabels[record.usage] ?? record.usage,
			basis: record.basis,
			status: record.status ?? 'draft',
			aliases: (record.aliases ?? []).filter((form) => form !== record.term),
			functionalLabel: functionalLabelOf(record),
			definition,
			senses: [{ definition }, ...otherSenses],
			codeDefinition: record.code_definition ? sectionNumberOf(record.code_definition) : undefined,
			usageNote,
			useInstead: termReferences(record.use_instead),
			seeAlso: termReferences(record.see_also)
		};
	});
	return { entries, sources: citations.uses.list };
}

/** Abbreviations whose full stop does not end a sentence. */
const abbreviations =
	/(?:^|\s)(?:U\.S|e\.g|i\.e|p|pp|No|Nos|St|Dept|Inc|Co|Mr|Ms|Dr|Jr|Sr|v|vs)\.$/;

/**
 * The first sentence of a definition, or the first two when the first is
 * short, as plain text: the summary a hover card shows. The card links to the
 * full entry, so nothing here needs a citation.
 */
export function summaryOf(definition: string): string {
	const text = plainText(definition);
	const sentences: string[] = [];
	let start = 0;
	for (const match of text.matchAll(/[.!?]["”’)]?(?=\s+["“(A-Z])/g)) {
		const end = (match.index ?? 0) + match[0].length;
		if (abbreviations.test(text.slice(start, (match.index ?? 0) + 1))) continue;
		sentences.push(text.slice(start, end).trim());
		start = end;
	}
	if (start < text.length) sentences.push(text.slice(start).trim());

	let summary = sentences[0] ?? '';
	if (summary.length < 90 && sentences[1]) summary = `${summary} ${sentences[1]}`;
	if (summary.length > 320) {
		summary = `${summary.slice(0, 320).replace(/\s+\S*$/, '')}…`;
	}
	return summary;
}

/** Every published entry as /glossary/terms.json lists it. */
export function glossaryTermSummaries(): GlossaryTermSummary[] {
	return publishedGlossary().map((record) => ({
		id: record.id,
		term: record.term,
		...(record.expansion ? { expansion: record.expansion } : {}),
		usage: record.usage,
		usageLabel: usageLabels[record.usage] ?? record.usage,
		summary: summaryOf(record.definition),
		page: `/glossary/${record.id}`,
		anchor: `/glossary#${record.id}`
	}));
}

/** The other entries whose text links to this one. */
export function entriesLinkingTo(id: string): TermReference[] {
	const link = new RegExp(`\\[\\[${id}(?:\\||\\]\\])`);
	return publishedGlossary()
		.filter((record) => record.id !== id)
		.filter((record) =>
			link.test(
				[record.definition, ...(record.other_senses ?? []).map((sense) => sense.definition), record.usage_note ?? ''].join(' ')
			)
		)
		.map((record) => ({ id: record.id, term: record.term }));
}

