/**
 * Serves a prepared book's interior or cover to Lulu, which downloads the
 * files from links given in the print job (docs/book-orders.md). Each link
 * carries a key made with the bookFileLinkKey secret for that one file, so the
 * private bucket is not opened to anyone else.
 */
import { error } from '@sveltejs/kit';
import { isFileLinkKey, isFileSetIdentifier, orderingState, type BookFile } from '#lib/server/book-orders.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { storedSecret } from '#lib/server/stored-secrets.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const files: BookFile[] = ['interior.pdf', 'cover.pdf'];

export const GET: RequestHandler = async ({ params, url }) => {
	const environment = workerEnvironment();
	const state = orderingState(environment);
	if (!state.open) error(404, 'Not found');

	const parts = params.path.split('/');
	const file = parts.pop() as BookFile;
	const fileSet = parts.join('/');
	if (!files.includes(file) || !isFileSetIdentifier(fileSet)) error(404, 'Not found');
	const signingKey = await storedSecret(state.settings.fileLinkSecret);
	if (!signingKey || !(await isFileLinkKey(signingKey, fileSet, file, url.searchParams.get('key')))) error(404, 'Not found');

	const object = await environment.sourceDocuments.get(`books/${fileSet}/${file}`);
	if (!object) error(404, 'Not found');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': 'application/pdf',
			'content-length': String(object.size),
			'content-disposition': `attachment; filename="${file}"`
		}
	});
};
