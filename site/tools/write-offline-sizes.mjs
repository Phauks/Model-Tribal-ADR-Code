// Writes offline-sizes.json into the built site after `vite build`: about how
// many bytes each collection a reader can save for offline reading takes
// (site/DESIGN.md, section 10). Settings shows it before the reader saves, as
// Trevor asked on Nov. 22, 2026. Run from site/:
//   node tools/write-offline-sizes.mjs
//
// It counts the prerendered pages and their data files, which are what the
// service worker saves for a collection. The sorting into collections repeats
// collectionOf in src/lib/offline-collections.ts; tests/offline-sizes.test.ts
// checks that the two agree.

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const output = '.svelte-kit/cloudflare/client';
const staticFolder = 'static';
/** Files the service worker never saves as part of a collection. */
const skipped = new Set(['/manifest.webmanifest', '/icon.svg', '/edition.json', '/offline-sizes.json', '/service-worker.js', '/_headers', '/_redirects', '/_routes.json']);
const neverCached = ['/workspace', '/sign-in', '/sign-out', '/requests'];

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
 * @returns {'nations' | 'glossary' | 'other'}
 */
export function collectionOf(address) {
	const page = pageOf(address);
	if (under(page, '/nations')) return 'nations';
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
	const bytes = { nations: 0, glossary: 0, other: 0 };
	for (const file of files(output)) {
		if (file.startsWith(`_app${path.sep}`)) continue;
		const address = addressOf(file);
		if (skipped.has(address) || staticFiles.has(address) || address.startsWith('/fonts/')) continue;
		if (/\/nations\/[^/]+\/image$/.test(address)) continue;
		if (neverCached.some((prefix) => under(address, prefix))) continue;
		bytes[collectionOf(address)] += statSync(path.join(output, file)).size;
	}
	writeFileSync(path.join(output, 'offline-sizes.json'), `${JSON.stringify(bytes)}\n`);
	console.log(`Offline sizes: ${JSON.stringify(bytes)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
