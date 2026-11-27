/**
 * One nation's constitutions, laws and court opinions that this site holds, as a ZIP file, streamed from the
 * private bucket (src/lib/server/document-zips.ts). Offered on the nation's page. Trevor asked for
 * it on Nov. 23, 2026. Copies the nation chose to cite only are listed in documents.csv without the file, and
 * copies it chose to hide are left out altogether (src/lib/nation-restrictions.ts).
 */
import { error } from '@sveltejs/kit';
import { datedName } from '#lib/download-names.ts';
import { citationDate } from '#lib/page-downloads.ts';
import { documentsReadme, documentsZip, keyOfCopyPath } from '#lib/server/document-zips.ts';
import { servedCopies } from '#lib/server/copy-list.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { copyLevels } from '#lib/server/nation-restrictions.ts';
import type { DocumentSetList } from '#lib/offline-documents.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async ({ params, url }) => {
	if (!/^[a-z0-9-]+$/.test(params.id)) error(404, 'No nation has that identifier.');
	const environment = workerEnvironment();
	const response = await environment.ASSETS?.fetch(new URL(`/copies/offline/nations/${params.id}.json`, url).toString());
	if (response?.status === 404) error(404, 'This site holds no copies of that nation’s documents.');
	if (!environment.sourceDocuments || !response?.ok) error(503, 'The documents cannot be gathered right now.');
	const full = (await response.json()) as DocumentSetList;
	const copies = [...(await servedCopies(full.files.map(([path]) => keyOfCopyPath(path)))).values()];
	const levels = await copyLevels(environment.database, copies);
	const list: DocumentSetList = { ...full, files: full.files.filter(([path]) => levels.get(keyOfCopyPath(path)) !== 'hide') };
	const served = new Set(copies.filter((copy) => !levels.has(copy.key)).map((copy) => copy.key));
	const now = new Date();
	const readme = documentsReadme(`${list.title}: constitutions, laws and court opinions`, url.origin, citationDate(now));
	return new Response(documentsZip(list, environment.sourceDocuments, served, readme), {
		headers: {
			'content-type': 'application/zip',
			// Named for the day it was put together (src/lib/download-names.ts).
			'content-disposition': `attachment; filename="${datedName(`${params.id}-documents.zip`, now)}"`,
			'cache-control': 'no-store'
		}
	});
};
