import { federalHome } from '#lib/server/federal-home.ts';
import type { PageServerLoad } from './$types';

// How many documents each maker of federal law made in each decade (federal-home.ts); it left the Federal law home, which is for finding the way only (Trevor, Nov. 28, 2026), and Data and charts links here.
export const load: PageServerLoad = () => ({ home: federalHome() });
