/**
 * Filters a reader ticks to narrow a list: the advanced search's filters
 * (Trevor asked for advanced search on Nov. 23, 2026), written so any list of
 * rows can use them, not only nations. A facet names one question, such as
 * "State or territory", and says which of its answers a row has. Ticking two
 * answers in one facet shows rows with either; ticking answers in two facets
 * shows rows with both, the way library catalogs and shops filter.
 *
 * The choices live in the page's address as repeated parameters, such as
 * ?state=NV&state=AZ&recognition=federal, so a filtered list can be
 * bookmarked, shared and reached with the back button on any page that uses
 * these helpers.
 */

export interface FacetOption {
	/** What the address carries, such as "NV". */
	value: string;
	/** What the reader sees, such as "Nevada". */
	label: string;
}

export interface Facet<Row> {
	/** The address parameter, such as "state". */
	key: string;
	/** The fieldset's legend, such as "State or territory". */
	label: string;
	/** A line under the legend that says what the answers mean. */
	hint?: string;
	options: FacetOption[];
	/** The answers one row has; a row may have none or several. */
	valuesOf: (row: Row) => readonly string[];
	/** Long lists get a box for narrowing the options themselves. */
	long?: boolean;
}

/** The ticked answers, by facet key. A facet with nothing ticked does not filter. */
export type FilterChoices = Record<string, string[]>;

/** Whether a row passes every facet that has a ticked answer, skipping the facet named in except. */
export function rowMatches<Row>(
	row: Row,
	facets: readonly Facet<Row>[],
	choices: FilterChoices,
	except?: string
): boolean {
	for (const facet of facets) {
		if (facet.key === except) continue;
		const chosen = choices[facet.key];
		if (!chosen || chosen.length === 0) continue;
		const values = facet.valuesOf(row);
		if (!chosen.some((value) => values.includes(value))) return false;
	}
	return true;
}

export function filterRows<Row>(rows: readonly Row[], facets: readonly Facet<Row>[], choices: FilterChoices): Row[] {
	return rows.filter((row) => rowMatches(row, facets, choices));
}

/**
 * How many rows each answer would show if ticked, given the other facets'
 * choices. A facet's own choices are left out of its counts, so ticking
 * Nevada does not make every other state read 0.
 */
export function facetCounts<Row>(
	rows: readonly Row[],
	facets: readonly Facet<Row>[],
	choices: FilterChoices
): Record<string, Map<string, number>> {
	const counts: Record<string, Map<string, number>> = {};
	for (const facet of facets) {
		const tally = new Map<string, number>();
		for (const row of rows) {
			if (!rowMatches(row, facets, choices, facet.key)) continue;
			for (const value of new Set(facet.valuesOf(row))) tally.set(value, (tally.get(value) ?? 0) + 1);
		}
		counts[facet.key] = tally;
	}
	return counts;
}

/** Whether anything is ticked. */
export function hasChoices(choices: FilterChoices): boolean {
	return Object.values(choices).some((values) => values.length > 0);
}

/** The choices an address carries, keeping only answers the facets know. */
export function choicesFromAddress<Row>(
	parameters: Pick<URLSearchParams, 'getAll'>,
	facets: readonly Facet<Row>[]
): FilterChoices {
	const choices: FilterChoices = {};
	for (const facet of facets) {
		const known = new Set(facet.options.map((option) => option.value));
		const values = [...new Set(parameters.getAll(facet.key))].filter((value) => known.has(value));
		if (values.length > 0) choices[facet.key] = values;
	}
	return choices;
}

/**
 * Writes the choices into an address's parameters, replacing whatever the
 * facets' keys held, in the order of each facet's options so one set of
 * choices always makes one address.
 */
export function writeChoices<Row>(
	parameters: URLSearchParams,
	facets: readonly Facet<Row>[],
	choices: FilterChoices
): void {
	for (const facet of facets) {
		parameters.delete(facet.key);
		const chosen = new Set(choices[facet.key] ?? []);
		for (const option of facet.options) if (chosen.has(option.value)) parameters.append(facet.key, option.value);
	}
}

/** Choices with one answer ticked or unticked. */
export function toggleChoice(choices: FilterChoices, key: string, value: string, on: boolean): FilterChoices {
	const current = choices[key] ?? [];
	const next = on ? [...new Set([...current, value])] : current.filter((item) => item !== value);
	const result = { ...choices };
	if (next.length > 0) result[key] = next;
	else delete result[key];
	return result;
}

export interface ActiveChoice {
	key: string;
	value: string;
	/** "Facet: answer", for the chip that removes it. */
	label: string;
}

/** Every ticked answer, in the facets' order, for the row of chips above the results. */
export function activeChoices<Row>(facets: readonly Facet<Row>[], choices: FilterChoices): ActiveChoice[] {
	return facets.flatMap((facet) => {
		const chosen = new Set(choices[facet.key] ?? []);
		return facet.options
			.filter((option) => chosen.has(option.value))
			.map((option) => ({ key: facet.key, value: option.value, label: `${facet.label}: ${option.label}` }));
	});
}
