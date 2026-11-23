import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashFile, isSha256, Sha256 } from '#lib/sha256.ts';

function expected(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

describe('SHA-256 in pieces', () => {
	it('matches the standard test vectors', () => {
		expect(new Sha256().digest()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
		expect(new Sha256().update(new TextEncoder().encode('abc')).digest()).toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		);
	});

	it('gives the same hash however the bytes are split', () => {
		for (const size of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 70_001]) {
			const bytes = new Uint8Array(randomBytes(size));
			const hash = new Sha256();
			let offset = 0;
			for (const step of [1, 7, 63, 64, 65, 500, 4096]) {
				hash.update(bytes.subarray(offset, offset + step));
				offset = Math.min(offset + step, bytes.length);
			}
			hash.update(bytes.subarray(offset));
			expect(hash.digest(), `size ${size}`).toBe(expected(bytes));
		}
	});

	it('hashes a file read as a stream', async () => {
		const bytes = new Uint8Array(randomBytes(300_000));
		const seen: number[] = [];
		const digest = await hashFile(new Blob([bytes]), (done) => seen.push(done));
		expect(digest).toBe(expected(bytes));
		expect(seen.at(-1)).toBe(bytes.length);
	});

	it('recognizes a written hash', () => {
		expect(isSha256('E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855')).toBe(true);
		expect(isSha256('e3b0c442')).toBe(false);
		expect(isSha256(undefined)).toBe(false);
	});
});
