import { colorsOf } from '#lib/server/design-tokens.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

// The app icon: a section sign in the action colors from design-tokens.json.
// A plain typographic mark until commissioned art is chosen (site/DESIGN.md,
// "What the design avoids"). The square fills the whole icon, so it also
// works where the system crops icons to a circle.
export const GET: RequestHandler = () => {
	const light = colorsOf('light');
	const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="Tribal Law Project">
	<rect width="512" height="512" fill="${light.action}"/>
	<text x="256" y="350" text-anchor="middle" font-family="Atkinson Hyperlegible Next, Noto Sans, Arial, sans-serif" font-weight="700" font-size="300" fill="${light['action-text']}">§</text>
</svg>
`;
	return new Response(icon, { headers: { 'content-type': 'image/svg+xml; charset=utf-8' } });
};
