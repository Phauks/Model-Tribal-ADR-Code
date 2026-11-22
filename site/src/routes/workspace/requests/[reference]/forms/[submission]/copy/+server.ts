import { error } from '@sveltejs/kit';
import { formSubmission } from '#lib/server/form-submissions.ts';
import { isRequestReference } from '#lib/server/identifiers.ts';
import { requestByReference } from '#lib/server/request-store.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/**
 * Downloads the copy of a form filled in online, as stored when it was sent,
 * for editors only. Always a download, never shown as a page of the site.
 */
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'read-requests');
	const { database, bucket } = storage(event);
	if (!isRequestReference(event.params.reference)) error(404, 'No request has this reference.');
	const found = await requestByReference(database, event.params.reference);
	if (!found) error(404, 'No request has this reference.');
	const submission = await formSubmission(database, found.request.identifier, event.params.submission);
	if (!submission?.filledCopyKey) error(404, 'No stored copy.');
	const object = await bucket.get(submission.filledCopyKey);
	if (!object) error(404, 'The copy is no longer stored.');
	const name = `${found.request.reference}-${submission.form}-${submission.formVersion}.md`;
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': 'text/markdown; charset=utf-8',
			'content-disposition': `attachment; filename="${name}"`,
			'x-content-type-options': 'nosniff',
			'cache-control': 'no-store'
		}
	});
};
