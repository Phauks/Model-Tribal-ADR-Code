import { error } from '@sveltejs/kit';
import { familyPage, languageFamilies } from '#lib/server/languages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => languageFamilies().map((family) => ({ family: family.slug }));

export const load: PageServerLoad = ({ params }) => {
	const page = familyPage(params.family);
	if (!page) error(404, 'This site has no page for that language family.');
	return page;
};
