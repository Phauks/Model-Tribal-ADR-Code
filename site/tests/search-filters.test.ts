import { describe, expect, it } from 'vitest';
import {
	activeChoices,
	choicesFromAddress,
	facetCounts,
	filterRows,
	toggleChoice,
	writeChoices,
	type Facet
} from '../src/lib/search-filters.ts';

interface Row {
	name: string;
	states: string[];
	court: boolean;
}

const rows: Row[] = [
	{ name: 'A', states: ['NV'], court: true },
	{ name: 'B', states: ['NV', 'CA'], court: false },
	{ name: 'C', states: ['AZ'], court: true }
];

const facets: Facet<Row>[] = [
	{
		key: 'state',
		label: 'State',
		options: [
			{ value: 'AZ', label: 'Arizona' },
			{ value: 'CA', label: 'California' },
			{ value: 'NV', label: 'Nevada' }
		],
		valuesOf: (row) => row.states
	},
	{
		key: 'courts',
		label: 'Courts found',
		options: [{ value: 'court', label: 'Tribal court' }],
		valuesOf: (row) => (row.court ? ['court'] : [])
	}
];

describe('search filters', () => {
	it('shows rows with either answer in one facet and both facets together', () => {
		expect(filterRows(rows, facets, { state: ['NV', 'AZ'] }).map((row) => row.name)).toEqual(['A', 'B', 'C']);
		expect(filterRows(rows, facets, { state: ['NV'], courts: ['court'] }).map((row) => row.name)).toEqual(['A']);
	});

	it('leaves a facet’s own choices out of its counts', () => {
		const counts = facetCounts(rows, facets, { state: ['NV'], courts: ['court'] });
		expect(counts.state.get('AZ')).toBe(1);
		expect(counts.state.get('NV')).toBe(1);
		expect(counts.courts.get('court')).toBe(1);
	});

	it('reads and writes the address, dropping unknown answers', () => {
		const choices = choicesFromAddress(new URLSearchParams('state=NV&state=XX&courts=court&q=paiute'), facets);
		expect(choices).toEqual({ state: ['NV'], courts: ['court'] });
		const parameters = new URLSearchParams('q=paiute&state=AZ');
		writeChoices(parameters, facets, toggleChoice(choices, 'state', 'CA', true));
		expect(parameters.toString()).toBe('q=paiute&state=CA&state=NV&courts=court');
	});

	it('names each chosen answer for its chip', () => {
		expect(activeChoices(facets, { courts: ['court'] }).map((choice) => choice.label)).toEqual([
			'Courts found: Tribal court'
		]);
	});
});
