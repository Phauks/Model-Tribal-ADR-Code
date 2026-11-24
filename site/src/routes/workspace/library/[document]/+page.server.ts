import { error, redirect } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	libraryDocument,
	libraryPages,
	pagePlace,
	passagePlace,
	passagesPerScreen
} from '#lib/server/source-library.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// One document of the source library, read passage by passage with the page
// each passage is on. "?passage=N" opens at a search result, "?page=N" at a
// PDF page, "?label=X" at a printed or reporter star page, "?from=N" at the
// Nth passage.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'search-source-library');
	const database = workerEnvironment().sourceLibrary;
	if (!database) error(503, 'The source library is not connected.');
	const documentIdentifier = Number.parseInt(event.params.document, 10);
	if (!Number.isSafeInteger(documentIdentifier) || documentIdentifier < 1) error(404, 'There is no such document in the library.');

	const parameters = event.url.searchParams;
	const passage = Number.parseInt(parameters.get('passage') ?? '', 10);
	if (Number.isSafeInteger(passage)) {
		const place = await passagePlace(database, passage);
		if (place && place.documentId !== documentIdentifier) redirect(303, `/workspace/library/${place.documentId}?passage=${passage}`);
	}

	const document = await libraryDocument(database, documentIdentifier);
	if (!document) error(404, 'There is no such document in the library.');

	let from = Math.max(1, Number.parseInt(parameters.get('from') ?? '1', 10) || 1);
	let highlight: number | null = null;
	if (Number.isSafeInteger(passage)) {
		const place = await passagePlace(database, passage);
		if (place) {
			highlight = passage;
			from = Math.max(1, place.sequence - 2);
		}
	} else if (parameters.has('page') || parameters.has('label')) {
		const pageNumber = Number.parseInt(parameters.get('page') ?? '', 10);
		const sequence = await pagePlace(
			database,
			documentIdentifier,
			Number.isSafeInteger(pageNumber) ? { number: pageNumber } : { label: (parameters.get('label') ?? '').slice(0, 40) }
		);
		if (sequence !== null) from = sequence;
	}
	const pages = await libraryPages(database, documentIdentifier, from);
	const query = (parameters.get('q') ?? '').slice(0, 500);
	return { document, pages, from, highlight, query, perScreen: passagesPerScreen };
};
