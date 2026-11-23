import { error } from '@sveltejs/kit';
import { storageForPages } from '#lib/server/essay-pages.ts';
import { changeDetail } from '#lib/server/page-history.ts';
import { builtPages } from '#lib/server/page-history-run.ts';
import type { PageServerLoad } from './$types';

// One change: what it changed, compared with the version before it. Nation
// pages and stories show only which parts changed.
export const prerender = false;

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const { database, bucket } = storageForPages();
	const detail = await changeDetail(database, bucket, params.id, await builtPages());
	if (!detail) error(404, 'No change has this address.');
	setHeaders({ 'cache-control': 'public, max-age=60' });
	return detail;
};
