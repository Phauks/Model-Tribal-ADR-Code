import { publishedGlossary } from '#lib/server/glossary-entries.ts';
import type { PageOutline } from '#lib/site-sections.ts';
import type { LayoutServerLoad } from './$types';

// The sidebar's outline for the Glossary: every published term, A to Z.
export const load: LayoutServerLoad = () => ({
	outline: {
		items: publishedGlossary()
			.map((record) => ({ label: record.term, link: `/glossary/${record.id}` }))
			.sort((first, second) => first.label.localeCompare(second.label, 'en-US'))
	} satisfies PageOutline as PageOutline
});
