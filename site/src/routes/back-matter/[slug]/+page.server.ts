import { essayPage } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ params }) => essayPage('back-matter', params.slug);
