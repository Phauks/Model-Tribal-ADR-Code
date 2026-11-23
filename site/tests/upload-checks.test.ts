import { describe, expect, it } from 'vitest';
import {
	checkFileType,
	fileFingerprint,
	findHiddenContent,
	pictureWithoutLocation,
	sha256Hex
} from '#lib/server/upload-checks.ts';

const text = (value: string) => new TextEncoder().encode(value);
const bytes = (...values: number[]) => new Uint8Array(values);

function isoFile(brand: string): Uint8Array {
	const header = new Uint8Array(32);
	header.set([0, 0, 0, 0x20], 0);
	header.set(text('ftyp'), 4);
	header.set(text(brand), 8);
	return header;
}

function zipWith(names: string): Uint8Array {
	const header = new Uint8Array(200);
	header.set([0x50, 0x4b, 0x03, 0x04], 0);
	header.set(text(names), 30);
	return header;
}

describe('checkFileType', () => {
	it('knows files by their first bytes, not their names', () => {
		expect(checkFileType(text('%PDF-1.7\n'), 'photo.jpg')).toMatchObject({ accepted: true, kind: 'document', mediaType: 'application/pdf' });
		expect(checkFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'x')).toMatchObject({ kind: 'picture', mediaType: 'image/png' });
		expect(checkFileType(bytes(0xff, 0xd8, 0xff, 0xe0), 'x')).toMatchObject({ kind: 'picture', mediaType: 'image/jpeg' });
		expect(checkFileType(isoFile('isom'), 'talk.mov')).toMatchObject({ kind: 'video', mediaType: 'video/mp4' });
		expect(checkFileType(isoFile('qt  '), 'talk')).toMatchObject({ kind: 'video', mediaType: 'video/quicktime' });
		expect(checkFileType(isoFile('M4A '), 'interview')).toMatchObject({ kind: 'sound', mediaType: 'audio/mp4' });
		expect(checkFileType(isoFile('heic'), 'img')).toMatchObject({ kind: 'picture', mediaType: 'image/heic' });
		expect(checkFileType(text('ID3\u0004'), 'song')).toMatchObject({ kind: 'sound', mediaType: 'audio/mpeg' });
		expect(checkFileType(text('RIFF\u0000\u0000\u0000\u0000WAVEfmt '), 'a')).toMatchObject({ kind: 'sound' });
	});

	it('takes plain text, CSV and Markdown by name once the bytes are text', () => {
		expect(checkFileType(text('a,b\n1,2\n'), 'table.csv')).toMatchObject({ accepted: true, mediaType: 'text/csv' });
		expect(checkFileType(text('# Notes\n'), 'notes.md')).toMatchObject({ accepted: true, mediaType: 'text/markdown' });
		expect(checkFileType(text('Notes\n'), 'notes.txt')).toMatchObject({ accepted: true, mediaType: 'text/plain' });
		expect(checkFileType(text('Notes\n'), 'notes.js')).toMatchObject({ accepted: false });
	});

	it('refuses web pages, SVG, archives, programs and macro files', () => {
		expect(checkFileType(text('<!DOCTYPE html><html>'), 'page.txt').accepted).toBe(false);
		expect(checkFileType(text('<svg xmlns="http://www.w3.org/2000/svg">'), 'logo.txt').accepted).toBe(false);
		expect(checkFileType(zipWith('photos/one.jpg'), 'photos.zip').accepted).toBe(false);
		expect(checkFileType(bytes(0x4d, 0x5a, 0x90, 0x00, 0x03), 'setup.exe').accepted).toBe(false);
		expect(checkFileType(zipWith('[Content_Types].xml word/document.xml'), 'flyer.docm').accepted).toBe(false);
		expect(checkFileType(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), 'old.doc').accepted).toBe(false);
	});

	it('accepts Word and Excel files that are not macro files', () => {
		expect(checkFileType(zipWith('[Content_Types].xml word/document.xml'), 'rules.docx')).toMatchObject({ accepted: true, label: 'Word document' });
		expect(checkFileType(zipWith('[Content_Types].xml xl/workbook.xml'), 'list.xlsx')).toMatchObject({ accepted: true, label: 'Excel spreadsheet' });
	});
});

describe('findHiddenContent', () => {
	it('flags scripts in a PDF for a careful look and refuses an encrypted one', () => {
		expect(findHiddenContent('application/pdf', text('<< /S /JavaScript /JS (app.alert(1)) >>'))).toEqual([
			{ severity: 'look', note: 'The PDF has a script in it.' }
		]);
		expect(findHiddenContent('application/pdf', text('trailer << /Encrypt 5 0 R >>'))[0]?.severity).toBe('refuse');
		expect(findHiddenContent('application/pdf', text('%PDF-1.7 plain text'))).toEqual([]);
	});

	it('refuses Office files with macros', () => {
		expect(findHiddenContent('application/vnd.openxmlformats-officedocument.wordprocessingml.document', text('word/vbaProject.bin'))[0]?.severity).toBe('refuse');
	});
});

describe('pictureWithoutLocation', () => {
	it('drops the Exif segment of a JPEG and keeps the image', () => {
		const exif = [0xff, 0xe1, 0x00, 0x08, ...text('Exif'), 0x00, 0x00];
		const app0 = [0xff, 0xe0, 0x00, 0x04, 0x01, 0x02];
		const scan = [0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9];
		const cleaned = pictureWithoutLocation(bytes(0xff, 0xd8, ...exif, ...app0, ...scan), 'image/jpeg');
		expect(cleaned && [...cleaned]).toEqual([0xff, 0xd8, ...app0, ...scan]);
	});

	it('drops text and Exif chunks of a PNG', () => {
		const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...text(type), ...data, 0, 0, 0, 0];
		const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
		const header = chunk('IHDR', [1, 2, 3]);
		const end = chunk('IEND', []);
		const cleaned = pictureWithoutLocation(bytes(...signature, ...header, ...chunk('eXIf', [9, 9]), ...chunk('tEXt', [7]), ...end), 'image/png');
		expect(cleaned && [...cleaned]).toEqual([...signature, ...header, ...end]);
	});

	it('gives nothing for pictures it cannot clean', () => {
		expect(pictureWithoutLocation(bytes(1, 2, 3), 'image/jpeg')).toBeUndefined();
		expect(pictureWithoutLocation(bytes(1, 2, 3), 'image/tiff')).toBeUndefined();
	});
});

describe('fileFingerprint', () => {
	it('is the plain SHA-256 for one piece, and a hash of the piece hashes for more', async () => {
		const one = await sha256Hex(text('a'));
		expect(await fileFingerprint([one])).toBe(one);
		const two = await fileFingerprint([one, one]);
		expect(two).toBe(`pieces:${await sha256Hex(text(`${one}\n${one}`))}`);
	});
});
