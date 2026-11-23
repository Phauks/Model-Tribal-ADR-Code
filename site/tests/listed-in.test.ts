import { describe, expect, it } from 'vitest';
import { listedIn } from '../src/lib/listed-in.ts';

const federalList = {
	kind: 'federal-register-notice',
	citation: {
		title: 'Indian Entities Recognized by and Eligible To Receive Services From the United States Bureau of Indian Affairs',
		'container-title-short': 'Fed. Reg.',
		volume: '91',
		page: '4102-4106',
		issued: { 'date-parts': [[2026, 1, 30]] }
	}
};

describe('listedIn', () => {
	it('cites a Federal Register notice by its title, pinpointed to the nation’s entry', () => {
		expect(listedIn(federalList, '91 Fed. Reg. 4104')).toEqual({
			title: 'Indian Entities Recognized by and Eligible To Receive Services From the United States Bureau of Indian Affairs',
			rest: '91 Fed. Reg. 4102, 4104 (Jan. 30, 2026)'
		});
	});

	it('gives the first page alone when the entry is on it or no page is known', () => {
		expect(listedIn(federalList, '91 Fed. Reg. 4102')?.rest).toBe('91 Fed. Reg. 4102 (Jan. 30, 2026)');
		expect(listedIn(federalList, 'Petitioner #65')?.rest).toBe('91 Fed. Reg. 4102 (Jan. 30, 2026)');
	});

	it('names any other document by its title and date, and nothing without a title', () => {
		expect(listedIn({ citation: { title: 'List of Petitioners by State', issued: { 'date-parts': [[2013, 11, 12]] } } })).toEqual({
			title: 'List of Petitioners by State',
			rest: '(Nov. 12, 2013)'
		});
		expect(listedIn({ citation: { title: 'List of Petitioners by State (as of November 12, 2013)', issued: { 'date-parts': [[2013, 11, 12]] } } })?.rest).toBeUndefined();
		expect(listedIn({ citation: {} })).toBeUndefined();
		expect(listedIn(undefined)).toBeUndefined();
	});
});
