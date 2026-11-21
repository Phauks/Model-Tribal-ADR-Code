import { glossary } from '#lib/server/content.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const entries = glossary()
		.filter((entry) => entry.status !== 'retired')
		.map((entry) => ({
			id: entry.id,
			term: entry.term,
			expansion: entry.expansion,
			usage: entry.usage
		}));

	// Group by first letter for an A to Z index that leaves empty letters unlinked (DESIGN.md, section 3).
	const groups = new Map<string, typeof entries>();
	for (const entry of entries) {
		const letter = entry.term
			.normalize('NFD')
			.charAt(0)
			.toLocaleUpperCase('en-US');
		const key = /[A-Z]/.test(letter) ? letter : '#';
		groups.set(key, [...(groups.get(key) ?? []), entry]);
	}
	return { groups: [...groups.entries()].map(([letter, items]) => ({ letter, items })) };
};
