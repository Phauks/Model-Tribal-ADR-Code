/**
 * The Find recourse page's rules, shared by the build and the browser: what
 * one provision row holds, the words for its tags, the filters a reader can
 * use and how the choices go into the page address.
 * src/lib/server/recourse.ts builds the rows.
 *
 * The filters themselves are the site's shared ones (src/lib/search-filters.ts,
 * the same panel as the advanced search): within one filter, choices widen
 * the list (mediation or arbitration); across filters they narrow it
 * (mediation, in family disputes).
 */
import type { BarChartData } from './bar-chart.ts';
import { markAnchor, type CitationMark } from './citation-marks.ts';
import { choicesFromAddress, writeChoices, type Facet, type FilterChoices } from './search-filters.ts';
import { foldForSearch, rowsToCsv, type TableColumn, type TableRow } from './tables/table-definition.ts';

export interface RecourseRow {
	/** The provision's identifier in the research data, such as "navajo-nation#12". */
	id: string;
	nation: { id: string; name: string };
	/** State and territory names. */
	states: string[];
	/** Recognition labels, such as "Federally recognized". Empty when the nation has none to show. */
	recognition: string[];
	/** The method in words, such as "Mediation". */
	method: string;
	/** The kind of dispute in words, such as "Family". */
	subject: string;
	/** Where the process happens, as a key of settingLabels. */
	setting: string;
	/** How a case gets there, as a key of entryLabels. */
	entry: string;
	/** What the result is, as a key of outcomeLabels. */
	outcome: string;
	/** The provision's citation as the nation publishes its law. */
	citation: string;
	/** The name of the law the provision is in, when the research names it. */
	document?: string;
	/** One or two sentences on what the provision does, written for the project. */
	summary: string;
	/** The site's own copy of the law, or the original address when there is none. */
	link?: string;
	/** The address the law was found at. */
	original?: string;
	/** Whether a second reader has checked the row. */
	checked: boolean;
}

/** How many rows the page shows at first, and adds each time the reader asks for more. */
export const recoursePageSize = 25;

export const settingLabels: Record<string, string> = {
	'court-annexed': 'Run by the court',
	'court-referral': 'The court refers the case',
	'agency-or-government': 'A government office or agency',
	'contract-or-compact': 'Set by a contract or compact',
	'pre-filing': 'Before a case is filed',
	'community-program': 'A community program',
	other: 'Other'
};

export const entryLabels: Record<string, string> = {
	'consent-of-parties': 'Both sides agree',
	'court-discretion': 'The court decides',
	mandatory: 'Required',
	voluntary: 'Voluntary',
	'not-stated': 'Not stated'
};

export const outcomeLabels: Record<string, string> = {
	binding: 'Binding',
	'binding-if-agreed': 'Binding once both sides agree',
	'non-binding': 'Not binding',
	recommendation: 'A recommendation',
	'not-stated': 'Not stated'
};

/** Recognition kinds the filter offers. A nation without federal recognition gets no label (Trevor, Nov. 23, 2026). */
const recognitionFacetKinds = ['federal', 'state', 'petitioning', 'congressional-special-relationship', 'territorial-law'];

/** The recognition kinds of a nation that the filter lists, in a fixed order. */
export function recognitionFacetValues(types: string[]): string[] {
	return recognitionFacetKinds.filter((kind) => types.includes(kind));
}

interface RecourseFacetRule {
	key: string;
	label: string;
	valuesOf: (row: RecourseRow) => string[];
	/** The words for a value; the value itself when left out. */
	words?: (value: string) => string;
	/** Lists answers by how many provisions have them, largest first, rather than in reading order. */
	byCount?: boolean;
	long?: boolean;
}

const recourseFacetRules: RecourseFacetRule[] = [
	{ key: 'method', label: 'Method', valuesOf: (row) => [row.method], byCount: true },
	{ key: 'subject', label: 'Kind of dispute', valuesOf: (row) => [row.subject], byCount: true },
	{ key: 'setting', label: 'Where it happens', valuesOf: (row) => [row.setting], words: (value) => settingLabels[value] ?? value, byCount: true },
	{ key: 'entry', label: 'How it starts', valuesOf: (row) => [row.entry], words: (value) => entryLabels[value] ?? value, byCount: true },
	{ key: 'outcome', label: 'Result', valuesOf: (row) => [row.outcome], words: (value) => outcomeLabels[value] ?? value, byCount: true },
	{ key: 'state', label: 'State or territory', valuesOf: (row) => row.states, long: true },
	{ key: 'recognition', label: 'Recognition', valuesOf: (row) => row.recognition, byCount: true },
	{
		key: 'checked',
		label: 'Checking',
		valuesOf: (row) => [row.checked ? 'checked' : 'once'],
		words: (value) => (value === 'checked' ? 'Checked by a second reader' : 'Read once'),
		byCount: true
	}
];

const textCollator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * The filters for the shared filter panel (src/lib/search-filters.ts), with
 * the answers the rows hold. Answers come in a fixed order, so one set of
 * choices always makes one page address: by how many provisions have them,
 * largest first, or in reading order for the states.
 */
export function recourseFacets(rows: readonly RecourseRow[]): Facet<RecourseRow>[] {
	return recourseFacetRules.map((rule) => {
		const words = rule.words ?? ((value: string) => value);
		const counts = new Map<string, number>();
		for (const row of rows) for (const value of new Set(rule.valuesOf(row))) counts.set(value, (counts.get(value) ?? 0) + 1);
		const options = [...counts]
			.sort(
				(first, second) =>
					(rule.byCount ? second[1] - first[1] : 0) || textCollator.compare(words(first[0]), words(second[0]))
			)
			.map(([value]) => ({ value, label: words(value) }));
		return { key: rule.key, label: rule.label, options, valuesOf: rule.valuesOf, long: rule.long };
	});
}

/** The reader's choices: search words and the ticked answers. */
export interface RecourseQuery {
	text: string;
	choices: FilterChoices;
}

function searchWords(text: string): string[] {
	return foldForSearch(text).split(/\s+/).filter(Boolean);
}

/** The rows whose nation, citation, summary, method or kind of dispute hold every search word, ignoring case and accents. */
export function rowsWithWords(rows: readonly RecourseRow[], text: string): RecourseRow[] {
	const words = searchWords(text);
	if (words.length === 0) return [...rows];
	return rows.filter((row) => {
		const haystack = foldForSearch([row.nation.name, row.citation, row.summary, row.method, row.subject].join(' '));
		return words.every((word) => haystack.includes(word));
	});
}

/** The reader's choices as page address parameters: "q" for the words, then one parameter per ticked answer. */
export function recourseAddress(query: RecourseQuery, facets: readonly Facet<RecourseRow>[]): URLSearchParams {
	const parameters = new URLSearchParams();
	if (query.text.trim() !== '') parameters.set('q', query.text.trim());
	writeChoices(parameters, facets, query.choices);
	return parameters;
}

/** Reads the choices back from the page address; unknown parameters and answers are ignored. */
export function recourseQueryFromAddress(
	parameters: URLSearchParams,
	facets: readonly Facet<RecourseRow>[]
): RecourseQuery {
	return { text: parameters.get('q') ?? '', choices: choicesFromAddress(parameters, facets) };
}

/** A link to Find recourse with one answer ticked, such as the provisions for one method. */
export function recourseLink(key: string, value: string): string {
	return `/nations/recourse?${new URLSearchParams([[key, value]]).toString()}`;
}

/** The ticked answers of one filter, for the one chip that removes them all: "Kind of dispute: Family, Child welfare". */
export interface RecourseChip {
	key: string;
	label: string;
	answers: string[];
}

/** One chip for each filter in use, in the filters' order, as the approved mockup groups them (design/data-views). */
export function recourseChips(facets: readonly Facet<RecourseRow>[], choices: FilterChoices): RecourseChip[] {
	return facets.flatMap((facet) => {
		const chosen = new Set(choices[facet.key] ?? []);
		const answers = facet.options.filter((option) => chosen.has(option.value)).map((option) => option.label);
		return answers.length > 0 ? [{ key: facet.key, label: facet.label, answers }] : [];
	});
}

/** The parts of a provision a reader can show or hide with Columns, in the order a result shows them. The nation always shows. */
export const recourseParts = [
	{ key: 'states', label: 'State' },
	{ key: 'citation', label: 'Citation' },
	{ key: 'summary', label: 'What it does' },
	{ key: 'method', label: 'Method' },
	{ key: 'subject', label: 'Kind of dispute' },
	{ key: 'setting', label: 'Where it happens' },
	{ key: 'entry', label: 'How it starts' },
	{ key: 'outcome', label: 'Result' }
] as const;

export type RecoursePart = (typeof recourseParts)[number]['key'];

/** A law the provisions shown are cited to, numbered for the Sources list under the results. */
export interface RecourseSource {
	number: number;
	/** The site's copy of the law, or where it was found. */
	href?: string;
	nation: string;
	/** The law's name, or the first provision's citation when the research does not name the law. */
	title: string;
	/** The ids of the markers that cite it, in list order, which the Sources list links back to. */
	backlinks: string[];
}

/**
 * The laws behind the provisions shown, each once, numbered in the order the list first cites them, and each provision's marker, so every citation carries its source marker as the approved mockup has it (design/data-views; site/DESIGN.md, "Every count opens to its records").
 */
export function recourseSources(rows: readonly RecourseRow[]): { sources: RecourseSource[]; marks: Map<string, CitationMark> } {
	const byLaw = new Map<string, RecourseSource>();
	const marks = new Map<string, CitationMark>();
	for (const row of rows) {
		const law = row.original ?? row.link ?? `${row.nation.id}#${row.document ?? row.citation}`;
		let source = byLaw.get(law);
		if (!source) {
			source = { number: byLaw.size + 1, href: row.link ?? row.original, nation: row.nation.name, title: row.document || row.citation, backlinks: [] };
			byLaw.set(law, source);
		}
		const anchor = markAnchor(source.number, source.backlinks.length + 1);
		source.backlinks.push(anchor);
		marks.set(row.id, { number: source.number, anchor });
	}
	return { sources: [...byLaw.values()], marks };
}

/** What Show as chart can count the provisions by, in the order it tries them. */
const chartGroupings: { key: string; title: string; header: string; partsOfWhole: boolean }[] = [
	{ key: 'method', title: 'by method', header: 'Method', partsOfWhole: true },
	{ key: 'subject', title: 'by kind of dispute', header: 'Kind of dispute', partsOfWhole: true },
	{ key: 'state', title: 'by state or territory', header: 'State or territory', partsOfWhole: false },
	{ key: 'setting', title: 'by where it happens', header: 'Where it happens', partsOfWhole: true },
	{ key: 'entry', title: 'by how it starts', header: 'How it starts', partsOfWhole: true },
	{ key: 'outcome', title: 'by result', header: 'Result', partsOfWhole: true }
];

/**
 * The provisions shown, as a bar chart for Show as chart (approved mockup, design/data-views): counted by method, or, once a single method is chosen, by the first of kind of dispute, state, setting, how it starts and result that still splits them. Each bar leads to the same list narrowed to it (link gives the address).
 */
export function recourseChart(
	rows: readonly RecourseRow[],
	facets: readonly Facet<RecourseRow>[],
	link: (key: string, value: string) => string
): BarChartData {
	const facetOf = new Map(facets.map((facet) => [facet.key, facet]));
	const countsOf = (key: string) => {
		const facet = facetOf.get(key);
		const counts = new Map<string, number>();
		if (facet) for (const row of rows) for (const value of new Set(facet.valuesOf(row))) counts.set(value, (counts.get(value) ?? 0) + 1);
		return counts;
	};
	const grouping = chartGroupings.find((candidate) => countsOf(candidate.key).size > 1) ?? chartGroupings[0];
	const facet = facetOf.get(grouping.key);
	const words = new Map(facet?.options.map((option) => [option.value, option.label]) ?? []);
	const bars = [...countsOf(grouping.key)]
		.sort((first, second) => second[1] - first[1] || textCollator.compare(words.get(first[0]) ?? first[0], words.get(second[0]) ?? second[0]))
		.map(([value, count]) => ({ label: words.get(value) ?? value, value: count, href: link(grouping.key, value) }));
	return {
		identifier: 'recourse-chart',
		title: `Provisions ${grouping.title}`,
		description: '',
		labelHeader: grouping.header,
		valueHeader: 'Provisions',
		source: 'Dispute resolution provisions read from each nation’s published law',
		bars,
		partsOfWhole: grouping.partsOfWhole
	};
}

const csvColumns: TableColumn[] = [
	{ key: 'nation', header: 'Nation' },
	{ key: 'states', header: 'States' },
	{ key: 'citation', header: 'Citation' },
	{ key: 'method', header: 'Method' },
	{ key: 'subject', header: 'Kind of dispute' },
	{ key: 'setting', header: 'Where it happens' },
	{ key: 'entry', header: 'How it starts' },
	{ key: 'outcome', header: 'Result' },
	{ key: 'summary', header: 'What it does' },
	{ key: 'checked', header: 'Checked by a second reader' },
	{ key: 'law', header: 'Law' }
];

/** The columns each part shown adds to a download; the nation, the checking and the law's address always come. */
const partColumns: Record<RecoursePart, string[]> = {
	states: ['states'],
	citation: ['citation'],
	summary: ['summary'],
	method: ['method'],
	subject: ['subject'],
	setting: ['setting'],
	entry: ['entry'],
	outcome: ['outcome']
};

/** The rows as a table, for the .csv and .xlsx downloads: the parts the reader shows (every part by default). */
export function recourseTable(rows: RecourseRow[], shown: readonly RecoursePart[] = recourseParts.map((part) => part.key)): { columns: TableColumn[]; rows: TableRow[] } {
	const kept = new Set(['nation', 'checked', 'law', ...shown.flatMap((part) => partColumns[part])]);
	return { columns: csvColumns.filter((column) => kept.has(column.key)), rows: tableRowsOf(rows) };
}

/** The rows as CSV, with the nation's page and the law's address as links. */
export function recourseCsv(rows: RecourseRow[], origin = ''): string {
	return rowsToCsv(csvColumns, tableRowsOf(rows), origin);
}

function tableRowsOf(rows: RecourseRow[]): TableRow[] {
	return rows.map((row) => ({
		key: row.id,
		cells: {
			nation: { text: row.nation.name, href: `/nations/${row.nation.id}` },
			states: { text: row.states.join('; ') },
			citation: { text: row.citation },
			method: { text: row.method },
			subject: { text: row.subject },
			setting: { text: settingLabels[row.setting] ?? row.setting },
			entry: { text: entryLabels[row.entry] ?? row.entry },
			outcome: { text: outcomeLabels[row.outcome] ?? row.outcome },
			summary: { text: row.summary },
			checked: { text: row.checked ? 'Yes' : 'No' },
			law: { text: row.original ?? '' }
		}
	}));
}
