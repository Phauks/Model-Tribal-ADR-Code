import { describe, expect, it } from 'vitest';
import { copyHashHtml } from '../src/lib/copy-hash.ts';

const hash = '49c74ae48e6f610d87359f3cded8baeb74c8ca52528654af172a19418d5ee09c';

describe('a SHA-256 to copy', () => {
	it('shows the hash as the button, so its name is what a reader sees', () => {
		const html = copyHashHtml(hash, { label: 'the CSV file' });
		expect(html).toContain(`data-sha256="${hash}"`);
		expect(html).toContain(`<code class="copy-hash-text">${hash}</code>`);
		expect(html).toContain('copy the SHA-256 of the CSV file');
		expect(html).not.toContain('aria-label');
		expect(html).toContain('role="status"');
		// No copy icon beside a shown hash: a click makes it glow instead (Trevor, Nov. 24, 2026).
		expect(html).not.toContain('<svg');
	});

	it('names an icon-only button for a screen reader', () => {
		const html = copyHashHtml(hash, { label: 'the saved copy', iconOnly: true });
		expect(html).toContain('aria-label="Copy the SHA-256 of the saved copy"');
		expect(html).not.toContain('<code');
	});

	it('escapes what it is given', () => {
		expect(copyHashHtml('a"b', { label: '<x>' })).toContain('data-sha256="a&quot;b"');
		expect(copyHashHtml('a', { label: '<x>' })).toContain('&lt;x&gt;');
	});
});
