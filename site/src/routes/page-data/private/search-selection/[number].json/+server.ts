/**
 * The search results' records the Worker reads when a reader downloads several at once
 * (src/lib/server/search-selection.ts), spread over files by link (src/lib/built-files.ts,
 * searchSelectionFiles). Built with the site as private files, which the Worker answers "not found"
 * for when a reader asks (tools/nation-page-changes-worker.js); only its own ASSETS binding reads them.
 */
import { error, json } from '@sveltejs/kit';
import { searchSelectionFiles, spreadRecords } from '#lib/built-files.ts';
import { searchSelection } from '#lib/server/search-selection.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

let spread: ReturnType<typeof spreadRecords> | undefined;

export const entries: EntryGenerator = () => Array.from({ length: searchSelectionFiles.count }, (_, number) => ({ number: String(number) }));

export const GET: RequestHandler = ({ params }) => {
	const number = Number(params.number);
	if (!Number.isInteger(number) || number < 0 || number >= searchSelectionFiles.count) error(404, 'Not found');
	spread ??= spreadRecords(searchSelectionFiles, searchSelection().records);
	return json(spread[number]);
};
