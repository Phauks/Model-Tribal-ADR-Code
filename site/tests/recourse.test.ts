import { describe, expect, it } from 'vitest';
import {
	facetChoices,
	matchRecourse,
	recourseCsv,
	recourseFacets,
	recourseQueryFromParameters,
	recourseQueryToParameters,
	recognitionFacetValues,
	type RecourseRow
} from '../src/lib/recourse.ts';
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
const facet = (key: string) => recourseFacets.find((entry) => entry.key === key)!;
const ids = (list: RecourseRow[]) => list.map((entry) => entry.id);

describe('matchRecourse', () => {
	it('widens within a filter and narrows across filters', () => {
		expect(ids(matchRecourse(rows, { text: '', picked: { method: ['Mediation', 'Arbitration'] } }))).toEqual(['a', 'b', 'c']);
		expect(ids(matchRecourse(rows, { text: '', picked: { method: ['Mediation'], subject: ['Family'] } }))).toEqual(['a']);
	});

	it('matches every search word, ignoring case and accents', () => {
		expect(ids(matchRecourse(rows, { text: 'FAMILY médiation', picked: {} }))).toEqual(['a']);
	});

	it('matches a row with several states on any of them', () => {
		expect(ids(matchRecourse(rows, { text: '', picked: { state: ['New Mexico'] } }))).toEqual(['a']);
	});
});

describe('facetChoices', () => {
	it('counts each choice with the other filters applied, largest first', () => {
		const choices = facetChoices(rows, { text: '', picked: { subject: ['Family'], method: ['Mediation'] } }, facet('method'));
		expect(choices.map((choice) => [choice.value, choice.count, choice.picked])).toEqual([
			['Arbitration', 1, false],
			['Mediation', 1, true],
			['Peacemaking', 1, false]
		]);
	});

	it('keeps a picked choice that leaves no rows', () => {
		const choices = facetChoices(rows, { text: '', picked: { subject: ['Civil'], state: ['Oklahoma'] } }, facet('state'));
		expect(choices).toContainEqual({ value: 'Oklahoma', words: 'Oklahoma', count: 0, picked: true });
	});

	it('names the checking state in words', () => {
		expect(facetChoices(rows, { text: '', picked: {} }, facet('checked')).map((choice) => choice.words)).toEqual([
			'Checked by a second reader',
			'Read once'
		]);
	});
});

describe('page address', () => {
	it('writes the choices and reads them back', () => {
		const query = { text: ' custody ', picked: { method: ['Mediation', 'Peacemaking'], state: ['Arizona'] } };
		const parameters = recourseQueryToParameters(query);
		expect(parameters.toString()).toBe('q=custody&method=Mediation&method=Peacemaking&state=Arizona');
		expect(recourseQueryFromParameters(parameters)).toEqual({ text: 'custody', picked: query.picked });
	});

	it('ignores unknown parameters and repeated values', () => {
		expect(recourseQueryFromParameters(new URLSearchParams('nope=1&method=Mediation&method=Mediation'))).toEqual({
			text: '',
			picked: { method: ['Mediation'] }
		});
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
