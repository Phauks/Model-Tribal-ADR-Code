import { glossaryEntryViews, publishedGlossary } from '#lib/server/glossary-entries.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	const { entries, sources } = glossaryEntryViews(publishedGlossary());

	// Group by first letter for an A to Z index that leaves empty letters unlinked (DESIGN.md, section 3).
	const groups = new Map<string, typeof entries>();
	for (const entry of entries) {
		const letter = entry.term.normalize('NFD').charAt(0).toLocaleUpperCase('en-US');
		const key = /[A-Z]/.test(letter) ? letter : '#';
		groups.set(key, [...(groups.get(key) ?? []), entry]);
	}
	return {
		groups: [...groups.entries()].map(([letter, items]) => ({ letter, items })),
		count: entries.length,
		sources
	};
};
