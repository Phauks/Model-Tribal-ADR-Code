import { describe, expect, it } from 'vitest';
import { searchEntries, type SearchEntry } from '../src/lib/site-search.ts';

const entries: SearchEntry[] = [
	{ kind: 'nation', title: 'Big Pine Paiute Tribe of the Owens Valley', detail: 'California', link: '/nations/big-pine' },
	{ kind: 'nation', title: 'Paiute Indian Tribe of Utah', detail: 'Utah', link: '/nations/paiute-utah' },
	{ kind: 'nation', title: 'Cherokee Nation', also: ['ᏣᎳᎩᎯ ᎠᏰᎵ'], detail: 'Oklahoma', link: '/nations/cherokee' },
	{ kind: 'nation', title: 'Native Village of Ekwok', detail: 'Alaska', link: '/nations/ekwok' },
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
});

import { downloadFor } from '../src/lib/page-downloads.ts';

describe('downloadFor', () => {
	it('offers a nation page its record, and the map page nothing', () => {
		expect(downloadFor('/nations/cherokee-nation')?.link).toBe('/nations/cherokee-nation/record.json');
		expect(downloadFor('/nations/map')).toBeUndefined();
	});

	it('offers the index pages the list, and the glossary its terms', () => {
		expect(downloadFor('/nations/letter/n')?.link).toBe('/nations/nations.csv');
		expect(downloadFor('/nations/state/nv')?.link).toBe('/nations/nations.csv');
		expect(downloadFor('/glossary/native-nations')?.link).toBe('/glossary/terms.json');
		expect(downloadFor('/changelog')).toBeUndefined();
	});
});
