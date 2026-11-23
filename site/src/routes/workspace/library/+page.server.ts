import { error } from '@sveltejs/kit';
import { workerEnvironment } from '#lib/server/environment.ts';
import {
	findLibraryDocuments,
	libraryStatus,
	libraryTopics,
	searchLibrary,
	type LibraryFilters
} from '#lib/server/source-library.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// Search the source library (decision record 0049): every passage of every
// document in the private bucket. The writing team only, since the library
// holds private copies.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'search-source-library');
	const database = workerEnvironment().sourceLibrary;
	if (!database) error(503, 'The source library is not connected.');

	const parameters = event.url.searchParams;
	const text = (name: string, maximum = 200) => (parameters.get(name) ?? '').normalize('NFC').trim().slice(0, maximum);
	const filters: LibraryFilters = {
		query: text('q', 500),
		nation: text('nation') || undefined,
		topic: text('topic') || undefined,
		format: ['pdf', 'html', 'plain', 'word'].includes(text('format')) ? text('format') : undefined,
		served: parameters.get('served') === '1',
		page: Math.min(Math.max(Number.parseInt(parameters.get('page') ?? '0', 10) || 0, 0), 50)
	};
	const mode = parameters.get('mode') === 'titles' ? 'titles' : 'passages';

	const status = await libraryStatus(database);
	if (!status.build) {
		return { status, filters, mode, topics: [], search: null, titles: null };
	}
	const topics = await libraryTopics(database);
	if (filters.query === '') return { status, filters, mode, topics, search: null, titles: null };
	if (mode === 'titles') {
		return { status, filters, mode, topics, search: null, titles: await findLibraryDocuments(database, filters.query, 50) };
	}
	return { status, filters, mode, topics, search: await searchLibrary(database, filters), titles: null };
};
