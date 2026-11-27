import { describe, expect, it } from 'vitest';
import { outcomeText, writersText } from '#lib/bench-chart.ts';
import { surname } from '#lib/case-opinions.ts';
import { chartCases } from '#lib/server/chart-cases.ts';
import { justicePage } from '#lib/server/justice-pages.ts';
import { courtPage } from '#lib/server/supreme-court-pages.ts';

describe('Justice timelines', () => {
	it('gives every Supreme Court case its votes, the Chief Justice first', () => {
		const cases = chartCases();
		expect(cases.length).toBeGreaterThan(600);
		for (const item of cases) {
			expect(item.votes.length, item.key).toBeGreaterThan(0);
			const chief = item.votes.findIndex((vote) => vote.chief);
			if (chief !== -1) expect(chief, `${item.key}: the Chief Justice comes first`).toBe(0);
		}
	});

	it('says how Donnelly v. United States came out and who wrote', () => {
		const donnelly = chartCases().find((item) => item.key === 'donnelly-v-united-states')!;
		expect(outcomeText(donnelly)).toBe('Divided, 6–3');
		expect(donnelly.citation).toBe('228 U.S. 243');
		expect(donnelly.votes.filter((vote) => vote.vote === 'dissent').map((vote) => vote.name)).toEqual(['Holmes', 'Lurton', 'Hughes']);
		expect(writersText(donnelly)).toBe('Pitney for the Court · Dissent: Holmes');
	});

	it('calls Justice Van Devanter by his whole family name', () => {
		expect(surname('Willis Van Devanter')).toBe('Van Devanter');
		expect(surname('William J. Brennan, Jr.')).toBe('Brennan');
		expect(chartCases().some((item) => item.votes.some((vote) => vote.name === 'Van Devanter'))).toBe(true);
	});

	it("draws the White Court's last cases, decided after White died", () => {
		const page = courtPage('white-court')!;
		expect(page.end).toBe('1921-06-01');
		expect(page.chartCases.filter((item) => item.decided! > page.end)).toHaveLength(0);
		expect(page.chartCases).toHaveLength(page.cases.length);
		// White's own bar still ends the day he died.
		expect(page.bench.find((row) => row.role === 'Chief Justice')?.to).toBe('1921-05-19');
	});

	it("marks every case on a Justice's page with that Justice's own vote", () => {
		const page = justicePage('william-orville-douglas')!;
		expect(page.chartCases).toHaveLength(page.cases.length);
		for (const item of page.chartCases) expect(item.votes.some((vote) => vote.person === page.key), item.key).toBe(true);
		expect(page.rows[0].person).toBe(page.key);
	});
});
