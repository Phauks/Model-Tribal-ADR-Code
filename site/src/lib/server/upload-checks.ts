/**
 * Safety checks for uploaded files (docs/uploads.md, "Safety checks"):
 * what a file is, judged by its first bytes and not its name; marks of
 * hidden content inside it; and copies of pictures without the camera's
 * location. Kept free of database and storage code so it can be tested on
 * its own.
 */
import type { UploadKind } from '../uploads.ts';

export interface AcceptedType {
	accepted: true;
	kind: UploadKind;
	mediaType: string;
	/** Shown to people, such as "PDF document". */
	label: string;
	extension: string;
}

export interface RefusedType {
	accepted: false;
	/** Shown to the sender. */
	reason: string;
}

export type TypeCheck = AcceptedType | RefusedType;

function startsWith(bytes: Uint8Array, prefix: readonly number[], offset = 0): boolean {
	return prefix.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
	return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

/** Text of the bytes, one character per byte, for finding markers inside files. */
function latin1(bytes: Uint8Array): string {
	let text = '';
	for (let start = 0; start < bytes.length; start += 0x8000) {
		text += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
	}
	return text;
}

function extensionOf(name: string): string {
	const match = /\.([A-Za-z0-9]{1,8})$/.exec(name.trim());
	return match ? match[1]!.toLowerCase() : '';
}

const accepted = (kind: UploadKind, mediaType: string, label: string, extension: string): AcceptedType => ({
	accepted: true,
	kind,
	mediaType,
	label,
	extension
});

const refused = (reason: string): RefusedType => ({ accepted: false, reason });

/** ISO base media files (MP4, MOV, M4A, HEIC) name their brand at byte 8, after "ftyp" at byte 4. */
function isoBrand(bytes: Uint8Array): string | undefined {
	return ascii(bytes, 4, 4) === 'ftyp' ? ascii(bytes, 8, 4) : undefined;
}

/** Whether the start of a file reads as text: valid UTF-8 with no zero bytes. */
function looksLikeText(bytes: Uint8Array): boolean {
	const sample = bytes.subarray(0, 64 * 1024);
	if (sample.includes(0)) return false;
	try {
		// A piece can end in the middle of a character, so only the last 3 bytes may be incomplete.
		new TextDecoder('utf-8', { fatal: true }).decode(sample.subarray(0, Math.max(0, sample.length - 3)));
		return true;
	} catch {
		// expected: bytes that are not UTF-8 are not plain text.
		return false;
	}
}

const macroFileReason =
	'Office files with macros can’t be accepted. Save it as a PDF, or as a .docx or .xlsx file, and send it again.';

/**
 * What a file is, from its first piece and its name. The name only tells
 * apart files that have no mark of their own (plain text, CSV, Markdown) and
 * the kinds of Office file, which are all ZIP files inside.
 */
export function checkFileType(firstPiece: Uint8Array, fileName: string): TypeCheck {
	const bytes = firstPiece;
	const extension = extensionOf(fileName);

	if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return accepted('document', 'application/pdf', 'PDF document', 'pdf');
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
		return accepted('picture', 'image/png', 'PNG picture', 'png');
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return accepted('picture', 'image/jpeg', 'JPEG picture', 'jpg');
	if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP')
		return accepted('picture', 'image/webp', 'WebP picture', 'webp');
	if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')
		return accepted('picture', 'image/gif', 'GIF picture', 'gif');
	if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a]))
		return accepted('picture', 'image/tiff', 'TIFF picture', 'tif');
	if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE')
		return accepted('sound', 'audio/wav', 'WAV recording', 'wav');
	if (ascii(bytes, 0, 4) === 'fLaC') return accepted('sound', 'audio/flac', 'FLAC recording', 'flac');
	if (ascii(bytes, 0, 4) === 'OggS') return accepted('sound', 'audio/ogg', 'Ogg recording', 'ogg');
	if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0))
		return accepted('sound', 'audio/mpeg', 'MP3 recording', 'mp3');

	const brand = isoBrand(bytes);
	if (brand) {
		if (['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand))
			return accepted('picture', 'image/heic', 'HEIC picture', 'heic');
		if (brand === 'M4A ' || brand === 'M4B ') return accepted('sound', 'audio/mp4', 'M4A recording', 'm4a');
		if (brand === 'qt  ') return accepted('video', 'video/quicktime', 'QuickTime video', 'mov');
		return accepted('video', 'video/mp4', 'MP4 video', 'mp4');
	}
	if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) {
		return latin1(bytes.subarray(0, 64)).includes('webm')
			? accepted('video', 'video/webm', 'WebM video', 'webm')
			: refused('Only MP4, MOV and WebM videos can be sent.');
	}

	if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return checkZipFile(bytes, extension);
	if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
		return refused('Older Word and Excel files (.doc, .xls) can carry macros. Save it as a PDF, .docx or .xlsx and send it again.');

	if (looksLikeText(bytes)) {
		const start = latin1(bytes.subarray(0, 2048)).trimStart().toLowerCase();
		if (start.startsWith('<') && /^<(!doctype|html|svg|\?xml|script|head|body)/.test(start))
			return refused('Web pages and SVG pictures can’t be sent, because they can carry programs. Save it as a PDF or a PNG picture.');
		if (extension === 'csv') return accepted('document', 'text/csv', 'CSV table', 'csv');
		if (extension === 'md' || extension === 'markdown')
			return accepted('document', 'text/markdown', 'Markdown text', 'md');
		if (extension === 'txt' || extension === '') return accepted('document', 'text/plain', 'Plain text', 'txt');
		return refused('Only plain text, CSV and Markdown files can be sent as text.');
	}

	if (['zip', '7z', 'rar', 'gz', 'tar'].includes(extension))
		return refused('Only ZIP archives can be sent, and the page opens them so each file goes on its own. Unpack this archive first.');
	if (['exe', 'dll', 'msi', 'bat', 'cmd', 'sh', 'js', 'ps1', 'app', 'dmg', 'apk', 'jar'].includes(extension))
		return refused('Programs and scripts can’t be sent.');
	return refused('This kind of file can’t be sent. Documents, pictures, sound recordings and videos can.');
}

/** Word, Excel, OpenDocument and EPUB files are ZIP files; any other ZIP is refused here, because the page opens ZIPs before sending. */
function checkZipFile(bytes: Uint8Array, extension: string): TypeCheck {
	const head = latin1(bytes.subarray(0, Math.min(bytes.length, 4 * 1024 * 1024)));
	if (head.startsWith('mimetypeapplication/epub+zip', 30)) return accepted('document', 'application/epub+zip', 'EPUB book', 'epub');
	if (head.startsWith('mimetypeapplication/vnd.oasis.opendocument.text', 30))
		return accepted('document', 'application/vnd.oasis.opendocument.text', 'OpenDocument text', 'odt');
	if (head.startsWith('mimetypeapplication/vnd.oasis.opendocument.spreadsheet', 30))
		return accepted('document', 'application/vnd.oasis.opendocument.spreadsheet', 'OpenDocument spreadsheet', 'ods');
	const office = head.includes('[Content_Types].xml');
	if (office && (extension === 'docm' || extension === 'xlsm' || extension === 'pptm')) return refused(macroFileReason);
	if (office && head.includes('word/'))
		return accepted(
			'document',
			'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Word document',
			'docx'
		);
	if (office && head.includes('xl/'))
		return accepted(
			'document',
			'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Excel spreadsheet',
			'xlsx'
		);
	return refused('A ZIP file is opened on the page and each file inside is sent on its own. Add it again from the page.');
}

/** A finding inside one piece of a file. */
export interface PieceFinding {
	/** refuse: the file is not accepted. look: a reviewer must look carefully before opening it. */
	severity: 'refuse' | 'look';
	/** Shown to reviewers, and to the sender when the file is refused. */
	note: string;
}

const pdfMarkers: readonly [RegExp, string][] = [
	[/\/JavaScript\b|\/JS\b/, 'The PDF has a script in it.'],
	[/\/Launch\b/, 'The PDF can try to open another program.'],
	[/\/EmbeddedFiles?\b/, 'The PDF has other files inside it.'],
	[/\/RichMedia\b/, 'The PDF has embedded media that can run code.'],
	[/\/Encrypt\b/, 'The PDF is password protected, so it could not be checked.']
];

/**
 * Marks of hidden content in one piece of a file. Each piece is looked at as
 * it arrives. A mark that falls across two pieces, or sits inside a
 * compressed part of a PDF, is not found here; the virus scan is the second
 * line (docs/uploads.md).
 */
export function findHiddenContent(mediaType: string, piece: Uint8Array): PieceFinding[] {
	const text = latin1(piece);
	const findings: PieceFinding[] = [];
	if (mediaType === 'application/pdf') {
		for (const [pattern, note] of pdfMarkers) {
			if (pattern.test(text)) findings.push({ severity: note.includes('password') ? 'refuse' : 'look', note });
		}
	}
	if (mediaType.startsWith('application/vnd.openxmlformats')) {
		if (text.includes('vbaProject.bin')) findings.push({ severity: 'refuse', note: macroFileReason });
		if (/externalLink|oleObject|activeX/.test(text))
			findings.push({ severity: 'look', note: 'The Office file links to outside files or holds embedded objects.' });
		if (text.includes('EncryptedPackage'))
			findings.push({ severity: 'refuse', note: 'The file is password protected, so it could not be checked.' });
	}
	if (mediaType.startsWith('application/vnd.oasis.opendocument')) {
		if (/Basic\/|Scripts\//.test(text)) findings.push({ severity: 'look', note: 'The OpenDocument file has macros in it.' });
	}
	return findings;
}

/**
 * A copy of a picture without camera details (Exif, which can hold where the
 * photo was taken) or other metadata segments. JPEG, PNG and WebP only;
 * undefined for other pictures, which reviewers download instead of viewing.
 */
export function pictureWithoutLocation(bytes: Uint8Array, mediaType: string): Uint8Array | undefined {
	if (mediaType === 'image/jpeg') return jpegWithoutMetadata(bytes);
	if (mediaType === 'image/png') return pngWithoutMetadata(bytes);
	if (mediaType === 'image/webp') return webpWithoutMetadata(bytes);
	return undefined;
}

/** Drops APP1 (Exif, XMP) and APP13 (Photoshop, IPTC) segments; keeps APP0, ICC colour (APP2) and the image. */
function jpegWithoutMetadata(bytes: Uint8Array): Uint8Array | undefined {
	if (!startsWith(bytes, [0xff, 0xd8])) return undefined;
	const kept: Uint8Array[] = [bytes.subarray(0, 2)];
	let position = 2;
	while (position + 4 <= bytes.length) {
		if (bytes[position] !== 0xff) return undefined;
		const marker = bytes[position + 1]!;
		// Start of scan: the image data follows to the end.
		if (marker === 0xda) {
			kept.push(bytes.subarray(position));
			return concatenate(kept);
		}
		const length = (bytes[position + 2]! << 8) | bytes[position + 3]!;
		const end = position + 2 + length;
		if (length < 2 || end > bytes.length) return undefined;
		if (marker !== 0xe1 && marker !== 0xed) kept.push(bytes.subarray(position, end));
		position = end;
	}
	return undefined;
}

const pngDroppedChunks = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function pngWithoutMetadata(bytes: Uint8Array): Uint8Array | undefined {
	const kept: Uint8Array[] = [bytes.subarray(0, 8)];
	let position = 8;
	while (position + 12 <= bytes.length) {
		const length = ((bytes[position]! << 24) >>> 0) + (bytes[position + 1]! << 16) + (bytes[position + 2]! << 8) + bytes[position + 3]!;
		const type = ascii(bytes, position + 4, 4);
		const end = position + 12 + length;
		if (end > bytes.length) return undefined;
		if (!pngDroppedChunks.has(type)) kept.push(bytes.subarray(position, end));
		position = end;
		if (type === 'IEND') return concatenate(kept);
	}
	return undefined;
}

function webpWithoutMetadata(bytes: Uint8Array): Uint8Array | undefined {
	if (ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return undefined;
	const kept: Uint8Array[] = [];
	let position = 12;
	while (position + 8 <= bytes.length) {
		const type = ascii(bytes, position, 4);
		const length = bytes[position + 4]! + (bytes[position + 5]! << 8) + (bytes[position + 6]! << 16) + ((bytes[position + 7]! << 24) >>> 0);
		const end = position + 8 + length + (length % 2);
		if (end > bytes.length + 1) return undefined;
		const chunk = bytes.slice(position, Math.min(end, bytes.length));
		if (type === 'VP8X') {
			// Clear the "has Exif" and "has XMP" flags, since those chunks are dropped.
			chunk[8] = chunk[8]! & ~0x0c;
			kept.push(chunk);
		} else if (type !== 'EXIF' && type !== 'XMP ') kept.push(chunk);
		position = end;
	}
	const body = concatenate(kept);
	const header = new Uint8Array(12);
	header.set([0x52, 0x49, 0x46, 0x46]);
	const size = body.length + 4;
	header.set([size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >>> 24) & 0xff], 4);
	header.set([0x57, 0x45, 0x42, 0x50], 8);
	return concatenate([header, body]);
}

function concatenate(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

/** SHA-256 of some bytes, as lowercase hex. */
export async function sha256Hex(bytes: Uint8Array | ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The fingerprint of a whole file from the SHA-256 of each 10 MB piece, in
 * order. A file of one piece gets its plain SHA-256, so it matches the
 * fingerprints in research/capture-index.csv. A longer file gets the SHA-256
 * of its pieces' hashes, written one per line: the same file always gives the
 * same fingerprint, without the Worker reading gigabytes again at the end.
 */
export async function fileFingerprint(pieceHashes: readonly string[]): Promise<string> {
	if (pieceHashes.length === 1) return pieceHashes[0]!;
	return `pieces:${await sha256Hex(new TextEncoder().encode(pieceHashes.join('\n')))}`;
}
