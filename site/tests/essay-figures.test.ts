import { describe, expect, it } from 'vitest';
import { parseEssay, serializeEssay, writeEssay } from '#lib/essays/document.ts';
import { renderEssay, type EssayLibrary } from '#lib/essays/render.ts';
import { figureFileAddress, figureKindFor, figureRemovalLink, figureSource } from '#lib/essays/figures.ts';
import { components } from '#lib/essays/checks.ts';

const library: EssayLibrary = { citation: () => undefined, term: () => undefined };

const picture = `Before.

:::: figure picture /files/U-20261123-7KQ2MD/council%20house.jpg
The council house in 1934.

::: description
A wooden building with a porch and three people standing in front.
:::

::: credit
Photo by the *Tribal Archives*.
:::
::::

After.
`;

describe('figure addresses', () => {
	it('reads a file sent from the editor and a YouTube link', () => {
		expect(figureSource('picture', '/files/U-20261123-7KQ2MD/a.jpg')).toEqual({
			kind: 'file',
			reference: 'U-20261123-7KQ2MD',
			address: '/files/U-20261123-7KQ2MD/a.jpg'
		});
		expect(figureSource('video', 'https://youtu.be/dQw4w9WgXcQ')).toEqual({
			kind: 'youtube',
			identifier: 'dQw4w9WgXcQ',
			address: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
		});
	});

	it('refuses other places, and YouTube for anything but a video', () => {
		expect(figureSource('picture', 'https://example.org/a.jpg')).toBeUndefined();
		expect(figureSource('picture', '/files/not-a-reference/a.jpg')).toBeUndefined();
		expect(figureSource('sound', 'https://youtu.be/dQw4w9WgXcQ')).toBeUndefined();
	});

	it('makes a file name safe for one line of Markdown', () => {
		expect(figureFileAddress('U-20261123-7KQ2MD', "Elder's talk (1).mp3")).toBe('/files/U-20261123-7KQ2MD/Elder%27s%20talk%20%281%29.mp3');
		expect(figureKindFor('audio/mpeg')).toBe('sound');
		expect(figureKindFor('application/pdf')).toBeUndefined();
	});

	it('links the removal request to the upload', () => {
		expect(figureRemovalLink(figureSource('picture', '/files/U-20261123-7KQ2MD/a.jpg')!)).toBe(
			'/requests?kind=remove&record=uploads/U-20261123-7KQ2MD'
		);
	});
});

describe('figures in the editor', () => {
	it('reads a figure with its caption and parts, and writes it back unchanged', () => {
		const document = parseEssay(picture);
		const figure = document.child(1);
		expect(figure.type.name).toBe('figure_block');
		expect(figure.attrs).toEqual({ kind: 'picture', address: '/files/U-20261123-7KQ2MD/council%20house.jpg' });
		expect(figure.child(1).attrs.kind).toBe('description');
		expect(parseEssay(serializeEssay(document)).eq(document)).toBe(true);
		expect(writeEssay(document, picture)).toBe(picture);
	});

	it('names a figure in Go to', () => {
		expect(components(parseEssay(picture)).map((component) => component.label)[1]).toBe('Picture: The council house in 1934.');
	});
});

describe('figures on the website', () => {
	it('shows a picture with its description as alternative text, then caption, credit and removal link', () => {
		const { html, problems, warnings } = renderEssay(picture, library);
		expect(problems).toEqual([]);
		expect(warnings).toEqual([]);
		expect(html).toContain(
			'<img src="/files/U-20261123-7KQ2MD/council%20house.jpg" alt="A wooden building with a porch and three people standing in front." loading="lazy" decoding="async">'
		);
		expect(html).toMatch(/<figcaption>\n<p>The council house in 1934.<\/p>\n<div class="essay-figure-credit">\n<p>Photo by the <em>Tribal Archives<\/em>.<\/p>/);
		expect(html).toContain('href="/requests?kind=remove&amp;record=uploads/U-20261123-7KQ2MD"');
		expect(html).not.toContain('<p>A wooden building');
	});

	it('shows a recording with a player and its transcript folded after the figure', () => {
		const { html, warnings } = renderEssay(
			':::: figure sound /files/U-20261123-7KQ2MD/talk.mp3\nAn elder on the peacemaker court.\n\n::: transcript\nWe sat together.\n:::\n::::\n',
			library
		);
		expect(warnings).toEqual([]);
		expect(html).toContain('<audio controls preload="metadata" src="/files/U-20261123-7KQ2MD/talk.mp3">');
		expect(html).toMatch(/<\/figure>\n<details class="essay-figure-transcript">\n<summary>Transcript<\/summary>\n<p>We sat together.<\/p>\n<\/details>\n<\/div>/);
	});

	it('shows a YouTube video as a still frame that loads the player on request', () => {
		const { html, warnings } = renderEssay(':::: figure video https://www.youtube.com/watch?v=dQw4w9WgXcQ\nA hearing.\n::::\n', library);
		expect(html).toContain('href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"');
		expect(html).toContain('data-embed="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
		expect(html).toContain('src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"');
		expect(warnings).toEqual(['A video has no description. Add one so people who cannot see it know what it shows.']);
	});

	it('refuses to publish a figure from an unknown place', () => {
		const { html, problems } = renderEssay(':::: figure picture https://example.org/a.jpg\nA.\n::::\n', library);
		expect(problems[0]).toMatch(/address the site cannot show/);
		expect(html).not.toContain('example.org');
	});
});
