/**
 * Serves a Justice's, President's or Court's picture from the private
 * sourceDocuments bucket. Only pictures on the build-time list are served, and
 * that list holds only pictures checked by hand
 * (content/supreme-court/pictures.yaml). The bucket's copy must match the
 * SHA-256 recorded when the picture was reviewed; if the bucket has no
 * matching copy, the Worker fetches the copy it was reviewed from and keeps it
 * only if it matches. A picture turned or cut from its copy (a print
 * photographed on its side, one Justice in a group photograph) has no link to
 * fetch, so only the bucket's copy is served.
 */
import { error } from '@sveltejs/kit';
import { portraits } from 'virtual:portraits';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

const largestImage = 5 * 1024 * 1024;

async function hexDigest(bytes: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function fetchReviewedCopy(link: string, sha256: string): Promise<ArrayBuffer | undefined> {
	try {
		const response = await fetch(link, { headers: { 'User-Agent': 'Tribal Law Project website (picture check)' } });
		if (!response.ok) return undefined;
		const bytes = await response.arrayBuffer();
		if (bytes.byteLength > largestImage) return undefined;
		return (await hexDigest(bytes)) === sha256 ? bytes : undefined;
	} catch {
		return undefined;
	}
}

export const GET: RequestHandler = async ({ params }) => {
	const portrait = portraits.find((candidate) => candidate.person === params.person);
	if (!portrait) error(404, 'No picture is shown for this page.');

	const bucket = workerEnvironment().sourceDocuments;
	let bytes: ArrayBuffer | undefined;
	const stored = bucket ? await bucket.get(portrait.key) : null;
	if (stored) {
		const storedBytes = await stored.arrayBuffer();
		if ((await hexDigest(storedBytes)) === portrait.sha256) bytes = storedBytes;
	}
	if (!bytes) {
		if (!portrait.link) error(404, 'No picture is shown for this page.');
		bytes = await fetchReviewedCopy(portrait.link, portrait.sha256);
		if (!bytes) error(404, 'No picture is shown for this page.');
		await bucket?.put(portrait.key, bytes, {
			httpMetadata: { contentType: portrait.mediaType },
			customMetadata: { person: portrait.person, source: portrait.link, sha256: portrait.sha256 }
		});
	}

	return new Response(bytes, {
		headers: {
			'Content-Type': portrait.mediaType,
			'Cache-Control': 'public, max-age=86400',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
