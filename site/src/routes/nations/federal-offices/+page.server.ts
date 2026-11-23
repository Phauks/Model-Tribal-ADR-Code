import { officeSummaries } from '#lib/server/federal-offices.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => officeSummaries();
