import { navigationCounts } from "#lib/server/navigation-counts.ts";
import type { PageServerLoad } from "./$types";

// The Courts and cases section's own page (SectionHome.svelte), with each page's count.
export const load: PageServerLoad = () => ({ counts: navigationCounts() });
