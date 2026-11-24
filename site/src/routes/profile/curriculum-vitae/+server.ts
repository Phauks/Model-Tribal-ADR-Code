import { error } from '@sveltejs/kit';
import { profileBySubject } from '#lib/server/contributor-profiles.ts';
import { openScannedFile } from '#lib/server/file-scans.ts';
import { documentResponse } from '#lib/server/profile-documents.ts';
import { requireAccount, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/** The signed-in person's own CV, once the virus check passes (site/SCANNING.md). */
export const GET: RequestHandler = async (event) => {
	const account = requireAccount(event);
	const { database, bucket } = storage(event);
	const profile = await profileBySubject(database, account.subject);
	const opened = profile?.curriculumVitaeKey ? await openScannedFile(database, bucket, profile.curriculumVitaeKey) : null;
	if (!opened || opened.state === 'missing') error(404, 'You have no CV.');
	if (opened.state === 'held') error(409, 'Your CV is still being checked for viruses. Try again in a minute.');
	return documentResponse(opened.object, profile!.curriculumVitaeName);
};
