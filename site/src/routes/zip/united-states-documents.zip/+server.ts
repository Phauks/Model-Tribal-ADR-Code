/**
 * Every United States document this site holds, as one ZIP file, streamed from the private bucket
 * (src/lib/server/document-zips.ts). Trevor asked for it on Nov. 23, 2026.
 */
import { error } from '@sveltejs/kit';
import { publicCopies } from 'virtual:public-copies';
import { citationDate } from '#lib/page-downloads.ts';
import { documentsReadme, documentsZip } from '#lib/server/document-zips.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { DocumentSetList } from '#lib/offline-documents.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const served = new Set(publicCopies.map((copy) => copy.key));

export const GET: RequestHandler = async ({ url }) => {
	const environment = workerEnvironment();
	const response = await environment.ASSETS?.fetch(new URL('/copies/offline/federal.json', url).toString());
	if (!environment.sourceDocuments || !response?.ok) error(503, 'The documents cannot be gathered right now.');
	const list = (await response.json()) as DocumentSetList;
	const readme = documentsReadme(list.title, url.origin, citationDate(new Date()));
	return new Response(documentsZip(list, environment.sourceDocuments, served, readme), {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': 'attachment; filename="united-states-documents.zip"',
			'cache-control': 'no-store'
		}
	});
};
