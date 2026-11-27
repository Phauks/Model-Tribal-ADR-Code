import { federalHome } from '#lib/server/federal-home.ts';
import { navigationCounts } from '#lib/server/navigation-counts.ts';
import type { PageServerLoad } from './$types';

// The Federal law section's own page: its menu's groups as picture cards (SectionCards.svelte), each link's count, each group's years and the decade chart (federal-home.ts).
export const load: PageServerLoad = () => ({ counts: navigationCounts(), home: federalHome() });
