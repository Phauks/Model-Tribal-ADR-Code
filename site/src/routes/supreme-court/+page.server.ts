import { peopleIndex } from '#lib/server/justice-pages.ts';
import { courtsWithPages } from '#lib/server/supreme-court-pages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ courts: courtsWithPages(), ...peopleIndex() });
