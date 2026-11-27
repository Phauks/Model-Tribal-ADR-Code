import { redirect } from '@sveltejs/kit';
import type { LawMoved, LawPage } from '#lib/server/law-pages.ts';
import { builtPageData } from '#lib/server/page-data.ts';
import type { PageServerLoad } from './$types';

// Drawn by the Worker when a reader opens it, from the page's data as built
// (src/lib/server/page-data.ts, src/routes/page-data).
export const prerender = false;

export const load: PageServerLoad = async ({ params, url }) => {
	const data = await builtPageData<LawPage | LawMoved>('laws', params.key, url);
	// A record of a single Title 25 section: every section has its own page now (src/lib/server/code-outline.ts).
	if ('movedTo' in data) redirect(308, data.movedTo);
	return data;
};
