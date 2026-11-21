import { describe, expect, it } from 'vitest';
import { formatCaptureDate, formatSource } from '#lib/server/markdown.ts';

const record = {
	key: 'example',
	kind: 'webpage',
	citation: { title: 'Example page' },
	original_link: 'https://example.org/page'
};

describe('source links in notes', () => {
	it('links the original page alone when there is no archived copy', () => {
		const html = formatSource(record, 'example');
		expect(html).toContain('<span class="source-links"><a class="source-original" href="https://example.org/page">example.org</a></span>');
		expect(html).not.toContain('archived copy');
	});

	it('adds the archived copy with its capture date when there is one', () => {
		const html = formatSource(
			{
				...record,
				archives: [{ link: 'https://web.archive.org/web/20261121/https://example.org/page', captured: '2026-11-21' }]
			},
			'example'
		);
		expect(html).toContain('class="source-links has-archive"');
		expect(html).toContain('href="https://web.archive.org/web/20261121/https://example.org/page">archived copy, Nov. 21, 2026</a>');
	});

	it('writes dates the way the style guide does', () => {
		expect(formatCaptureDate('2026-09-03')).toBe('Sept. 3, 2026');
		expect(formatCaptureDate('not a date')).toBe('not a date');
	});
});
