/**
 * One way to browse a large collection of federal documents, such as the
 * executive orders: a table grouped by President, decade or year, with
 * filters in the side column that move only within the collection (Trevor,
 * Nov. 27, 2026: "the left sidebar should be used for navigation within the
 * section you are in"; design/federal-navigation, mockups C2-*.png). Trevor
 * asked for it to be built so the other Federal collections can use it too,
 * so everything here is driven by a collection's definition
 * (src/lib/server/browse-collections.ts) and knows nothing of executive orders.
 *
 * The reader's choices live in the page's address (?president=…&group=decade),
 * so the page is drawn by the Worker with them already applied, works without
 * scripts, and any view can be shared. The functions are pure, for the tests.
 */

/** One filter in the side column, such as President. */
export interface BrowseFacet {
	/** Its name in the address, such as "president". */
	key: string;
	label: string;
	/** Its values most numerous first, newest first (values that sort as text, such as "1930s"), or in the order `values` lists them. */
	order: 'count' | 'newest' | 'given';
	/** How many values show before "N more". */
	shown: number;
	/** Every value's name, by its address form, such as "franklin-d-roosevelt" → "Franklin D. Roosevelt". */
	values: Record<string, string>;
	/** A value's name for one item, in the table, where it differs: "Proclamations" is "Proclamation" in a row. */
	single?: Record<string, string>;
	/** When an item's own value of this filter makes its default list (an order's President), for previous and next. */
	itemList?: boolean;
}

/** A way to group the table, such as by President. */
export interface BrowseGrouping {
	key: string;
	label: string;
	/** The filter whose value names each group; none groups by year. */
	facet?: string;
	/** The filter whose values a group lists after its count, such as a decade's Presidents; without it, a group named by a filter gives its years. */
	detail?: string;
}

/** A column of the table besides the title, such as the number, the date or a filter's value. */
export interface BrowseColumn {
	key: 'number' | 'date' | string;
	label: string;
	/** Left out on phones. */
	wide?: boolean;
}

/** One item, as small as it can be: the built data of a large collection is read whole. */
export interface BrowseItem {
	key: string;
	title: string;
	/** Its number, such as an executive order's "6145". */
	number?: string;
	/** YYYY, YYYY-MM or YYYY-MM-DD. */
	date?: string;
	/** Its value of each filter, by the filter's key, in address form. */
	values: Record<string, string[]>;
}

export interface BrowseCollection {
	identifier: string;
	title: string;
	/** Its own page, such as /laws/executive-orders. */
	path: string;
	/** Where an item's page is, from its key. */
	itemPath: string;
	/** What the collection holds, read under its title. */
	lead: string;
	/** What one item is called, for the find box: "order". */
	itemName: string;
	/** A hint of what the find box takes. */
	findHint: string;
	/** The section above it, for the breadcrumbs. */
	section: { label: string; href: string };
	facets: BrowseFacet[];
	groupings: BrowseGrouping[];
	defaultGroup: string;
	columns: BrowseColumn[];
	items: BrowseItem[];
	/** Rows drawn before "Show more", so a collection of thousands stays light. */
	pageSize: number;
}

export type Choices = {
	/** Chosen values by filter. */
	filters: Record<string, string[]>;
	group: string;
	sort: 'newest' | 'oldest';
	find: string;
	/** Filters showing all their values. */
	more: string[];
	/** Rows drawn. */
	show: number;
};

const sortParameter = 'sort';
const groupParameter = 'group';
const findParameter = 'q';
const moreParameter = 'more';
const showParameter = 'show';

/** The reader's choices, read from the page's address; unknown values are left out. */
export function choicesOf(collection: BrowseCollection, parameters: URLSearchParams): Choices {
	const filters: Record<string, string[]> = {};
	for (const facet of collection.facets) {
		const chosen = parameters.getAll(facet.key).filter((value) => value in facet.values);
		if (chosen.length > 0) filters[facet.key] = [...new Set(chosen)];
	}
	const group = parameters.get(groupParameter);
	const show = Number(parameters.get(showParameter));
	return {
		filters,
		group: collection.groupings.some((grouping) => grouping.key === group) || group === 'none' ? group! : collection.defaultGroup,
		sort: parameters.get(sortParameter) === 'oldest' ? 'oldest' : 'newest',
		find: (parameters.get(findParameter) ?? '').trim(),
		more: parameters.getAll(moreParameter).filter((key) => collection.facets.some((facet) => facet.key === key)),
		show: Number.isInteger(show) && show > collection.pageSize ? show : collection.pageSize
	};
}

/** The address of a set of choices, with only what differs from the default view. */
export function addressOf(collection: BrowseCollection, choices: Choices, path = collection.path): string {
	const parameters = new URLSearchParams();
	for (const facet of collection.facets) for (const value of choices.filters[facet.key] ?? []) parameters.append(facet.key, value);
	if (choices.find) parameters.set(findParameter, choices.find);
	if (choices.group !== collection.defaultGroup) parameters.set(groupParameter, choices.group);
	if (choices.sort !== 'newest') parameters.set(sortParameter, choices.sort);
	for (const key of choices.more) parameters.append(moreParameter, key);
	if (choices.show !== collection.pageSize) parameters.set(showParameter, String(choices.show));
	const query = parameters.toString();
	return query ? `${path}?${query}` : path;
}

/** The choices that pick a list, without how it is shown: what an item's page carries for previous and next. */
function listChoices(collection: BrowseCollection, choices: Choices): Choices {
	return { ...choices, group: collection.defaultGroup, more: [], show: collection.pageSize };
}

/** The words of a find, each of which an item's title or number must hold. */
function findWords(find: string): string[] {
	return find.toLocaleLowerCase('en-US').split(/\s+/).filter(Boolean);
}

function matchesFind(item: BrowseItem, words: string[]): boolean {
	if (words.length === 0) return true;
	const text = `${item.number ?? ''} ${item.title}`.toLocaleLowerCase('en-US');
	return words.every((word) => text.includes(word));
}

/** Whether an item has one of the chosen values of every filter, leaving one filter out when counting that filter's values. */
function matchesFilters(item: BrowseItem, filters: Record<string, string[]>, except?: string): boolean {
	for (const [key, chosen] of Object.entries(filters)) {
		if (key === except) continue;
		const values = item.values[key] ?? [];
		if (!chosen.some((value) => values.includes(value))) return false;
	}
	return true;
}

/** Items in date order, newest or oldest first; undated ones last. */
function sorted(items: BrowseItem[], sort: Choices['sort']): BrowseItem[] {
	return [...items].sort((first, second) => {
		if (!first.date || !second.date) return first.date ? -1 : second.date ? 1 : first.title.localeCompare(second.title);
		const order = first.date.localeCompare(second.date) || (first.number ?? '').localeCompare(second.number ?? '', 'en-US', { numeric: true });
		return sort === 'newest' ? -order : order;
	});
}

/** The items a set of choices lists, in order. */
export function listed(collection: BrowseCollection, choices: Choices): BrowseItem[] {
	const words = findWords(choices.find);
	return sorted(
		collection.items.filter((item) => matchesFilters(item, choices.filters) && matchesFind(item, words)),
		choices.sort
	);
}

export interface FacetOption {
	value: string;
	label: string;
	count: number;
	chosen: boolean;
	/** The address with this value chosen or no longer chosen. */
	href: string;
}

export interface FacetView {
	key: string;
	label: string;
	options: FacetOption[];
	/** "22 more", and the address showing them all. */
	more?: { label: string; href: string };
	/** The address showing only the first few again. */
	fewer?: string;
}

export interface BrowseRow {
	key: string;
	href: string;
	title: string;
	number?: string;
	date?: string;
	/** Each column's text, by the column's key. */
	cells: Record<string, string>;
}

export interface BrowseGroup {
	label: string;
	count: number;
	/** The years it covers, or the names in it, read after its count. */
	detail?: string;
	rows: BrowseRow[];
}

export interface BrowseView {
	identifier: string;
	title: string;
	path: string;
	lead: string;
	years?: string;
	itemName: string;
	findHint: string;
	find: string;
	total: number;
	shown: number;
	facets: FacetView[];
	/** The chosen values, each with the address that drops it. */
	chips: { label: string; href: string }[];
	clear?: string;
	groupings: { key: string; label: string; href: string; chosen: boolean }[];
	sorts: { key: Choices['sort']; label: string; href: string; chosen: boolean }[];
	columns: BrowseColumn[];
	groups: BrowseGroup[];
	/** The rows left after the page's first ones, and the address that draws them. */
	more?: { label: string; href: string };
	/** What one chosen value names, for the breadcrumbs: "Franklin D. Roosevelt". */
	focus?: string;
	/** The hidden fields that keep the reader's choices when they find something. */
	kept: { name: string; value: string }[];
}

function yearsOf(items: BrowseItem[]): string | undefined {
	const years = items.flatMap((item) => (item.date ? [Number(item.date.slice(0, 4))] : []));
	if (years.length === 0) return undefined;
	const first = Math.min(...years);
	const last = Math.max(...years);
	return first === last ? String(first) : `${first}–${last}`;
}

/** The value of one filter that the choices name alone, when exactly one is chosen in all. */
function focusOf(collection: BrowseCollection, choices: Choices): { facet: BrowseFacet; value: string } | undefined {
	const chosen = Object.entries(choices.filters).flatMap(([key, values]) => values.map((value) => ({ key, value })));
	if (chosen.length !== 1) return undefined;
	const facet = collection.facets.find((candidate) => candidate.key === chosen[0].key);
	return facet ? { facet, value: chosen[0].value } : undefined;
}

/** What a group says after its count: the names of one filter's values in it, such as a decade's Presidents, or the years it covers. */
function groupDetail(collection: BrowseCollection, grouping: BrowseGrouping | undefined, members: BrowseItem[]): string | undefined {
	if (!grouping) return undefined;
	if (grouping.detail) {
		const facet = collection.facets.find((candidate) => candidate.key === grouping.detail);
		const names = [...new Set(members.flatMap((item) => item.values[grouping.detail!] ?? []))].map((value) => facet?.values[value] ?? value);
		return names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', ') || undefined;
	}
	return grouping.facet ? yearsOf(members) : undefined;
}

/** A row's text in one column. */
function cellOf(collection: BrowseCollection, item: BrowseItem, column: BrowseColumn): string {
	if (column.key === 'number') return item.number ?? '';
	if (column.key === 'date') return item.date ?? '';
	const facet = collection.facets.find((candidate) => candidate.key === column.key);
	return (item.values[column.key] ?? []).map((value) => facet?.single?.[value] ?? facet?.values[value] ?? value).join('; ');
}

/** An item's address on its own page, carrying the list it was found in. */
export function itemHref(collection: BrowseCollection, key: string, choices?: Choices): string {
	const path = `${collection.itemPath}/${encodeURIComponent(key)}`;
	return choices ? addressOf(collection, listChoices(collection, choices), path) : path;
}

/** What the reader sees: the filters with their counts, the chosen ones, and the table in its groups. */
export function browseView(collection: BrowseCollection, parameters: URLSearchParams): BrowseView {
	const choices = choicesOf(collection, parameters);
	const words = findWords(choices.find);
	const found = collection.items.filter((item) => matchesFind(item, words));
	const list = listed(collection, choices);
	const with_ = (change: Partial<Choices>) => addressOf(collection, { ...choices, show: collection.pageSize, ...change });

	const facets: FacetView[] = collection.facets.map((facet) => {
		// A value's count is what choosing it would list, with the other filters as they are.
		const counts = new Map<string, number>();
		for (const item of found) {
			if (!matchesFilters(item, choices.filters, facet.key)) continue;
			for (const value of item.values[facet.key] ?? []) counts.set(value, (counts.get(value) ?? 0) + 1);
		}
		const chosen = choices.filters[facet.key] ?? [];
		const values = Object.keys(facet.values).filter((value) => counts.has(value) || chosen.includes(value));
		if (facet.order === 'count') values.sort((first, second) => (counts.get(second) ?? 0) - (counts.get(first) ?? 0) || facet.values[first].localeCompare(facet.values[second]));
		else if (facet.order === 'newest') values.sort((first, second) => second.localeCompare(first));
		const options = values.map((value) => {
			const isChosen = chosen.includes(value);
			const next = isChosen ? chosen.filter((other) => other !== value) : [...chosen, value];
			return { value, label: facet.values[value], count: counts.get(value) ?? 0, chosen: isChosen, href: with_({ filters: { ...choices.filters, [facet.key]: next } }) };
		});
		const showAll = choices.more.includes(facet.key);
		// Chosen values always show, even past the first few.
		const shown = showAll ? options : options.filter((option, index) => index < facet.shown || option.chosen);
		const hidden = options.length - shown.length;
		return {
			key: facet.key,
			label: facet.label,
			options: shown,
			more: hidden > 0 ? { label: `${hidden.toLocaleString('en-US')} more`, href: with_({ more: [...choices.more, facet.key] }) } : undefined,
			fewer: showAll && options.length > facet.shown ? with_({ more: choices.more.filter((key) => key !== facet.key) }) : undefined
		};
	});

	const chips = collection.facets.flatMap((facet) =>
		(choices.filters[facet.key] ?? []).map((value) => ({
			label: facet.values[value],
			href: with_({ filters: { ...choices.filters, [facet.key]: (choices.filters[facet.key] ?? []).filter((other) => other !== value) } })
		}))
	);
	if (choices.find) chips.push({ label: `“${choices.find}”`, href: with_({ find: '' }) });

	// A filter whose one value every row shares, or the groups already name, is left out of the table.
	const focus = focusOf(collection, choices);
	const grouping = collection.groupings.find((candidate) => candidate.key === choices.group);
	const columns = collection.columns.filter((column) => column.key !== grouping?.facet && column.key !== focus?.facet.key);

	const drawn = list.slice(0, choices.show);
	const groups: BrowseGroup[] = [];
	const nameOf = (item: BrowseItem): string => {
		if (!grouping) return '';
		if (!grouping.facet) return item.date?.slice(0, 4) ?? 'Undated';
		const facet = collection.facets.find((candidate) => candidate.key === grouping.facet);
		return (item.values[grouping.facet] ?? []).map((value) => facet?.values[value] ?? value).join('; ') || 'None';
	};
	// Groups are runs of rows in date order, so a President who served twice has a group for each term.
	for (let start = 0; start < list.length; ) {
		const name = nameOf(list[start]);
		let end = start;
		while (end < list.length && nameOf(list[end]) === name) end++;
		const members = list.slice(start, end);
		const rows = members
			.filter((item) => drawn.includes(item))
			.map((item) => ({
				key: item.key,
				href: itemHref(collection, item.key, choices),
				title: item.title,
				number: item.number,
				date: item.date,
				cells: Object.fromEntries(columns.map((column) => [column.key, cellOf(collection, item, column)]))
			}));
		if (rows.length > 0) groups.push({ label: name, count: members.length, detail: groupDetail(collection, grouping, members), rows });
		start = end;
	}

	const left = list.length - drawn.length;
	const kept: { name: string; value: string }[] = [];
	for (const [key, values] of Object.entries(choices.filters)) for (const value of values) kept.push({ name: key, value });
	if (choices.group !== collection.defaultGroup) kept.push({ name: groupParameter, value: choices.group });
	if (choices.sort !== 'newest') kept.push({ name: sortParameter, value: choices.sort });

	return {
		identifier: collection.identifier,
		title: collection.title,
		path: collection.path,
		lead: collection.lead,
		years: yearsOf(collection.items),
		itemName: collection.itemName,
		findHint: collection.findHint,
		find: choices.find,
		total: collection.items.length,
		shown: list.length,
		facets,
		chips,
		clear: chips.length > 0 ? addressOf(collection, { ...choices, filters: {}, find: '', show: collection.pageSize }) : undefined,
		groupings: [...collection.groupings, { key: 'none', label: 'None' }].map((candidate) => ({
			key: candidate.key,
			label: candidate.label,
			href: with_({ group: candidate.key }),
			chosen: candidate.key === choices.group
		})),
		sorts: (['newest', 'oldest'] as const).map((key) => ({ key, label: key === 'newest' ? 'Newest first' : 'Oldest first', href: with_({ sort: key }), chosen: key === choices.sort })),
		columns,
		groups,
		more: left > 0 ? { label: `Show ${Math.min(left, collection.pageSize).toLocaleString('en-US')} more of ${left.toLocaleString('en-US')}`, href: addressOf(collection, { ...choices, show: choices.show + collection.pageSize }) } : undefined,
		focus: focus ? focus.facet.values[focus.value] : undefined,
		kept
	};
}

/** What the side column holds on a collection's page: the find box and the filters (sidebar/CollectionFilters.svelte). */
export interface FilterColumn {
	/** The collection's page, where the find box sends the reader. */
	action: string;
	findLabel: string;
	find: string;
	kept: { name: string; value: string }[];
	facets: FacetView[];
}

/** "Find an order", "Find a notice". */
export const findLabelOf = (itemName: string) => `Find a${/^[aeiou]/i.test(itemName) ? 'n' : ''} ${itemName}`;

/** The side column's part of a view. */
export function filterColumn(view: BrowseView): FilterColumn {
	return { action: view.path, findLabel: findLabelOf(view.itemName), find: view.find, kept: view.kept, facets: view.facets };
}

/** The side column on an item's page: the collection's find box over the items around it. */
export const itemFilterColumn = (collection: BrowseCollection): FilterColumn => ({ action: collection.path, findLabel: findLabelOf(collection.itemName), find: '', kept: [], facets: [] });

/** The collection's name as a trail writes it, in sentence case: "Executive orders". */
export const crumbOf = (title: string) => title.charAt(0) + title.slice(1).toLocaleLowerCase('en-US');

export interface ItemPlace {
	/** What the list is: a chosen value, such as "Franklin D. Roosevelt", or the collection's name. */
	label: string;
	/** The list's own page. */
	href: string;
	position: number;
	total: number;
	previous?: { label: string; href: string };
	next?: { label: string; href: string };
	/** Items of the list from just before this one, for the side column; the current one's link is its bare address. */
	nearby: { number?: string; label: string; link: string }[];
	/** How many of the list the side column leaves out. */
	notShown: number;
	/** The chosen value that names the list, for the breadcrumbs. */
	focus?: { label: string; href: string };
}

/** How the column names an item: its number and title. */
const itemLabel = (item: BrowseItem) => item.title;

/**
 * Where an item sits in the list the reader came from (carried in the
 * address), or, when they came from elsewhere, in its default list, such as
 * its President's orders: its place, the items before and after it, and the
 * items around it for the side column.
 */
export function itemPlace(collection: BrowseCollection, key: string, parameters: URLSearchParams, around = 24): ItemPlace | undefined {
	const item = collection.items.find((candidate) => candidate.key === key);
	if (!item) return undefined;
	let choices = listChoices(collection, choicesOf(collection, parameters));
	let list = listed(collection, choices);
	if ((Object.keys(choices.filters).length === 0 && !choices.find) || !list.includes(item)) {
		// No list given (the whole collection, or a link from elsewhere), or one the item is not in: its default list, such as its President's orders.
		const facet = collection.facets.find((candidate) => candidate.itemList);
		const value = facet ? item.values[facet.key]?.[0] : undefined;
		choices = { ...choices, filters: facet && value ? { [facet.key]: [value] } : {}, find: '', sort: 'oldest' };
		list = listed(collection, choices);
	}
	const index = list.indexOf(item);
	const focus = focusOf(collection, choices);
	const link = (other: BrowseItem) => itemHref(collection, other.key, choices);
	const name = (other: BrowseItem) => (other.number ? `No. ${other.number}` : other.date ? other.date : other.title);
	// A few before this one and the rest after, so the column shows it near its top without scrolling (mockup C2-order).
	const before = 3;
	const from = Math.max(0, index - before);
	const nearby = list.slice(from, from + around).map((other) => ({ number: other.number, label: itemLabel(other), link: other === item ? `${collection.itemPath}/${encodeURIComponent(other.key)}` : link(other) }));
	const listHref = addressOf(collection, choices);
	return {
		label: focus ? focus.facet.values[focus.value] : collection.title,
		href: listHref,
		position: index + 1,
		total: list.length,
		previous: index > 0 ? { label: name(list[index - 1]), href: link(list[index - 1]) } : undefined,
		next: index < list.length - 1 ? { label: name(list[index + 1]), href: link(list[index + 1]) } : undefined,
		nearby,
		notShown: list.length - nearby.length,
		focus: focus ? { label: focus.facet.values[focus.value], href: listHref } : undefined
	};
}
