import { caseKeys, casePage } from '#lib/server/case-pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// Built with the site from the case records and the essays in git, like the Supreme Court pages.
export const prerender = true;

export const entries: EntryGenerator = () => caseKeys().map((id) => ({ id }));

export const load: PageServerLoad = ({ params }) => casePage(params.id);
