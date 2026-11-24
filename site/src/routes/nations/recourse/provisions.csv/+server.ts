import { recourseCsv } from '#lib/recourse.ts';
import { recourseRows } from '#lib/server/recourse.ts';
import type { RequestHandler } from './$types';
import { csvResponse } from '#lib/csv.ts';

// Every row of the Find recourse page as one CSV file, for the Download menu
// and for readers without scripts. Addresses are written from the site's
// root, since the file is built before the site has a domain.
export const prerender = true;

export const GET: RequestHandler = () => csvResponse(recourseCsv(recourseRows()), { fileName: 'dispute-resolution-provisions.csv' });
