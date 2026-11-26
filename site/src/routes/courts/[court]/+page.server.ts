import { courtPage, courts } from '#lib/server/courts.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// Built with the site from the opinions and case records that name each court (src/lib/server/courts.ts).
export const prerender = true;

export const entries: EntryGenerator = () => courts().map((court) => ({ court: court.key }));

export const load: PageServerLoad = ({ params }) => courtPage(params.court);
