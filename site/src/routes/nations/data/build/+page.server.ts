import { builderDatasetSummaries } from '#lib/server/table-builder-datasets.ts';
import type { PageServerLoad } from './$types';

// The dataset menu; the chosen dataset itself is fetched by the browser from /nations/data/build/<dataset>.json.
export const load: PageServerLoad = () => ({ datasets: builderDatasetSummaries() });
