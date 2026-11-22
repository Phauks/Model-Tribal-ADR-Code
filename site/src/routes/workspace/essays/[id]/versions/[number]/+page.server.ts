import { error } from '@sveltejs/kit';
import { essayDateTime } from '#lib/essays/dates.ts';
import { readVersionText, version } from '#lib/server/essays.ts';
import { essayAccess } from '#lib/server/essay-workspace.ts';
import { renderedVersion } from '#lib/server/essay-pages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { identifier, database, bucket } = await essayAccess(event, 'comment');
	const row = await version(database, identifier, Number(event.params.number));
	if (!row) error(404, 'No saved version has this number.');
	const rendered = await renderedVersion(bucket, row);
	return {
		identifier,
		number: row.number,
		at: essayDateTime(row.created_at),
		by: row.person_name ?? 'Someone',
		note: row.note,
		sha256: row.sha256,
		markdown: await readVersionText(bucket, row),
		...rendered
	};
};
