/**
 * Serves a nation's seal, emblem, flag or logo from the private sourceDocuments
 * bucket (Trevor's choice, 2026-11-21; docs/official-images.md).
 *
 * Only images on the build-time list are served, and that list holds only
 * images whose reuse status allows showing them, so a restricted or withdrawn
 * image is never served whatever the bucket holds. The bucket copy is filled
 * the first time the image is asked for: the Worker fetches the image from the
 * nation's own website and keeps it only if it is byte for byte the copy that
 * was reviewed (same SHA-256). If the nation has since changed or removed the
 * image, nothing is served until it is reviewed again.
 */
import { error } from '@sveltejs/kit';
import { nationImages } from 'virtual:nation-images';
import type { ServableImage } from '#lib/official-images.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Larger files are not seals or logos; refusing them keeps the Worker within its limits. */
const largestImage = 5 * 1024 * 1024;

async function hexDigest(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The image from the nation's website, or undefined unless it matches the reviewed copy. */
async function fetchFromNation(image: ServableImage): Promise<ArrayBuffer | undefined> {
	try {
		const response = await fetch(image.link, {
			redirect: 'follow',
			headers: { 'User-Agent': 'model-tribal-adr-code website (nation image check)' }
		});
		if (!response.ok) return undefined;
		const length = Number(response.headers.get('content-length') ?? 0);
		if (length > largestImage) return undefined;
		const bytes = await response.arrayBuffer();
		if (bytes.byteLength > largestImage) return undefined;
		return (await hexDigest(bytes)) === image.sha256 ? bytes : undefined;
	} catch {
		return undefined;
	}
}

export const GET: RequestHandler = async ({ params }) => {
	const image = nationImages.find((candidate) => candidate.nation === params.id);
	if (!image) error(404, 'No image is shown for this nation.');

	const bucket = workerEnvironment().sourceDocuments;
	if (!bucket) error(503, 'Images cannot be served right now.');

	let bytes: ArrayBuffer | undefined;
	const stored = await bucket.get(image.key);
	if (stored) {
		const storedBytes = await stored.arrayBuffer();
		if ((await hexDigest(storedBytes)) === image.sha256) bytes = storedBytes;
	}
	if (!bytes) {
		bytes = await fetchFromNation(image);
		if (!bytes) error(404, 'No image is shown for this nation.');
		await bucket.put(image.key, bytes, {
			httpMetadata: { contentType: image.mediaType },
			customMetadata: {
				nation: image.nation,
				source: image.link,
				sha256: image.sha256
			}
		});
	}

	return new Response(bytes, {
		headers: {
			'Content-Type': image.mediaType,
			// An hour, so that a withdrawn image stops showing soon after the site is rebuilt.
			'Cache-Control': 'public, max-age=3600',
			'X-Content-Type-Options': 'nosniff',
			// SVG files can hold scripts: opened on their own, they run in a sandbox with nothing allowed.
			'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			'Cross-Origin-Resource-Policy': 'same-origin'
		}
	});
};
