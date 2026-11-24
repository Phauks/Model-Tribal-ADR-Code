/**
 * The original file of a source library document, for the writing team. Only
 * a key the library lists for that document is served, never any other object
 * in the bucket. A PDF opens in the browser; anything else, such as a saved web
 * page, is downloaded, so nothing from a saved page runs on this site.
 */
import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import { libraryDocument } from '#lib/server/source-library.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async (event) => {
	requirePermission(event, 'search-source-library');
	const { sourceLibrary, sourceDocuments } = workerEnvironment();
	if (!sourceLibrary || !sourceDocuments) error(503, 'The source library is not connected.');
	const documentIdentifier = Number.parseInt(event.params.document, 10);
	const document = Number.isSafeInteger(documentIdentifier) ? await libraryDocument(sourceLibrary, documentIdentifier) : null;
	if (!document) error(404, 'There is no such document in the library.');

	const object = await sourceDocuments.get(document.key);
	if (!object) error(404, 'The file is not in the bucket.');
	const isPdf = document.mediaType === 'application/pdf' || document.key.toLowerCase().endsWith('.pdf');
	const name = (document.key.split('/').at(-1) ?? 'document').replace(/[^A-Za-z0-9._-]/g, '_');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'Content-Type': isPdf ? 'application/pdf' : 'application/octet-stream',
			'Content-Disposition': `${isPdf ? 'inline' : 'attachment'}; filename="${name}"`,
			'Content-Length': String(object.size),
			'Cache-Control': 'private, no-store',
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': 'sandbox',
			'X-Robots-Tag': 'noindex, nofollow'
		}
	});
};
