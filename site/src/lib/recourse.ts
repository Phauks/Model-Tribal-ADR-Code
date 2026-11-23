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

/** The address parameter of each filter, for links from elsewhere on the site. */
export const recourseFacetKeys = recourseFacetRules.map((rule) => rule.key);

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

/** The rows as CSV, with the nation's page and the law's address as links. */
export function recourseCsv(rows: RecourseRow[], origin = ''): string {
	const tableRows: TableRow[] = rows.map((row) => ({
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
	return rowsToCsv(csvColumns, tableRows, origin);
}
