import { describe, expect, it } from 'vitest';
import { biographies, biographyPage, checked, peopleInCase, peopleOfNation, type BiographyRecord } from '#lib/server/biographies.ts';
import { courtPage } from '#lib/server/supreme-court-pages.ts';

describe('Biographies of Native people', () => {
	it('gives Crow Dog his other name, his nation and his case, each with its source', () => {
		const page = biographyPage('crow-dog')!;
		expect(page.names[0]).toMatchObject({
			name: 'Kan-gi-shun-ca',
			note: 'as the Supreme Court Reporter prints it'
		});
		expect(page.names[0].citations).toHaveLength(1);
		expect(page.glance.find((group) => group.field === 'nation')?.items[0]).toMatchObject({
			text: 'Rosebud Sioux Tribe of the Rosebud Indian Reservation',
			link: '/nations/rosebud-sioux-tribe-of-the-rosebud-indian-reservation'
		});
		expect(page.cases).toEqual([
			expect.objectContaining({
				key: 'ex-parte-crow-dog',
				role: 'Petitioner',
				link: '/cases/ex-parte-crow-dog'
			})
		]);
		expect(page.picture?.src).toBe('/biographies/portraits/crow-dog.jpg');
		expect(page.sources.map((source) => source.key)).toEqual(['ex-parte-crow-dog']);
	});

	it('lists the people with a page on their case and their nation', () => {
		expect(peopleInCase('ex-parte-crow-dog').map((person) => person.name)).toEqual(['Crow Dog', 'Spotted Tail']);
		expect(peopleOfNation('kiowa-tribe').map((person) => person.name)).toEqual(['Lone Wolf']);
	});

	it('cites every life event, and builds every page', () => {
		for (const person of biographies()) {
			const page = biographyPage(person.key)!;
			for (const event of page.events) expect(event.citations.length, `${person.key}: ${event.when}`).toBeGreaterThan(0);
			for (const item of page.cases) expect(item.citations.length, `${person.key}: ${item.key}`).toBeGreaterThan(0);
		}
	});

	it('keeps a living person to the public role', () => {
		const living: BiographyRecord = {
			key: 'someone',
			name: 'Someone',
			lead: 'A party.',
			living: true,
			events: [{ when: '2000', text: 'Born.', source: 'x' }],
			checked: '2026-11-24'
		};
		expect(() => checked('someone.yaml', living)).toThrow(/public role only/);
		expect(biographyPage('julia-martinez')!.events).toEqual([]);
		expect(biographyPage('julia-martinez')!.picture).toBeUndefined();
	});

	it("shows the Chief Justice's portrait on a Court's page", () => {
		const page = courtPage('waite-court')!;
		expect(page.picture?.src).toBe('/supreme-court/portraits/morrison-remick-waite');
		expect(page.glance[0]).toMatchObject({
			label: 'Chief Justice',
			items: [
				expect.objectContaining({
					link: '/supreme-court/justices/morrison-remick-waite'
				})
			]
		});
	});
});
