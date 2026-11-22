import { error } from '@sveltejs/kit';
import { atLeast } from '#lib/permissions.ts';
import { essayDateTime } from '#lib/essays/dates.ts';
import { essayPath, essayRow, latestVersion, readVersionText } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { syncEssaysFromGitOnce } from '#lib/server/essay-git-sync.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { identifier, database, bucket, level } = await essayAccess(event, 'comment');
	const outcome = (await syncEssaysFromGitOnce(database, bucket)).find((candidate) => candidate.identifier === identifier);
	const essay = await essayRow(database, identifier);
	const latest = await latestVersion(database, identifier);
	if (!essay || !latest) error(404, 'No essay has this address yet.');
	return {
		identifier,
		page: essayPath(identifier, essay.part),
		canEdit: atLeast(level, 'contribute'),
		version: latest.number,
		savedAt: essayDateTime(latest.created_at),
		title: latest.title,
		text: await readVersionText(bucket, latest),
		gitConflict: outcome?.state === 'conflict' ? outcome.conflicts : 0
	};
};
