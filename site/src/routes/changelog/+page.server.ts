import { readChangelog } from '#lib/server/content.ts';
import { renderChangelog } from '#lib/server/markdown.ts';
import type { PageServerLoad } from './$types';

// The three changelogs are written by release pull requests from commit
// messages (decision record 0003); this page only renders them.
export const load: PageServerLoad = () => ({
	tracks: [
		{ id: 'content', title: 'Content', html: renderChangelog(readChangelog('content')) },
		{ id: 'website', title: 'Website', html: renderChangelog(readChangelog('site')) },
		{ id: 'print', title: 'Print edition', html: renderChangelog(readChangelog('pdf')) }
	]
});
