import { error } from '@sveltejs/kit';
import { forms } from 'virtual:forms';
import { formHtml, type FormAnswers } from '#lib/forms.ts';
import { formSubmission } from '#lib/server/form-submissions.ts';
import { isRequestReference } from '#lib/server/identifiers.ts';
import { requestByReference } from '#lib/server/request-store.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

/**
 * A form filled in online, shown with its answers. Shown only while the site
 * still has the exact version signed; otherwise the request page offers the
 * stored copy to download.
 */
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'read-requests');
	const { database } = storage(event);
	if (!isRequestReference(event.params.reference)) error(404, 'No request has this reference.');
	const found = await requestByReference(database, event.params.reference);
	if (!found) error(404, 'No request has this reference.');
	const submission = await formSubmission(database, found.request.identifier, event.params.submission);
	if (!submission?.answers) error(404, 'No form filled in online has this identifier.');
	const template = forms.find((form) => form.slug === submission.form);
	if (!template || template.checksum !== submission.formChecksum) {
		error(404, 'The site no longer has this version of the form. Download the stored copy from the request page.');
	}
	return {
		reference: found.request.reference,
		title: template.title,
		version: submission.formVersion,
		signedName: submission.signedName,
		signedAt: submission.signedAt,
		hasCopy: submission.filledCopyKey !== null,
		identifier: submission.identifier,
		html: formHtml(template, 'filled', JSON.parse(submission.answers) as FormAnswers)
	};
};
