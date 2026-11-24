import { casePage } from '#lib/server/case-pages.ts';
import { sources } from '#lib/server/content.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// Built with the site from the case records, like the Supreme Court pages.
export const prerender = true;

export const entries: EntryGenerator = () =>
	[...sources().values()].filter((record) => (record.citation as { type?: string }).type === 'legal_case' && record.citation.title).map((record) => ({ id: record.key }));

export const load: PageServerLoad = ({ params }) => casePage(params.id);
