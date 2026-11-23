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

/** Titles mode shows at most this many documents. */
const titlesShown = 50;

// Search the source library (decision record 0051): every passage of every
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
	const nothing = { search: null, titles: null, failed: false, milliseconds: null };
	if (!status.build) return { status, filters, mode, titlesShown, topics: [], ...nothing };
	const topics = await libraryTopics(database);
	if (filters.query === '') return { status, filters, mode, titlesShown, topics, ...nothing };

	// The page shows how long the search took, and says so plainly when the
	// search could not finish instead of showing an error page.
	const started = Date.now();
	try {
		const titles = mode === 'titles' ? await findLibraryDocuments(database, filters.query, titlesShown) : null;
		const search = mode === 'titles' ? null : await searchLibrary(database, filters);
		return { status, filters, mode, titlesShown, topics, search, titles, failed: false, milliseconds: Date.now() - started };
	} catch (problem) {
		console.error('The source library search failed:', problem);
		return { status, filters, mode, titlesShown, topics, ...nothing, failed: true };
	}
};
