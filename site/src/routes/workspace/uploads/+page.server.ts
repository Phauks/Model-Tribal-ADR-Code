import { isOneOf, uploadKinds } from '#lib/uploads.ts';
import { advanceCheckedUploads, deleteOldUploads, queueCounts, queueViews, uploadQueue } from '#lib/server/uploads.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'review-uploads');
	const { database, bucket } = storage(event);
	const requestedView = event.url.searchParams.get('show');
	const view = isOneOf(queueViews, requestedView) ? requestedView : 'open';
	const requestedKind = event.url.searchParams.get('kind');
	const kind = isOneOf(uploadKinds, requestedKind) ? requestedKind : null;
	// Declined files are removed from the bucket 30 days after the decision (docs/uploads.md).
	const deleted = await deleteOldUploads(database, bucket);
	// Files whose virus check finished move into the queue, or are refused.
	await advanceCheckedUploads(database, bucket);
	return {
		view,
		kind,
		deleted,
		counts: await queueCounts(database),
		uploads: await uploadQueue(database, view, kind)
	};
};
