import { json } from '@sveltejs/kit';
import { imageMayBeShown, imagePath } from '#lib/official-images.ts';
import { nations } from '#lib/server/content.ts';
import { nationIndexRows } from '#lib/server/nation-index.ts';
import type { RequestHandler } from './$types';

/**
 * Every nation page in a short form, built once with the site: the previews
 * that open when a reader points at a link to a nation page read it
 * (LinkPreviews.svelte), and the service worker saves it for offline
 * reading. Each field repeats a cited fact the nation's page shows with its
 * sources: the name, the recognition status, the states and the review
 * status. Nothing here is written for the preview.
 */
export const prerender = true;

export const GET: RequestHandler = () => {
	const withImage = new Set(
		nations()
			.filter((record) =>
				(record.official_images ?? []).some((image) => image.private_copy && imageMayBeShown(image))
			)
			.map((record) => record.id)
	);
	return json({
		nations: nationIndexRows().map((row) => ({
			id: row.id,
			name: row.name,
			recognition: row.recognition.map((view) => view.label),
			states: row.statesText,
			review: row.review,
			image: withImage.has(row.id) ? imagePath(row.id) : undefined
		}))
	});
};
