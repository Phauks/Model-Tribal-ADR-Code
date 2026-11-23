/**
 * Answers a sponsor's logo from the private bucket. Only the image types
 * checked on upload are stored, and the response says not to guess another
 * type, so a logo can never run as a page.
 */
import { error } from '@sveltejs/kit';
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { Sponsor } from './sponsors.ts';

export async function logoResponse(bucket: R2Bucket, sponsor: Sponsor, cache: 'public' | 'private'): Promise<Response> {
	if (!sponsor.logoKey || !sponsor.logoType) error(404, 'No logo.');
	const object = await bucket.get(sponsor.logoKey);
	if (!object) error(404, 'No logo.');
	return new Response(object.body as unknown as ReadableStream, {
		headers: {
			'content-type': sponsor.logoType,
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox",
			// The address changes with each new logo, but a sponsor taken off the public pages should vanish soon.
			'cache-control': cache === 'public' ? 'public, max-age=3600' : 'private, no-store'
		}
	});
}
