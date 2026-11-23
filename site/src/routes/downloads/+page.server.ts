import { offlineSetSummary } from '#lib/server/copy-lists.ts';
import type { PageServerLoad } from './$types';

// The size of the United States documents ZIP and how many nations have documents, for the list of downloads.
export const load: PageServerLoad = () => {
	const summary = offlineSetSummary();
	return { federalDocuments: summary.federal, nationsWithDocuments: Object.keys(summary.nations).length };
};
