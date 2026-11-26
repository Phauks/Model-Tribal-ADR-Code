import { courtListings } from '#lib/server/courts.ts';
import type { PageServerLoad } from './$types';

export const prerender = true;

export const load: PageServerLoad = () => ({ courts: courtListings() });
