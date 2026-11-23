/** The United States documents a reader can save for offline reading (src/lib/offline-documents.ts). */
import { json } from '@sveltejs/kit';
import { offlineSets } from '#lib/server/copy-lists.ts';

export const prerender = true;

export function GET(): Response {
	return json(offlineSets().federal);
}
