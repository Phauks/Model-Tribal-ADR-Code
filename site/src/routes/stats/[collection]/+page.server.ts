import { error } from '@sveltejs/kit';
import { collectionCounts, collections, holdingOf, listedCollections } from '#lib/server/collections.ts';
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
		related: collection.related,
		years: counted?.years,
		heldBack: counted?.heldBack,
		heldBackReason: counted?.heldBackReason,
		breakdown: counted?.breakdown,
		copyColumns: counted?.copyColumns,
		// Each item's copies go to the page as numbers only: documents, their pages and saved web pages (Trevor, Nov. 27, 2026).
		items: collection.items().map(({ copies, ...item }) => {
			const holding = copies ? holdingOf(copies) : undefined;
			return holding ? { ...item, holding } : item;
		})
	};
};
