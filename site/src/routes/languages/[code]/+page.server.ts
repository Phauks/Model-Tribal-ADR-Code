import { error } from '@sveltejs/kit';
import { languageMap } from '#lib/server/language-map.ts';
import { languagePage, languages } from '#lib/server/languages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => languages().map((language) => ({ code: language.tag }));

export const load: PageServerLoad = ({ params }) => {
	const page = languagePage(params.code, languageMap);
	if (!page) error(404, 'This site has no page for that language.');
	return page;
};
