import { offlineSetSummary } from '#lib/server/copy-lists.ts';
import type { PageServerLoad } from './$types';

// The size of the United States documents ZIP, for the list of downloads.
export const load: PageServerLoad = () => {
	const summary = offlineSetSummary();
	return { federalDocuments: summary.federal };
};
