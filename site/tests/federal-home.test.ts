import { describe, expect, it, vi } from 'vitest';

vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));

const { federalHome } = await import('#lib/server/federal-home.ts');
const { navigationSections } = await import('#lib/site-navigation.ts');
const { columnTable, columnTotal } = await import('#lib/column-chart.ts');

describe('the Federal Law home', () => {
	const section = navigationSections.find((candidate) => candidate.key === 'federal-law')!;

	it('groups the menu by who made the law, each group with a line and a picture credited to its record', () => {
		expect(section.groups.map((group) => group.title)).toEqual(['Treaties', 'Congress', 'President', 'Agencies']);
		for (const group of section.groups) {
			expect(group.line).toBeTruthy();
			expect(group.picture?.src).toMatch(/^\/pictures\/federal-law\/[a-z]+\.jpg$/);
			expect(group.picture?.credit).toMatch(/Public domain\.$/);
			expect(group.picture?.source).toMatch(/^https:\/\//);
		}
	});

	it('charts every decade from the first document to the last, one series per group', () => {
		const home = federalHome();
		const { chart } = home;
		expect(home.years).toMatch(/^1\d{3}–20\d{2}$/);
		expect(chart.series.map((series) => series.key)).toEqual(section.groups.map((group) => group.title));
		const decades = chart.columns.map((column) => Number(column.label.slice(0, 4)));
		decades.forEach((decade, index) => index > 0 && expect(decade - decades[index - 1]).toBe(10));
		expect(chart.columns.reduce((sum, column) => sum + columnTotal(column), 0)).toBeGreaterThan(1000);
		for (const group of section.groups) expect(home.groupYears[group.title]).toMatch(/^\d{4}–\d{4}$/);
	});

	it('links the President’s part of a decade to that decade’s orders', () => {
		const column = federalHome().chart.columns.find((candidate) => (candidate.values.President ?? 0) > 0)!;
		expect(column.links?.President).toBe(`/laws/executive-orders?decade=${column.label}`);
	});

	it('lists the chart as a table with a Sum row for each group and the total', () => {
		const table = columnTable(federalHome().chart);
		expect(table.columns.map((column) => column.header)).toEqual(['Decade', 'Treaties', 'Congress', 'President', 'Agencies', 'Total']);
		expect(table.columns.slice(1).every((column) => column.sum)).toBe(true);
	});
});
