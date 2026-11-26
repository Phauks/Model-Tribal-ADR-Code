import { siteName } from '#lib';
import { colorsOf } from '#lib/server/design-tokens.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// Web app manifest, so the site can be installed (site/DESIGN.md, section 10).
// Colors come from site/design-tokens.json.
export const GET: RequestHandler = () => {
	const light = colorsOf('light');
	const manifest = {
		name: siteName,
		short_name: 'Tribal Law',
		description:
			'Model provisions and commentary on dispute resolution that Native nations may adapt through their own processes.',
		lang: 'en',
		dir: 'ltr',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		background_color: light.paper,
		theme_color: light.paper,
		icons: [
			{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
			{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
		]
	};
	return new Response(JSON.stringify(manifest, null, '\t'), {
		headers: { 'content-type': 'application/manifest+json; charset=utf-8' }
	});
};
