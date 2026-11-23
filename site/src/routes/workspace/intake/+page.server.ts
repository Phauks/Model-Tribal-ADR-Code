import { advanceCheckedUploads, intakeFilesOf, settlePulledFiles } from '#lib/server/uploads.ts';
import { requireAccount, requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// Intake (docs/uploads.md, "Intake"): files for the research library, sent
// with no questions and filed by scripts/captures/mirror_captures.py intake.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'review-uploads');
	const account = requireAccount(event);
	const { database, bucket } = storage(event);
	// Each round moves up to 50 checked files on; a large batch takes a few.
	for (let round = 0; round < 4; round++) {
		if ((await advanceCheckedUploads(database, bucket, { accountIdentifier: account.subject })) === 0) break;
	}
	await settlePulledFiles(database, bucket);
	return { earlier: await intakeFilesOf(database, account.subject) };
};
