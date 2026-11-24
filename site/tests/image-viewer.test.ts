import { describe, expect, it } from 'vitest';
import {
	downloadName,
	imageViewerAttributeText,
	imageViewerAttributes,
	imageViewerLinkLabel,
	imageViewerTitle,
	originalHost,
	stepIndex,
	swipeStep
} from '#lib/image-viewer.ts';

describe('picture links', () => {
	it('marks the link, names what it does and keeps only the details given', () => {
		expect(
			imageViewerAttributes('Seal of Navajo Nation', {
				title: 'Seal of Navajo Nation',
				credit: 'As the nation’s website publishes it.',
				original: 'https://www.navajo-nsn.gov/seal.png',
				source: ' '
			})
		).toEqual({
			class: 'image-viewer-link',
			'aria-label': 'Seal of Navajo Nation (open larger)',
			title: 'Open larger',
			'data-sveltekit-reload': '',
			'data-viewer-title': 'Seal of Navajo Nation',
			'data-viewer-credit': 'As the nation’s website publishes it.',
			'data-viewer-original': 'https://www.navajo-nsn.gov/seal.png'
		});
	});

	it('still names a picture that has no description', () => {
		expect(imageViewerLinkLabel('')).toBe('Open the picture larger');
		expect(imageViewerAttributes('', { title: 'Logo' })['aria-label']).toBe('Logo (open larger)');
	});

	it('escapes every value written into HTML text', () => {
		expect(imageViewerAttributeText('A "quoted" <b> & more')).toBe(
			' class="image-viewer-link" aria-label="A &quot;quoted&quot; &lt;b&gt; &amp; more (open larger)" title="Open larger" data-sveltekit-reload=""'
		);
	});
});

describe('the viewer', () => {
	it('heads a picture with its title, else its description', () => {
		expect(imageViewerTitle({ title: 'Seal', description: 'A round seal' })).toBe('Seal');
		expect(imageViewerTitle({ description: 'A round seal' })).toBe('A round seal');
		expect(imageViewerTitle({ description: '' })).toBe('Picture');
	});

	it('steps round from the last picture to the first and back', () => {
		expect(stepIndex(0, 1, 3)).toBe(1);
		expect(stepIndex(2, 1, 3)).toBe(0);
		expect(stepIndex(0, -1, 3)).toBe(2);
		expect(stepIndex(0, 1, 0)).toBe(0);
	});

	it('takes a mostly sideways move as a swipe, left for the next picture', () => {
		expect(swipeStep(-120, 10)).toBe(1);
		expect(swipeStep(120, -10)).toBe(-1);
		expect(swipeStep(30, 0)).toBe(0);
		expect(swipeStep(-80, 90)).toBe(0);
	});

	it('names the website a picture is published on', () => {
		expect(originalHost('https://www.navajo-nsn.gov/Portals/0/seal.png')).toBe('navajo-nsn.gov');
		expect(originalHost('https://upload.wikimedia.org/a.png')).toBe('upload.wikimedia.org');
		expect(originalHost('not a link')).toBeUndefined();
	});
});

describe('downloading', () => {
	it('names the file after its title, with the extension its media type calls for', () => {
		expect(downloadName('Logo of Absentee-Shawnee Tribe of Indians of Oklahoma', '/nations/absentee-shawnee-tribe-of-indians-of-oklahoma/image', 'image/png')).toBe(
			'logo-of-absentee-shawnee-tribe-of-indians-of-oklahoma.png'
		);
		expect(downloadName('Seal of the Pueblo of Zuñi', '/nations/zuni/image', 'image/jpeg; charset=binary')).toBe('seal-of-the-pueblo-of-zuni.jpg');
	});

	it('falls back to the extension in the address, then to no extension', () => {
		expect(downloadName('Council house', '/files/U-1/council%20house.webp')).toBe('council-house.webp');
		expect(downloadName('Council house', '/nations/x/pictures/abc')).toBe('council-house');
		expect(downloadName('', '/nations/x/image', 'image/svg+xml')).toBe('picture.svg');
	});
});
