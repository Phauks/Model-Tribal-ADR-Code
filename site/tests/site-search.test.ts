import { describe, expect, it } from 'vitest';
import { searchEntries, type SearchEntry } from '../src/lib/site-search.ts';

const entries: SearchEntry[] = [
	{ kind: 'nation', title: 'Big Pine Paiute Tribe of the Owens Valley', detail: 'California', link: '/nations/big-pine' },
	{ kind: 'nation', title: 'Paiute Indian Tribe of Utah', detail: 'Utah', link: '/nations/paiute-utah' },
	{ kind: 'nation', title: 'Cherokee Nation', also: ['ᏣᎳᎩᎯ ᎠᏰᎵ'], detail: 'Oklahoma', link: '/nations/cherokee' },
	{ kind: 'nation', title: 'Native Village of Ekwok', detail: 'Alaska', link: '/nations/ekwok' },
	{ kind: 'law', title: '25 U.S.C. § 1901. Congressional findings', detail: 'Chapter 21', link: '/laws/usc-25-chapter-21#sec-1901' },
	{ kind: 'law', title: 'Indian Child Welfare Act of 1978', also: ['ICWA'], detail: '25 USC 1901', link: '/laws/indian-child-welfare-act-1978' },
	{ kind: 'term', title: 'Peacemaking', detail: 'A process of talking through a dispute', link: '/glossary/peacemaking' }
];

describe('searchEntries', () => {
	it('finds nothing for an empty search', () => {
		expect(searchEntries(entries, '  ')).toEqual([]);
	});

	it('ranks a name that starts with the words above one that only contains them', () => {
		expect(searchEntries(entries, 'paiute').map((result) => result.link)).toEqual(['/nations/paiute-utah', '/nations/big-pine']);
	});

	it('needs every word, in any order', () => {
		expect(searchEntries(entries, 'owens paiute').map((result) => result.link)).toEqual(['/nations/big-pine']);
	});

	it('finds a nation by another name and says which name matched', () => {
		const [result] = searchEntries(entries, 'ᏣᎳᎩᎯ');
		expect(result.link).toBe('/nations/cherokee');
		expect(result.matchedName).toBe('ᏣᎳᎩᎯ ᎠᏰᎵ');
	});

	it('falls back to the detail line, such as a state', () => {
		expect(searchEntries(entries, 'alaska').map((result) => result.link)).toEqual(['/nations/ekwok']);
	});

	it('ignores case and accents', () => {
		expect(searchEntries(entries, 'PEÁCEMAKING').map((result) => result.link)).toEqual(['/glossary/peacemaking']);
	});

	it('reads initialisms with or without their periods', () => {
		expect(searchEntries(entries, '25 usc 1901').map((result) => result.link)).toEqual(['/laws/usc-25-chapter-21#sec-1901', '/laws/indian-child-welfare-act-1978']);
		expect(searchEntries(entries, '25 U.S.C. 1901').map((result) => result.link)).toEqual(['/laws/usc-25-chapter-21#sec-1901', '/laws/indian-child-welfare-act-1978']);
	});
	it('gives the same answers when the same index is searched again', () => {
		const first = searchEntries(entries, 'icwa');
		expect(first.map((result) => [result.link, result.matchedName])).toEqual([['/laws/indian-child-welfare-act-1978', 'ICWA']]);
		expect(searchEntries(entries, 'icwa')).toEqual(first);
		expect(searchEntries(entries, 'paiute').map((result) => result.link)).toEqual(['/nations/paiute-utah', '/nations/big-pine']);
	});
});
