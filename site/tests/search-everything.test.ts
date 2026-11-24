import { describe, expect, it } from 'vitest';
import { countMatches, matchEverything, resultGroups } from '../src/lib/search-everything.ts';
import { expandRecords, type NationFile } from '../src/lib/search-records.ts';
import type { SearchEntry } from '../src/lib/site-search.ts';

function nation(id: string, name: string): NationFile {
	return {
		id,
		name,
		statesText: 'Arizona',
		recognitionText: '',
		recognition: ['federal'],
		community: 'native-nation',
		states: ['AZ'],
		region: [],
		courts: [],
		dispute: [],
		laws: [],
		gaming: []
	};
}

// The search Trevor ran on Nov. 23, 2026: one nation, four laws and two stories.
const entries: SearchEntry[] = [
	{ kind: 'nation', title: 'Navajo Nation', detail: 'Arizona, New Mexico, Utah', link: '/nations/navajo-nation' },
	{ kind: 'nation', title: 'Hopi Tribe', detail: 'Arizona', link: '/nations/hopi-tribe' },
	{ kind: 'story', title: 'Making Peace, the Navajo Way', link: '/stories/paternity' },
	{ kind: 'story', title: 'The Journey Narrative as the beginning of the Navajo judiciary', link: '/stories/journey' },
	{ kind: 'term', title: 'Peacemaking', detail: 'Resolving a dispute by talking it through', link: '/glossary/peacemaking' },
	{ kind: 'page', title: 'Glossary', link: '/glossary' }
];

const records = expandRecords({
	nations: [nation('navajo-nation', 'Navajo Nation'), nation('hopi-tribe', 'Hopi Tribe')],
	documents: [
		{ title: 'Navajo Nation Code', kind: 'law-code', nation: 'navajo-nation', anchor: 'law-heading' },
		{ title: 'Public Reports', kind: 'other', nation: 'navajo-nation', anchor: 'law-heading' },
		{ title: 'Arizona Gaming Compact', kind: 'gaming-compact', year: '2003', nation: 'navajo-nation', anchor: 'a' },
		{ title: 'New Mexico Gaming Compact', kind: 'gaming-compact', year: '2004', nation: 'navajo-nation', anchor: 'b' },
		{ title: 'Hopi Constitution', kind: 'constitution', nation: 'hopi-tribe', anchor: 'law-heading' }
	],
	storyNations: {},
	stateOptions: [],
	regionOptions: []
});

describe('matchEverything', () => {
	it('counts every group the search page lists, laws included', () => {
		const matches = matchEverything(entries, records, 'navajo');
		expect(matches.nation.map((match) => match.row.id)).toEqual(['navajo-nation']);
		// Laws match through their nation's name, as on the search page.
		expect(matches.document).toHaveLength(4);
		expect(matches.story).toHaveLength(2);
		expect(countMatches(matches)).toBe(7);
		expect(resultGroups.filter((group) => matches[group].length > 0)).toEqual(['nation', 'document', 'story']);
	});

	it('leaves out a nation the records do not hold, so it is not counted', () => {
		const withStray: SearchEntry[] = [...entries, { kind: 'nation', title: 'Navajo Test', link: '/nations/missing' }];
		expect(countMatches(matchEverything(withStray, records, 'navajo'))).toBe(7);
	});

	it('finds nothing without words', () => {
		expect(countMatches(matchEverything(entries, records, '   '))).toBe(0);
	});
});
