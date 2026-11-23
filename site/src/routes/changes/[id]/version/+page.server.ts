import { error } from '@sveltejs/kit';
import { storageForPages } from '#lib/server/essay-pages.ts';
import { versionText } from '#lib/server/page-history.ts';
import { builtPages } from '#lib/server/page-history-run.ts';
import type { PageServerLoad } from './$types';

// A page's text as one change left it. Only for pages whose earlier wording
// may be shown, and never for a hidden version.
export const prerender = false;

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const { database, bucket } = storageForPages();
	const found = await versionText(database, bucket, params.id, await builtPages());
	if (!found) error(404, 'No change has this address.');
	if (found.text === undefined) error(404, 'This version cannot be shown.');
	setHeaders({ 'cache-control': 'public, max-age=300' });
	const blocks = found.text
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter(Boolean)
		.map((block) => {
			const heading = /^(#{1,6})\s+(.*)$/s.exec(block);
			return heading ? { level: Math.min(heading[1].length + 1, 6), text: heading[2] } : { level: 0, text: block };
		});
	return { change: found.change, blocks };
};
