import { describe, expect, it } from 'vitest';
import { checksumsText, copyChecksums, isDownload, isListedDownload, parseCsv } from '../tools/write-checksums.mjs';
import { fileName, pathsWithHash, verifyLink } from '#lib/checksums.ts';

const hash = 'a'.repeat(64);

describe('the checksums the build writes', () => {
	it('counts as downloads the files a reader saves', () => {
		expect(isDownload('/zip/data.zip')).toBe(true);
		expect(isDownload('/nations/nations.csv')).toBe(true);
		expect(isDownload('/help/forms/petition-for-peacemaking.docx')).toBe(true);
		expect(isDownload('/help/forms/petition-for-peacemaking.pdf')).toBe(true);
		expect(isDownload('/glossary/terms.json')).toBe(true);
		expect(isDownload('/nations/navajo-nation/record.json')).toBe(true);
		expect(isDownload('/nations/navajo-nation/__data.json')).toBe(false);
		expect(isDownload('/search/index.json')).toBe(false);
		expect(isDownload('/_app/immutable/x.js')).toBe(false);
		expect(isDownload('/checksums.json')).toBe(false);
	});

	it('keeps each nation’s own files off the short list', () => {
		expect(isListedDownload('/zip/data.zip')).toBe(true);
		expect(isListedDownload('/nations/navajo-nation/sources.json')).toBe(false);
	});

	it('reads the list of copies, quoted fields and all', () => {
		const csv = `title,nations,copy,published_at,captured,bytes,sha256\r\n"A, ""quoted"" title",X,/copies/a/b%20c.pdf,https://example.org/,2026-11-21,12,${hash.toUpperCase()}\r\nNo hash,X,/copies/d.pdf,https://example.org/,2026-11-21,3,\r\n`;
		expect(parseCsv(csv)[1][0]).toBe('A, "quoted" title');
		expect(copyChecksums(csv)).toEqual({ '/copies/a/b%20c.pdf': { sha256: hash, bytes: 12 } });
	});

	it('writes lines sha256sum can read', () => {
		expect(checksumsText({ '/copies/a/b%20c.pdf': { sha256: hash } })).toBe(`${hash}  copies/a/b c.pdf\n`);
	});
});

describe('reading the checksums', () => {
	it('finds a file by its hash, whatever its case', () => {
		const manifest = { built: '1', files: { '/a.csv': { sha256: hash, bytes: 1 }, '/b.csv': { sha256: 'b'.repeat(64), bytes: 1 } } };
		expect(pathsWithHash(manifest, hash.toUpperCase())).toEqual(['/a.csv']);
	});

	it('links to the check and names the file', () => {
		expect(verifyLink(hash, 'data.zip')).toBe(`/verify?sha256=${hash}&name=data.zip`);
		expect(fileName('/copies/a/b%20c.pdf')).toBe('b c.pdf');
	});
});
