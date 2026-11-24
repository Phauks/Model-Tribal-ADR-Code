import { lawKeys, lawPage } from '#lib/server/law-pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// Built with the site from the law records, like the case pages.
export const prerender = true;

export const entries: EntryGenerator = () => lawKeys().map((key) => ({ key }));

export const load: PageServerLoad = ({ params }) => lawPage(params.key);
