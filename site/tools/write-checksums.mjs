// Writes the SHA-256 of every file a reader can download into the built site, after `vite build`
// and tools/write-offline-sizes.mjs (site/DESIGN.md, section 10, "Checking a file"). Trevor asked
// on Nov. 23, 2026 for every download and document to come with a way to check it. Run from site/:
//   node tools/write-checksums.mjs
//
// - checksums.json: { built, files: { "/path": { sha256, bytes } } } for every download and every
//   copy of a document the site holds (src/lib/checksums.ts reads it);
// - checksums.txt: the same list in the form sha256sum reads, "<hash>  <path>";
// - checksums/downloads.json: the downloads only, without the copies and each nation's own files.
//
// A download is a built file a reader saves rather than reads: a spreadsheet, ZIP, PDF, Word or
// EPUB file, a model court form under /help/forms, or one of the JSON files the Download menu and
// the Downloads page offer. The copies' hashes come from the built list of copies, /copies/list.csv,
// which takes them from the capture index, since the copies themselves are served from the bucket.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const output = '.svelte-kit/cloudflare/client';
const downloadExtensions = new Set(['.csv', '.zip', '.pdf', '.docx', '.odt', '.epub']);
const downloadFolders = ['/help/forms/'];
const downloadData = new Set(['/nations/recourse/provisions.json', '/glossary/terms.json']);
const nationFile = /^\/nations\/[a-z0-9-]+\/(record|sources)\.json$/;
const ownFiles = new Set(['/checksums.json', '/checksums.txt', '/checksums/downloads.json']);

/**
 * Whether a built file is one a reader downloads.
 * @param {string} address
 */
export function isDownload(address) {
	if (ownFiles.has(address) || address.startsWith('/_app/') || address.startsWith('/fonts/')) return false;
	if (address.endsWith('.html') || address.endsWith('/__data.json')) return false;
	if (downloadFolders.some((folder) => address.startsWith(folder))) return true;
	if (downloadData.has(address) || nationFile.test(address)) return true;
	return downloadExtensions.has(path.posix.extname(address).toLowerCase());
}

/**
 * Whether a download belongs on the small list the Downloads page reads.
 * @param {string} address
 */
export function isListedDownload(address) {
	return isDownload(address) && !nationFile.test(address);
}

/**
 * Reads a CSV file into rows of fields, with quoted fields and doubled quotes.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
	/** @type {string[][]} */
	const rows = [];
	/** @type {string[]} */
	let row = [];
	let field = '';
	let quoted = false;
	for (let index = 0; index < text.length; index += 1) {
		const character = text[index];
		if (quoted) {
			if (character === '"' && text[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (character === '"') quoted = false;
			else field += character;
		} else if (character === '"') quoted = true;
		else if (character === ',') {
			row.push(field);
			field = '';
		} else if (character === '\n' || character === '\r') {
			if (character === '\r' && text[index + 1] === '\n') index += 1;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else field += character;
	}
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

/**
 * The copies in the built list of copies, by their address on this site.
 * @param {string} csv
 * @returns {Record<string, { sha256: string, bytes: number }>}
 */
export function copyChecksums(csv) {
	const [header, ...rows] = parseCsv(csv);
	if (!header) return {};
	const at = (/** @type {string} */ name) => header.indexOf(name);
	const [copy, sha256, bytes] = [at('copy'), at('sha256'), at('bytes')];
	if (copy < 0 || sha256 < 0 || bytes < 0) throw new Error('/copies/list.csv has no copy, sha256 or bytes column.');
	/** @type {Record<string, { sha256: string, bytes: number }>} */
	const files = {};
	for (const row of rows) {
		if (!row[copy] || !/^[0-9a-f]{64}$/i.test(row[sha256] ?? '')) continue;
		files[row[copy]] = { sha256: row[sha256].toLowerCase(), bytes: Number(row[bytes]) };
	}
	return files;
}

/**
 * The list in the form sha256sum reads. Paths are written without the leading slash.
 * @param {Record<string, { sha256: string }>} files
 */
export function checksumsText(files) {
	return Object.entries(files)
		.map(([address, entry]) => `${entry.sha256}  ${decodeURIComponent(address.slice(1))}\n`)
		.join('');
}

/** @param {string} folder @param {string} prefix @returns {string[]} */
function walk(folder, prefix = '') {
	return readdirSync(folder).flatMap((name) => {
		const full = path.join(folder, name);
		const address = `${prefix}/${name}`;
		return statSync(full).isDirectory() ? walk(full, address) : [address];
	});
}

function main() {
	if (!existsSync(output)) throw new Error(`${output} is missing: run vite build first.`);
	const versionFile = path.join(output, '_app/version.json');
	const built = existsSync(versionFile) ? JSON.parse(readFileSync(versionFile, 'utf8')).version : '';
	/** @type {Record<string, { sha256: string, bytes: number }>} */
	const downloads = {};
	for (const address of walk(output).sort()) {
		if (!isDownload(address)) continue;
		const bytes = readFileSync(path.join(output, address));
		downloads[address] = { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
	}
	const copyList = path.join(output, 'copies/list.csv');
	const copies = existsSync(copyList) ? copyChecksums(readFileSync(copyList, 'utf8')) : {};
	const files = { ...downloads, ...copies };
	const listed = Object.fromEntries(Object.entries(downloads).filter(([address]) => isListedDownload(address)));
	writeFileSync(path.join(output, 'checksums.json'), JSON.stringify({ built, files }));
	writeFileSync(path.join(output, 'checksums.txt'), checksumsText(files));
	mkdirSync(path.join(output, 'checksums'), { recursive: true });
	writeFileSync(path.join(output, 'checksums/downloads.json'), JSON.stringify({ built, files: listed }));
	console.log(
		`Wrote checksums for ${Object.keys(downloads).length} downloads and ${Object.keys(copies).length} copies of documents.`
	);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
