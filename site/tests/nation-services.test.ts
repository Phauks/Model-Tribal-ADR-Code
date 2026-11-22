import { describe, expect, it } from 'vitest';
import { nationServices, type ServiceFact } from '#lib/nation-services.ts';

function run(facts: ServiceFact[]) {
	const cited: { source?: string; section: string; text: string }[] = [];
	const categories = nationServices(facts, (fact, section, text, marks) => {
		cited.push({ source: fact.source, section, text });
		const number = cited.length;
		marks.push({ number, anchor: `cite-${number}-1` });
	});
	return { categories, cited };
}

describe('nationServices', () => {
	it('shows each kind once, as a heading, with no kind in parentheses', () => {
		const { categories } = run([
			{ kind: 'tribal-court', name: 'Example Tribal Court', source: 'a', confidence: 'high' },
			{ kind: 'peacemaking', name: 'Example Peacemaking Program', source: 'b', confidence: 'high' },
			{ kind: 'mediation', name: 'Example Mediation Service', source: 'c', confidence: 'high' }
		]);
		expect(categories.map((category) => category.heading)).toEqual([
			'Courts',
			'Peacemaking',
			'Mediation'
		]);
		expect(categories[1].entries).toMatchObject([{ text: 'Example Peacemaking Program', link: undefined, detail: undefined }]);
	});

	it('lists one service once when two sources name it', () => {
		const { categories, cited } = run([
			{
				kind: 'peacemaking-program',
				name: 'Example Peacemaking Program (Own Name)',
				source: 'list',
				confidence: 'medium'
			},
			{
				kind: 'peacemaking',
				name: 'Example Peacemaking Program',
				link: 'https://example.org/peacemaking',
				source: 'law',
				confidence: 'high'
			}
		]);
		expect(categories).toHaveLength(1);
		expect(categories[0].entries).toMatchObject([
			{
				text: 'Example Peacemaking Program (Own Name)',
				link: 'https://example.org/peacemaking',
				detail: undefined
			}
		]);
		expect(categories[0].entries[0].citations).toHaveLength(2);
		expect(cited.map((use) => use.source)).toEqual(['list', 'law']);
	});

	it('folds a court listed only as "Tribal Court" into the named court with the same link', () => {
		const { categories } = run([
			{ kind: 'tribal-court', name: 'Tribal Court', link: 'http://www.courts.example.org/', source: 'a', confidence: 'medium' },
			{ kind: 'tribal-court', name: 'Example Judicial Branch', link: 'https://courts.example.org', source: 'b', confidence: 'medium' },
			{ kind: 'court-of-appeals', name: 'Example Supreme Court', link: 'https://courts.example.org/', source: 'b', confidence: 'medium' }
		]);
		expect(categories[0].entries.map((entry) => entry.text)).toEqual([
			'Example Judicial Branch',
			'Example Supreme Court'
		]);
	});

	it('gives the judicial branch its own heading, not a place among the courts', () => {
		const { categories } = run([
			{ kind: 'tribal-court', name: 'Tribal Court', link: 'https://courts.example.org/', source: 'a', confidence: 'medium' },
			{ kind: 'judicial-branch', name: 'Example Nation Judicial Branch', link: 'https://courts.example.org', source: 'b', confidence: 'medium' },
			{ kind: 'tribal-court', name: 'Example Nation District Court', link: 'https://courts.example.org/district', source: 'b', confidence: 'medium' }
		]);
		expect(categories.map((category) => category.heading)).toEqual(['Judicial branch', 'Courts']);
		// The directory entry that names only "Tribal Court" at the branch's own address is the branch.
		expect(categories[0].entries).toMatchObject([{ text: 'Example Nation Judicial Branch' }]);
		expect(categories[0].entries[0].citations).toHaveLength(2);
		expect(categories[1].entries.map((entry) => entry.text)).toEqual(['Example Nation District Court']);
	});

	it('lays out the appeal path from the first court to the highest court', () => {
		const { categories, cited } = run([
			{
				kind: 'tribal-court',
				name: 'Example District Court',
				source: 'a',
				confidence: 'high',
				appeals_to: { court: 'Example Court of Appeals', source: 'code', confidence: 'high' }
			},
			{
				kind: 'tribal-court',
				name: 'Example Family Court',
				source: 'a',
				confidence: 'high',
				appeals_to: { court: 'Example Court of Appeals', source: 'code', confidence: 'high' }
			},
			{
				kind: 'court-of-appeals',
				name: 'Example Court of Appeals',
				source: 'a',
				confidence: 'high',
				appeals_to: { court: 'Example Supreme Court', source: 'constitution', confidence: 'high' }
			},
			{ kind: 'supreme-court', name: 'Example Supreme Court', source: 'a', confidence: 'high' },
			{ kind: 'court-of-indian-offenses', name: 'Example Regional Court', source: 'a', confidence: 'high' }
		]);
		const courts = categories[0];
		expect(courts.appealPaths).toHaveLength(1);
		expect(courts.appealPaths[0].first.map((entry) => entry.text)).toEqual([
			'Example District Court',
			'Example Family Court'
		]);
		expect(courts.appealPaths[0].then.map((step) => step.court.text)).toEqual([
			'Example Court of Appeals',
			'Example Supreme Court'
		]);
		expect(courts.entries).toMatchObject([
			{ text: 'Example Regional Court', link: undefined, detail: 'Court of Indian Offenses' }
		]);
		// The markers above the Court of Appeals come from both courts' appeals_to facts.
		expect(courts.appealPaths[0].then[0].citations).toHaveLength(2);
		expect(cited).toContainEqual({
			source: 'constitution',
			section: 'Courts',
			text: 'Appeals from Example Court of Appeals go to Example Supreme Court'
		});
	});

	it('ignores an appeal to a court the record does not list', () => {
		const { categories } = run([
			{
				kind: 'tribal-court',
				name: 'Example Tribal Court',
				source: 'a',
				confidence: 'high',
				appeals_to: { court: 'Missing Court', source: 'code', confidence: 'high' }
			}
		]);
		expect(categories[0].appealPaths).toEqual([]);
		expect(categories[0].entries.map((entry) => entry.text)).toEqual(['Example Tribal Court']);
	});
});
