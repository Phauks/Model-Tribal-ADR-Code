import { error } from '@sveltejs/kit';
import { glossary } from '#lib/server/content.ts';
import { Notes, renderMarkdown } from '#lib/server/markdown.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => glossary().map((entry) => ({ id: entry.id }));

export const load: PageServerLoad = ({ params }) => {
	const all = glossary();
	const entry = all.find((candidate) => candidate.id === params.id);
	if (!entry) error(404, 'No glossary entry has this address.');

	const notes = new Notes();
	const definition = renderMarkdown(entry.definition, notes);
	const usageNote = entry.usage_note ? renderMarkdown(entry.usage_note, notes) : undefined;
	const termOf = (id: string) => ({ id, term: all.find((other) => other.id === id)?.term ?? id });

	return {
		entry: {
			id: entry.id,
			term: entry.term,
			kind: entry.kind,
			expansion: entry.expansion,
			usage: entry.usage,
			basis: entry.basis,
			status: entry.status ?? 'draft',
			aliases: entry.aliases ?? []
		},
		definition,
		usageNote,
		useInstead: (entry.use_instead ?? []).map(termOf),
		seeAlso: (entry.see_also ?? []).map(termOf),
		notes: notes.list
	};
};
