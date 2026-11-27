import { titlePage } from '#lib/server/code-outline.ts';
import type { PageServerLoad } from './$types';

// Title 25 of the United States Code: its chapters, built with the site (src/lib/server/code-outline.ts).
export const load: PageServerLoad = () => titlePage();
