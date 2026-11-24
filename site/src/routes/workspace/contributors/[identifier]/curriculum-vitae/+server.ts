import { error } from '@sveltejs/kit';
import { profileByIdentifier } from '#lib/server/contributor-profiles.ts';
import { openScannedFile } from '#lib/server/file-scans.ts';
import { documentResponse } from '#lib/server/profile-documents.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/** A contributor's CV, for the lead author and editors, once the virus check passes (site/SCANNING.md). */
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'read-contributors');
	const { database, bucket } = storage(event);
	const profile = await profileByIdentifier(database, event.params.identifier);
	// A draft is private to the person until they send it.
	if (!profile || profile.status === 'draft' || !profile.curriculumVitaeKey) error(404, 'There is no CV.');
	const opened = await openScannedFile(database, bucket, profile.curriculumVitaeKey);
	if (opened.state === 'missing') error(404, 'There is no CV.');
	if (opened.state === 'held') error(409, 'This CV is still being checked for viruses, or the check held it.');
	return documentResponse(opened.object, profile.curriculumVitaeName);
};
