import { programSummaries } from '#lib/server/federal-programs.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ programs: programSummaries() });
