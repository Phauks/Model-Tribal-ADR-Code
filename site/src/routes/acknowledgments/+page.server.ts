import { frontMatterView } from '#lib/server/front-matter.ts';
import type { PageServerLoad } from './$types';

// The same text the book prints as its Acknowledgments page.
export const load: PageServerLoad = () => frontMatterView('acknowledgments');
