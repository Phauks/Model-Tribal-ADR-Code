import { describe, expect, it } from 'vitest';
import { imageMayBeShown, imagePath, type OfficialImageRecord } from '#lib/official-images.ts';

function image(status: string, scope?: string[]): OfficialImageRecord {
	return {
		kind: 'seal',
		image_link: 'https://example.org/seal.png',
		sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		private_copy: 'nation-images/example-nation/seal-e3b0c44298fc.png',
		reuse: { status, permission: scope ? { scope } : undefined }
	};
}

describe('imageMayBeShown', () => {
	it('shows images with no restriction or with conditions the website meets', () => {
		expect(imageMayBeShown(image('no-restriction-found'))).toBe(true);
		expect(imageMayBeShown(image('conditions-apply'))).toBe(true);
	});

	it('never shows restricted, unchecked, refused or withdrawn images', () => {
		const hidden = ['restricted', 'needs-checking', 'permission-denied', 'withdrawn-at-request'];
		for (const status of hidden) {
			expect(imageMayBeShown(image(status))).toBe(false);
		}
	});

	it('shows a granted image only when the permission covers the web', () => {
		expect(imageMayBeShown(image('permission-granted'))).toBe(true);
		expect(imageMayBeShown(image('permission-granted', ['web', 'print']))).toBe(true);
		expect(imageMayBeShown(image('permission-granted', ['print']))).toBe(false);
	});
});

describe('imagePath', () => {
	it('serves each nation image under its page', () => {
		expect(imagePath('example-nation')).toBe('/nations/example-nation/image');
	});
});
