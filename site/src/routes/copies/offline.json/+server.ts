/**
 * The short list of the sets of copies a reader can save for offline reading, with each set's
 * size, for the Data section in Settings (src/lib/offline-documents.ts).
 */
import { json } from '@sveltejs/kit';
import { offlineSetSummary } from '#lib/server/copy-lists.ts';

export const prerender = true;

export function GET(): Response {
	return json(offlineSetSummary());
}
