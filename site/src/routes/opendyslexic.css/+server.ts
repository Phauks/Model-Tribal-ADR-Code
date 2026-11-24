import regularOld from '@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff';
import regular from '@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2';
import italicOld from '@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff';
import italic from '@fontsource/opendyslexic/files/opendyslexic-latin-400-italic.woff2';
import boldOld from '@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff';
import bold from '@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2';
import boldItalicOld from '@fontsource/opendyslexic/files/opendyslexic-latin-700-italic.woff';
import boldItalic from '@fontsource/opendyslexic/files/opendyslexic-latin-700-italic.woff2';
import type { RequestHandler } from './$types';

export const prerender = true;

const faces = [
	{ style: 'normal', weight: 400, woff2: regular, woff: regularOld },
	{ style: 'italic', weight: 400, woff2: italic, woff: italicOld },
	{ style: 'normal', weight: 700, woff2: bold, woff: boldOld },
	{ style: 'italic', weight: 700, woff2: boldItalic, woff: boldItalicOld }
];

/**
 * OpenDyslexic's four faces, the same rules as @fontsource/opendyslexic's 400.css, 400-italic.css, 700.css and 700-italic.css. They are a style sheet of their own, read only by readers who pick the font or open Settings (src/lib/reading-settings.ts, addOpenDyslexicFaces), instead of being part of the style sheet every page loads. Its address does not change between builds, so src/app.html can add it before the first paint.
 */
export const GET: RequestHandler = () => {
	const rules = faces.map(
		(face) =>
			`@font-face {\n\tfont-family: 'OpenDyslexic';\n\tfont-style: ${face.style};\n\tfont-display: swap;\n\tfont-weight: ${face.weight};\n\tsrc: url(${face.woff2}) format('woff2'), url(${face.woff}) format('woff');\n}\n`
	);
	return new Response(rules.join(''), { headers: { 'content-type': 'text/css; charset=utf-8' } });
};
