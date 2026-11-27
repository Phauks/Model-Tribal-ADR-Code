import { describe, expect, it } from 'vitest';
import { SourceUses } from '#lib/server/source-uses.ts';
import { groupingThreshold, numberRanges, rangesText, sourceGroups } from '#lib/source-groups.ts';

/** A page with sources cited under several parts, as a nation page cites them. */
function page(): SourceUses {
	const uses = new SourceUses((key) => key);
	uses.part('Key facts');
	for (const key of ['list', 'directory', 'census']) uses.cite(key, { section: 'Recognition', text: key });
	uses.part('Courts and dispute resolution');
	for (const key of ['court-guide', 'law-library']) uses.cite(key, { section: 'Courts', text: key });
	// A source already numbered keeps the part that first cited it.
	uses.cite('directory', { section: 'Courts', text: 'again' });
	uses.part('Laws and agreements', 'Gaming compact with Arizona');
	for (const key of ['arizona-2003', 'arizona-approval']) uses.cite(key, { section: 'Compact', text: key });
	uses.part('Laws and agreements', 'Gaming compact with New Mexico');
	for (const key of ['new-mexico-2004', 'new-mexico-approval']) uses.cite(key, { section: 'Compact', text: key });
	return uses;
}

describe('Sources list groups', () => {
	it('records the part of the page that first cites each source', () => {
		const list = page().list;
		expect(list.map((entry) => entry.part)).toEqual([
			'Key facts',
			'Key facts',
			'Key facts',
			'Courts and dispute resolution',
			'Courts and dispute resolution',
			'Laws and agreements',
			'Laws and agreements',
			'Laws and agreements',
			'Laws and agreements'
		]);
		expect(list[5].subpart).toBe('Gaming compact with Arizona');
	});

	it('folds a long list into groups in page order, each with its number range', () => {
		const groups = sourceGroups(page().list)!;
		expect(groups.map((group) => [group.part, rangesText(group.ranges)])).toEqual([
			['Key facts', '1–3'],
			['Courts and dispute resolution', '4–5'],
			['Laws and agreements', '6–9']
		]);
	});

	it('labels the documents inside a group only when the group covers several', () => {
		const groups = sourceGroups(page().list)!;
		expect(groups[2].subgroups.map((subgroup) => [subgroup.label, subgroup.sources.length])).toEqual([
			['Gaming compact with Arizona', 2],
			['Gaming compact with New Mexico', 2]
		]);
		expect(groups[0].subgroups.map((subgroup) => subgroup.label)).toEqual([undefined]);
	});

	it('keeps a short list, or one with a single part, as one list', () => {
		const uses = page();
		expect(uses.list.length).toBeGreaterThan(groupingThreshold);
		expect(sourceGroups(uses.list.slice(0, groupingThreshold))).toBeUndefined();
		const onePart = new SourceUses((key) => key);
		onePart.part('Entry');
		for (let index = 0; index < 12; index++) onePart.cite(`source-${index}`, { section: 'Entry', text: 'definition' });
		expect(sourceGroups(onePart.list)).toBeUndefined();
	});

	it('writes number ranges, with a gap where a part is cited again later', () => {
		expect(numberRanges([9, 1, 2, 3])).toEqual([
			[1, 3],
			[9, 9]
		]);
		expect(rangesText(numberRanges([1, 2, 3, 9]))).toBe('1–3, 9');
		expect(rangesText([[4, 7]], ' to ')).toBe('4 to 7');
	});
});
