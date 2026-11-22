/** One short list of the copies this site serves (src/lib/server/copy-lists.ts). */
import { error } from '@sveltejs/kit';
import { copyGroups, copyRows, groupTitle } from '#lib/server/copy-lists.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => copyGroups().map((group) => ({ group: group.slug }));

export const load: PageServerLoad = ({ params }) => {
	const copies = copyRows(params.group);
	if (copies.length === 0) error(404, 'There is no such list of copies.');
	return { title: groupTitle(params.group), copies };
};
