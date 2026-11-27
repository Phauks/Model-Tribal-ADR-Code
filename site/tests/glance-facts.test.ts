import { describe, expect, it } from 'vitest';
import { withoutRepeats } from '../src/lib/info-page.ts';

// At a glance only where it earns its place (Trevor, Nov. 26, 2026; src/lib/info-page.ts).
describe('the facts At a glance keeps', () => {
	const treaty = [
		{ field: 'kind', label: 'Kind', items: [{ text: 'Treaty' }] },
		{ field: 'date', label: 'Signed', items: [{ text: 'Oct. 28, 1867' }] },
		{ field: 'citation', label: 'Citation', items: [{ text: 'Treaty with the Cheyenne and Arapaho, Oct. 28, 1867, 15 Stat. 593' }] }
	];

	it('drops a treaty’s kind, date and citation, which its title and lead already say', () => {
		expect(withoutRepeats(treaty, ['Treaty with the Cheyenne and Arapaho (1867)', 'Treaty with the Cheyenne and Arapaho, Oct. 28, 1867, 15 Stat. 593'])).toEqual([]);
	});

	it('keeps an executive order’s President, which its lead does not name', () => {
		const order = [
			{ field: 'kind', label: 'Kind', items: [{ text: 'Executive order' }] },
			{ field: 'number', label: 'Number', items: [{ text: '8473' }] },
			{ field: 'president', label: 'President', items: [{ text: 'Franklin D. Roosevelt' }] }
		];
		expect(withoutRepeats(order, ['Executive Order 8473', 'Exec. Order No. 8473 (July 8, 1940)']).map((group) => group.field)).toEqual(['president']);
	});

	it('keeps a fact with its own source, even when the lead says the same', () => {
		const groups = [{ field: 'nation', label: 'Nation', items: [{ text: 'Navajo Nation', citations: [{ number: 1 }] }] }];
		expect(withoutRepeats(groups, ['A Tribal court of the Navajo Nation.'])).toHaveLength(1);
	});

	it('matches whole words only, and never a short number inside a sentence', () => {
		const groups = [
			{ field: 'vote', label: 'Vote', items: [{ text: '5–1' }] },
			{ field: 'kind', label: 'Kind', items: [{ text: 'Treaty' }] }
		];
		expect(withoutRepeats(groups, ['Named in 5–1 votes', 'Treaties of 1867']).map((group) => group.field)).toEqual(['vote', 'kind']);
	});

	it('reads curly and straight quotes alike', () => {
		const groups = [{ field: 'case', label: 'Case', items: [{ text: 'Johnson v. M’Intosh' }] }];
		expect(withoutRepeats(groups, ["Decided in Johnson v. M'Intosh (1823)."])).toEqual([]);
	});
});
