import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { cleanZipPath, isZipName, unzipFiles, ZipProblem } from '#lib/unzip-files.ts';

describe('unzipFiles', () => {
	it('gives every file inside, with ZIPs inside opened too, and leaves out folders and leftovers', () => {
		const inner = zipSync({ 'c.txt': strToU8('three') });
		const zip = zipSync({
			'a.pdf': strToU8('%PDF-1.7 one'),
			'folder/b.txt': strToU8('two'),
			'folder/inner.zip': inner,
			'__MACOSX/folder/._b.txt': strToU8('mac'),
			'folder/.DS_Store': strToU8('mac')
		});
		const files = unzipFiles(zip);
		expect(files.map((file) => file.path).sort()).toEqual(['a.pdf', 'folder/b.txt', 'folder/inner.zip/c.txt']);
	});

	it('drops "..", "." and empty parts from paths', () => {
		expect(cleanZipPath('../../etc/passwd')).toBe('etc/passwd');
		expect(cleanZipPath('a/./b//c.pdf')).toBe('a/b/c.pdf');
		expect(cleanZipPath('..\\..\\x.pdf')).toBe('x.pdf');
		expect(cleanZipPath('../')).toBeNull();
	});

	it('refuses a ZIP that unpacks to more than the limit before unpacking it', () => {
		// Two gigabytes of zeros compress to almost nothing, so build a small ZIP and change the size it claims.
		const zip = zipSync({ 'big.bin': new Uint8Array(1024) }, { level: 9 });
		const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
		// The central directory entry's uncompressed size is at offset 24 from its signature.
		for (let at = zip.byteLength - 22; at >= 0; at--) {
			if (view.getUint32(at, true) === 0x02014b50) {
				view.setUint32(at + 24, 0xfffffff0, true);
				break;
			}
		}
		expect(() => unzipFiles(zip)).toThrow(ZipProblem);
	});

	it('says why a damaged ZIP cannot be opened', () => {
		expect(() => unzipFiles(strToU8('not a zip at all'))).toThrow(ZipProblem);
	});

	it('knows a ZIP by its name', () => {
		expect(isZipName('Batch.ZIP')).toBe(true);
		expect(isZipName('book.epub')).toBe(false);
	});
});
