import { copyGroups } from '#lib/server/copy-lists.ts';
import type { PageServerLoad } from './$types';

// How many copies of documents the site holds, by kind, for the Library page.
export const load: PageServerLoad = () => {
	let federal = 0;
	let nations = 0;
	let opinions = 0;
	for (const group of copyGroups()) {
		if (group.slug.startsWith('opinions-')) opinions += group.count;
		else if (group.title.startsWith('Nations’')) nations += group.count;
		else federal += group.count;
	}
	return { copies: { federal, nations, opinions } };
};
