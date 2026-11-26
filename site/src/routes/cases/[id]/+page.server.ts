import type { CasePage } from '#lib/server/case-pages.ts';
import { builtPageData } from '#lib/server/page-data.ts';
import type { PageServerLoad } from './$types';

// Drawn by the Worker when a reader opens it, from the page's data as built
// (src/lib/server/page-data.ts, src/routes/page-data).
export const prerender = false;

export const load: PageServerLoad = ({ params, url }) => builtPageData<CasePage>('cases', params.id, url);
