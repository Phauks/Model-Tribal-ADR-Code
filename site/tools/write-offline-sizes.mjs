// Writes two files into the built site after `vite build` (site/DESIGN.md,
// section 10). Run from site/:
//   node tools/write-offline-sizes.mjs
//
// - offline-sizes.json: about how many bytes each collection a reader can save
//   for offline reading takes. Settings shows it before the reader saves, as
//   Trevor asked on Nov. 22, 2026. It counts the prerendered pages and their
//   data files, which are what the service worker saves for a collection.
// - offline-fingerprints.json: a fingerprint of every file a reader may save,
//   so an update downloads only the files that changed, as Trevor asked on
//   Nov. 22, 2026 (src/lib/offline-fingerprints.ts explains how).
//
// The sorting into collections repeats collectionOf in
// src/lib/offline-collections.ts, and the fingerprints repeat
// src/lib/offline-fingerprints.ts; tests/offline-sizes.test.ts and
// tests/offline-fingerprints.test.ts check that each pair agrees.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const output = '.svelte-kit/cloudflare/client';
const staticFolder = 'static';
/** Files the service worker never saves as part of a collection. */
const skipped = new Set(['/manifest.webmanifest', '/icon.svg', '/edition.json', '/offline-sizes.json', '/offline-fingerprints.json', '/service-worker.js', '/_headers', '/_redirects', '/_routes.json']);
/** Files the service worker never saves at all. */
const neverSaved = new Set(['/edition.json', '/offline-sizes.json', '/offline-fingerprints.json', '/service-worker.js', '/_headers', '/_redirects', '/_routes.json']);
const neverCached = ['/workspace', '/sign-in', '/sign-out', '/requests', '/copies', '/map-tiles', '/zip', '/page-data'];

/**
 * The page a file belongs to: "/nations/x/__data.json" belongs to "/nations/x".
 * @param {string} address
 */
function pageOf(address) {
	if (address === '/__data.json') return '/';
	return address.endsWith('/__data.json') ? address.slice(0, -'/__data.json'.length) : address;
}

/**
 * @param {string} address
 * @param {string} section
 */
function under(address, section) {
	return address === section || address.startsWith(`${section}/`);
}

/**
 * Which collection a page or one of its data files belongs to.
 * @param {string} address
 * @returns {'nations' | 'stories' | 'glossary' | 'other'}
 */
export function collectionOf(address) {
	const page = pageOf(address);
	if (under(page, '/nations')) return 'nations';
	if (under(page, '/stories')) return 'stories';
	if (under(page, '/glossary')) return 'glossary';
	return 'other';
}

/**
 * The address a built file is served at: "nations/x.html" is "/nations/x", "index.html" is "/".
 * @param {string} file
 */
export function addressOf(file) {
	const address = `/${file.split(path.sep).join('/')}`;
	if (address === '/index.html') return '/';
	return address.endsWith('.html') ? address.slice(0, -'.html'.length) : address;
}

const versionMark = '\u0000build-version\u0000';
const startNameMark = '\u0000build-start-name\u0000';
const scriptFileMark = '\u0000build-file\u0000';
const startNamePattern = /\b(__sveltekit_[a-z0-9]+)\s*=\s*\{/;
const scriptFilePattern = /\/_app\/immutable\/[A-Za-z0-9._/-]+/g;

/**
 * The start-up object's name in a built page, if it has one.
 * @param {string} page
 */
export function startNameOf(page) {
	return startNamePattern.exec(page)?.[1];
}

/**
 * A built page with its build version and start-up object's name blanked out.
 * @param {string} page
 * @param {string} version
 */
export function withoutBuild(page, version) {
	const startName = startNameOf(page);
	const blanked = page.replaceAll(version, versionMark);
	return startName ? blanked.replaceAll(startName, startNameMark) : blanked;
}

/**
 * A page from withoutBuild, without the names of the script and style files it loads.
 * @param {string} blanked
 */
export function shownText(blanked) {
	return blanked.replace(scriptFilePattern, scriptFileMark);
}

/**
 * The first 16 hexadecimal digits of the SHA-256 digest of some text or bytes.
 * @param {string | Buffer} content
 */
export function fingerprintOf(content) {
	return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Every file under a folder, as paths relative to it.
 * @param {string} folder
 * @param {string} [prefix]
 * @returns {string[]}
 */
function files(folder, prefix = '') {
	/** @type {string[]} */
	const found = [];
	for (const name of readdirSync(path.join(folder, prefix))) {
		const relative = path.join(prefix, name);
		if (statSync(path.join(folder, relative)).isDirectory()) found.push(...files(folder, relative));
		else found.push(relative);
	}
	return found;
}

function main() {
	if (!existsSync(output)) {
		console.error(`${output} does not exist. Run vite build first.`);
		process.exit(1);
	}
	const staticFiles = new Set(existsSync(staticFolder) ? files(staticFolder).map(addressOf) : []);
	const version = JSON.parse(readFileSync(path.join(output, '_app', 'version.json'), 'utf8')).version;
	const startName = startNameOf(readFileSync(path.join(output, 'index.html'), 'utf8'));
	if (typeof version !== 'string' || !startName) {
		console.error('Could not read the build version or start-up name from the built site.');
		process.exit(1);
	}
	const bytes = { nations: 0, stories: 0, glossary: 0, other: 0 };
	/** @type {Record<string, string>} */
	const fingerprintedFiles = {};
	/** @type {Record<string, string>} */
	const pages = {};
	for (const file of files(output)) {
		if (file.startsWith(`_app${path.sep}`)) continue;
		const address = addressOf(file);
		if (neverSaved.has(address) || /\/nations\/[^/]+\/image$/.test(address)) continue;
		if (neverCached.some((prefix) => under(address, prefix))) continue;
		// Files made to be downloaded into other programs, which the service worker never saves (downloadOnly there).
		if (/\.(ris|bib|vcf|geojson)$/.test(address)) continue;
		const content = readFileSync(path.join(output, file));
		if (file.endsWith('.html')) {
			const blanked = withoutBuild(content.toString('utf8'), version);
			fingerprintedFiles[address] = fingerprintOf(blanked);
			pages[address] = fingerprintOf(shownText(blanked));
		} else {
			fingerprintedFiles[address] = fingerprintOf(content);
		}
		if (skipped.has(address) || staticFiles.has(address) || address.startsWith('/fonts/')) continue;
		bytes[collectionOf(address)] += content.length;
	}
	writeFileSync(path.join(output, 'offline-sizes.json'), `${JSON.stringify(bytes)}\n`);
	console.log(`Offline sizes: ${JSON.stringify(bytes)}`);
	const fingerprints = { version, startName, files: fingerprintedFiles, pages };
	writeFileSync(path.join(output, 'offline-fingerprints.json'), `${JSON.stringify(fingerprints)}\n`);
	console.log(`Offline fingerprints: ${Object.keys(fingerprintedFiles).length} files, ${Object.keys(pages).length} pages`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
