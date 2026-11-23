import { describe, expect, it } from 'vitest';
import {
	axisYears,
	barYears,
	byDate,
	clampRange,
	countsByBar,
	entryCitation,
	eraOf,
	extentOf,
	isPartialDate,
	isTimelineDate,
	timelineCsv,
	timelineDate,
	timelineRows,
	yearOf,
	zoomRange,
	type TimelineEntry
} from '../src/lib/timeline.ts';
import { caseCitation, issuedDate, lawCitation, lawKey } from '../src/lib/server/timeline.ts';
import { SourceUses } from '../src/lib/server/source-uses.ts';
import type { SourceRecord } from '../src/lib/server/content.ts';

const entry = (date: string, kind: TimelineEntry['kind'] = 'case', title = 'A v. B'): TimelineEntry => ({ id: `${kind}-${date}-${title}`, kind, date, title });

describe('placing dates', () => {
	it('accepts a year, a month or a day, and nothing else', () => {
		expect(isTimelineDate('1868')).toBe(true);
		expect(isTimelineDate('2007-01')).toBe(true);
		expect(isTimelineDate('1868-06-01')).toBe(true);
		expect(isTimelineDate('June 1, 1868')).toBe(false);
		expect(isTimelineDate(undefined)).toBe(false);
	});

	it('puts a year alone in the middle of its year, and a month alone in the middle of its month', () => {
		expect(yearOf('1997')).toBeCloseTo(1997.5);
		expect(yearOf('2007-01')).toBeCloseTo(2007 + 0.5 / 12);
		expect(yearOf('2021-07-01')).toBeCloseTo(2021.5);
		expect(isPartialDate('1997')).toBe(true);
		expect(isPartialDate('1868-06-01')).toBe(false);
	});

	it('writes dates as the style guide does', () => {
		expect(timelineDate('1868-06-01')).toBe('June 1, 1868');
		expect(timelineDate('2007-01')).toBe('Jan. 2007');
		expect(timelineDate('1997')).toBe('1997');
	});

	it('finds the era from the legal history essay', () => {
		expect(eraOf(1868).name).toBe('Treaty era');
		expect(eraOf(1871).name).toBe('Reservations and allotment');
		expect(eraOf(1968).name).toBe('Self-determination');
		expect(eraOf(1987).name).toBe('Self-determination');
		expect(eraOf(1988).name).toBe('Modern era');
	});

	it('sorts by date, then by row', () => {
		const sorted = [entry('2001-05-29'), entry('1868-06-01', 'document'), entry('1868-06-01', 'treaty')].sort(byDate);
		expect(sorted.map((each) => each.kind)).toEqual(['treaty', 'document', 'case']);
	});
});

describe('zooming', () => {
	const extent = { from: 1840, to: 2030 };

	it('covers every entry with a little room at each end', () => {
		const span = extentOf([entry('1849-09-09'), entry('2023-06-22')], [{ year: 2016, count: 3, peacemaking: 0 }]);
		expect(span.from).toBeLessThan(1849);
		expect(span.to).toBeGreaterThan(2023);
	});

	it('zooms around the middle and stays inside the extent', () => {
		expect(zoomRange(extent, 0.5, extent)).toEqual({ from: 1887.5, to: 1982.5 });
		expect(zoomRange({ from: 1850, to: 1870 }, 4, extent)).toEqual({ from: 1840, to: 1920 });
		expect(zoomRange({ from: 1900, to: 1904 }, 0.5, extent).to - zoomRange({ from: 1900, to: 1904 }, 0.5, extent).from).toBe(4);
		expect(clampRange({ from: 2020, to: 2040 }, extent)).toEqual({ from: 2010, to: 2030 });
	});

	it('picks round years for the axis and wider bars for a wider view', () => {
		expect(axisYears({ from: 1968, to: 1988 })).toEqual([1970, 1975, 1980, 1985]);
		expect(axisYears({ from: 1840, to: 2030 })).toEqual([1850, 1875, 1900, 1925, 1950, 1975, 2000, 2025]);
		expect(barYears({ from: 1968, to: 1988 })).toBe(1);
		expect(barYears({ from: 1900, to: 2000 })).toBe(5);
		expect(barYears({ from: 1770, to: 2030 })).toBe(10);
	});

	it('counts records into bars', () => {
		const bars = countsByBar(
			[
				{ year: 1982, count: 64, peacemaking: 1 },
				{ year: 1983, count: 81, peacemaking: 1 },
				{ year: 1985, count: 11 }
			],
			5
		);
		expect(bars.get(1980)).toEqual({ count: 145, peacemaking: 2 });
		expect(bars.get(1985)).toEqual({ count: 11, peacemaking: 0 });
	});
});

describe('downloads', () => {
	it('lists entries and opinion counts oldest first, with nations by name and links from the site root', () => {
		const rows = timelineRows(
			[
				{ ...entry('1959-01-12', 'case', 'Williams v. Lee'), citation: '358 U.S. 217 (1959)', link: '/copies/view/williams', nations: ['navajo-nation'] },
				{ ...entry('1849-09-09', 'treaty', 'Treaty with the Navaho, 1849'), citation: '9 Stat. 974' }
			],
			[{ year: 1982, count: 64, peacemaking: 1, nation: 'navajo-nation' }],
			{ 'navajo-nation': 'Navajo Nation' },
			'https://example.org'
		);
		expect(rows.map((row) => row.date)).toEqual(['1849-09-09', '1959-01-12', '1982']);
		expect(rows[1]).toMatchObject({ kind: 'Court decisions', nations: 'Navajo Nation', link: 'https://example.org/copies/view/williams' });
		expect(rows[2]).toMatchObject({ title: '64 published opinions', detail: '1 mentions peacemaking', link: 'https://example.org/nations/navajo-nation/opinions' });
		const csv = timelineCsv(rows);
		expect(csv.split('\r\n')[0]).toBe('Date,Kind,Title,Title (link),Citation,Detail,Nations');
		expect(csv).toContain('"Treaty with the Navaho, 1849"');
	});

	it('copies an entry as its title and citation', () => {
		expect(entryCitation({ ...entry('1959-01-12', 'case', 'Williams v. Lee'), citation: '358 U.S. 217 (1959)' })).toBe('Williams v. Lee, 358 U.S. 217 (1959)');
	});
});

describe('citations of cases and laws', () => {
	const record = (citation: SourceRecord['citation'], kind = 'federal-case'): SourceRecord => ({ key: 'test', kind, citation });

	it('cites a case as the Indigo Book does', () => {
		expect(caseCitation(record({ title: 'Williams v. Lee', authority: 'Supreme Court of the United States', 'container-title': 'U.S.', volume: '358', page: '217', issued: { 'date-parts': [[1959, 1, 12]] } }))).toBe('358 U.S. 217 (1959)');
		expect(caseCitation(record({ title: 'Southland Corp. v. Keating', authority: 'Supreme Court of the United States', 'container-title': 'United States Reports', volume: '465', page: '1', issued: { 'date-parts': [[1984, 1, 23]] } }))).toBe('465 U.S. 1 (1984)');
		expect(caseCitation(record({ title: 'Native American Church v. Navajo Tribal Council', authority: '10th Cir.', 'container-title': 'F.2d', volume: '272', page: '131', issued: { 'date-parts': [[1959, 11, 17]] } }))).toBe('272 F.2d 131 (10th Cir. 1959)');
	});

	it('cites a statute by the Statutes at Large, unless its title already does', () => {
		const statute = record({ title: 'Indian Civil Rights Act of 1968', 'container-title': 'United States Statutes at Large', volume: '82', page: '77', issued: { 'date-parts': [[1968, 4, 11]] } }, 'federal-statute');
		expect(lawCitation(statute, 'Indian Civil Rights Act of 1968')).toBe('82 Stat. 77 (1968)');
		expect(lawCitation(statute, 'Siletz Indian Tribe Restoration Act, Pub. L. No. 95-195, 91 Stat. 1415 (1977)')).toBe('');
	});

	it('finds two records of the same law', () => {
		expect(lawKey('Menominee Restoration Act')).toBe(lawKey('Menominee Restoration Act, Pub. L. No. 93-197, 87 Stat. 770 (1973)'));
		expect(lawKey('Indian Civil Rights Act of 1968')).not.toBe(lawKey('Civil Rights Act of 1968, title IV (Jurisdiction over criminal and civil actions)'));
	});

	it('reads a date from the date parts, to the day the record gives', () => {
		expect(issuedDate(record({ issued: { 'date-parts': [[1868, 6, 1]] } }))).toBe('1868-06-01');
		expect(issuedDate(record({ issued: { 'date-parts': [[1997]] } }))).toBe('1997');
		expect(issuedDate(record({}))).toBeUndefined();
	});
});

describe('markers repeated on the timeline', () => {
	it('links a second marker to the same source without adding a line to its entry', () => {
		const uses = new SourceUses(() => 'Source');
		const first = uses.cite('kappler', { section: 'Treaties', text: 'Treaty with the Navaho, 1868' });
		const again = uses.again('kappler', { section: 'Timeline', text: 'Treaty with the Navaho, 1868' });
		expect(again.number).toBe(first.number);
		expect(again.anchor).not.toBe(first.anchor);
		const [entry] = uses.list;
		expect(entry.backlinks).toEqual([first.anchor, again.anchor]);
		expect(entry.groups).toEqual([{ section: 'Treaties', where: undefined, facts: ['Treaty with the Navaho, 1868'] }]);
	});

	it('cites a source the page has not cited yet', () => {
		const uses = new SourceUses(() => 'Source');
		uses.again('williams-v-lee', { section: 'Timeline', text: 'Williams v. Lee' });
		expect(uses.list[0].groups[0].section).toBe('Timeline');
	});
});
