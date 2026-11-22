import { essayHistory } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ params }) => essayHistory('back-matter', params.slug);
