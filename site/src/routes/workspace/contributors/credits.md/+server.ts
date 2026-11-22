import { creditsPage } from '#lib/credits-export.ts';
import { confirmedCredits } from '#lib/server/contributor-profiles.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/**
 * The book's Credits page as a file, for the print build: the lead author
 * downloads it before an edition and it is saved as
 * content/front-matter/credits.md (docs/contributor-profiles.md).
 */
export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'manage-contributors');
	const { database } = storage(event);
	const today = new Date().toISOString().slice(0, 10);
	const page = creditsPage(await confirmedCredits(database), today);
	return new Response(page, {
		headers: {
			'content-type': 'text/markdown; charset=utf-8',
			'content-disposition': 'attachment; filename="credits.md"',
			'cache-control': 'no-store'
		}
	});
};
