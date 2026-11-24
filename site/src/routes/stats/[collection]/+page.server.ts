import { error } from '@sveltejs/kit';
import { collectionCounts, collections, listedCollections } from '#lib/server/collections.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// One list for each collection the Statistics page counts, so a reader can see what makes up each number (Trevor, Nov. 24, 2026).
export const entries: EntryGenerator = () => listedCollections().map(({ identifier }) => ({ collection: identifier }));

export const load: PageServerLoad = ({ params }) => {
	const collection = collections.find((candidate) => candidate.identifier === params.collection && !candidate.list);
	if (!collection) error(404, 'Statistics has no collection by that name.');
	const counted = collectionCounts().find((candidate) => candidate.identifier === collection.identifier);
	return {
		identifier: collection.identifier,
		title: collection.title,
		group: collection.group,
		detailHeader: collection.detailHeader,
		years: counted?.years,
		heldBack: counted?.heldBack,
		heldBackReason: counted?.heldBackReason,
		items: collection.items()
	};
};
