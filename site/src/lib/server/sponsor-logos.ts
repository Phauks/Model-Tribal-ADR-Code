/**
 * Answers a sponsor's logo. A logo is a file sent from outside, so it is
 * opened only through the scan door (site/SCANNING.md): a logo still being
 * checked, or flagged, is "not found" and the page shows initials instead.
 * Only the image types checked on upload are stored, and the response says
 * not to guess another type, so a logo can never run as a page.
 */
import { error } from '@sveltejs/kit';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { openScannedFile } from './file-scans.ts';
import type { Sponsor } from './sponsors.ts';

export async function logoResponse(database: D1Database, bucket: R2Bucket, sponsor: Sponsor, cache: 'public' | 'private'): Promise<Response> {
	if (!sponsor.logoKey || !sponsor.logoType) error(404, 'No logo.');
	const opened = await openScannedFile(database, bucket, sponsor.logoKey);
	if (opened.state !== 'ready') error(404, 'The logo is not ready.');
	return new Response(opened.object.body as unknown as ReadableStream, {
		headers: {
			'content-type': sponsor.logoType,
			'x-content-type-options': 'nosniff',
			'content-security-policy': "default-src 'none'; sandbox",
			// The address changes with each new logo, but a sponsor taken off the public pages should vanish soon.
			'cache-control': cache === 'public' ? 'public, max-age=3600' : 'private, no-store'
		}
	});
}
