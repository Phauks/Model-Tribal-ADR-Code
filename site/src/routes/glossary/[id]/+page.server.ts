import { error } from '@sveltejs/kit';
import {
	entriesLinkingTo,
	glossaryEntryViews,
	publishedGlossary
} from '#lib/server/glossary-entries.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => publishedGlossary().map((entry) => ({ id: entry.id }));

export const load: PageServerLoad = ({ params }) => {
	const record = publishedGlossary().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No glossary entry has this address.');

	const {
		entries: [entry],
		sources
	} = glossaryEntryViews([record]);
	return { entry, sources, linkedFrom: entriesLinkingTo(record.id) };
};
