import { advanceCheckedUploads, intakeFilesOf, settlePulledFiles } from '#lib/server/uploads.ts';
import { requireAccount, requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// Intake (docs/uploads.md, "Intake"): files for the research library, sent
// with no questions and filed by scripts/captures/mirror_captures.py intake.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'review-uploads');
	const account = requireAccount(event);
	const { database, bucket } = storage(event);
	await advanceCheckedUploads(database, bucket, { accountIdentifier: account.subject });
	await settlePulledFiles(database, bucket);
	return { earlier: await intakeFilesOf(database, account.subject) };
};
