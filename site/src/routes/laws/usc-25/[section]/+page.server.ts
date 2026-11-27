import type { SectionPageData } from '#lib/server/law-pages.ts';
import { builtPageData } from '#lib/server/page-data.ts';
import type { PageServerLoad } from './$types';

// One section of Title 25, drawn by the Worker when a reader opens it, from
// the page's data as built (src/lib/server/code-outline.ts, src/routes/page-data).
export const prerender = false;

export const load: PageServerLoad = ({ params, url }) => builtPageData<SectionPageData>('sections', params.section, url);
