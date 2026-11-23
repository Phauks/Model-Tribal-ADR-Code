import { describe, expect, it } from 'vitest';
import {
	recourseAddress,
	recourseCsv,
	recourseFacets,
	recourseLink,
	recourseQueryFromAddress,
	recognitionFacetValues,
	rowsWithWords,
	type RecourseRow
} from '../src/lib/recourse.ts';
import { facetCounts, filterRows, type FilterChoices } from '../src/lib/search-filters.ts';
import { recourseRows } from '../src/lib/server/recourse.ts';

function row(id: string, method: string, subject: string, states: string[], checked = false): RecourseRow {
	return {
		id,
		nation: { id: `${id}-nation`, name: `${id} Nation` },
		states,
		recognition: ['Federally recognized'],
		method,
		subject,
		setting: 'court-referral',
		entry: 'voluntary',
		outcome: 'binding-if-agreed',
		citation: `${id} Code § 1`,
		summary: `Lets parties use ${method.toLowerCase()} in ${subject.toLowerCase()} cases.`,
		checked
	};
}

const rows = [
	row('a', 'Mediation', 'Family', ['Arizona', 'New Mexico'], true),
	row('b', 'Mediation', 'Civil', ['Oregon']),
	row('c', 'Arbitration', 'Family', ['Arizona']),
	row('d', 'Peacemaking', 'Family', ['Oklahoma'])
];
const facets = recourseFacets(rows);
const ids = (list: RecourseRow[]) => list.map((entry) => entry.id);
const match = (text: string, choices: FilterChoices) => ids(filterRows(rowsWithWords(rows, text), facets, choices));

describe('finding provisions', () => {
	it('widens within a filter and narrows across filters', () => {
		expect(match('', { method: ['Mediation', 'Arbitration'] })).toEqual(['a', 'b', 'c']);
		expect(match('', { method: ['Mediation'], subject: ['Family'] })).toEqual(['a']);
	});

	it('matches every search word, ignoring case and accents', () => {
		expect(match('FAMILY médiation', {})).toEqual(['a']);
	});

	it('matches a row with several states on any of them', () => {
		expect(match('', { state: ['New Mexico'] })).toEqual(['a']);
	});
});

describe('recourseFacets', () => {
	const options = (key: string) => facets.find((facet) => facet.key === key)!.options;

	it('lists answers by how many provisions have them, then in reading order', () => {
		expect(options('method').map((option) => option.value)).toEqual(['Mediation', 'Arbitration', 'Peacemaking']);
	});

	it('lists states in reading order', () => {
		expect(options('state').map((option) => option.value)).toEqual(['Arizona', 'New Mexico', 'Oklahoma', 'Oregon']);
	});

	it('names the tags and the checking state in words', () => {
		expect(options('setting')).toEqual([{ value: 'court-referral', label: 'The court refers the case' }]);
		expect(options('checked')).toEqual([
			{ value: 'once', label: 'Read once' },
			{ value: 'checked', label: 'Checked by a second reader' }
		]);
	});

	it('counts each answer with the other filters applied', () => {
		const counts = facetCounts(rows, facets, { subject: ['Family'], method: ['Mediation'] });
		expect([...counts.method]).toEqual([
			['Mediation', 1],
			['Arbitration', 1],
			['Peacemaking', 1]
		]);
	});
});

describe('page address', () => {
	it('writes the choices and reads them back', () => {
		const choices = { method: ['Peacemaking', 'Mediation'], state: ['Arizona'] };
		const parameters = recourseAddress({ text: ' custody ', choices }, facets);
		expect(parameters.toString()).toBe('q=custody&method=Mediation&method=Peacemaking&state=Arizona');
		expect(recourseQueryFromAddress(parameters, facets)).toEqual({
			text: 'custody',
			choices: { method: ['Mediation', 'Peacemaking'], state: ['Arizona'] }
		});
	});

	it('ignores unknown parameters, unknown answers and repeated values', () => {
		expect(recourseQueryFromAddress(new URLSearchParams('nope=1&method=Mediation&method=Mediation&method=Nothing'), facets)).toEqual({
			text: '',
			choices: { method: ['Mediation'] }
		});
	});

	it('links to one answer, as the charts do', () => {
		expect(recourseLink('state', 'New Mexico')).toBe('/nations/recourse?state=New+Mexico');
	});
});

describe('recognition filter', () => {
	it('lists the shown kinds in a fixed order and never "no federal recognition"', () => {
		expect(recognitionFacetValues(['unrecognized', 'state', 'federal'])).toEqual(['federal', 'state']);
	});
});

describe('recourseCsv', () => {
	it('writes the tags in words and the nation page as a link', () => {
		const lines = recourseCsv([rows[0]], 'https://example.org').split('\r\n');
		expect(lines[0]).toBe(
			'Nation,Nation (link),States,Citation,Method,Kind of dispute,Where it happens,How it starts,Result,What it does,Checked by a second reader,Law'
		);
		expect(lines[1]).toContain('a Nation,https://example.org/nations/a-nation,Arizona; New Mexico');
		expect(lines[1]).toContain('The court refers the case,Voluntary,Binding once both sides agree');
	});
});

describe('recourseRows (repository data)', () => {
	const built = recourseRows();

	it('lists dispute resolution provisions once, never one marked to drop', () => {
		expect(built.length).toBeGreaterThan(1000);
		expect(new Set(built.map((entry) => entry.id)).size).toBe(built.length);
	});

	it('gives every row a nation, a method, a citation and a summary', () => {
		for (const entry of built) {
			expect(entry.nation.name, entry.id).not.toBe('');
			expect(entry.method, entry.id).not.toBe('');
			expect(entry.citation, entry.id).not.toBe('');
			expect(entry.summary, entry.id).not.toBe('');
		}
	});
});
