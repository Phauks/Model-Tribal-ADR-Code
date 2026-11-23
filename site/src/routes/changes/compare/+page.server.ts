import { error } from '@sveltejs/kit';
import { storageForPages } from '#lib/server/essay-pages.ts';
import { compareVersions } from '#lib/server/page-history.ts';
import { builtPages } from '#lib/server/page-history-run.ts';
import type { PageServerLoad } from './$types';

// Two versions of one page, chosen on its history, compared: the older on the left.
export const prerender = false;

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const from = url.searchParams.get('from') ?? '';
	const to = url.searchParams.get('to') ?? '';
	if (!from || !to) error(400, 'Choose two versions to compare.');
	const { database, bucket } = storageForPages();
	const found = await compareVersions(database, bucket, from, to, await builtPages());
	if (!found) error(404, 'These two versions are not of the same page.');
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return found;
};
