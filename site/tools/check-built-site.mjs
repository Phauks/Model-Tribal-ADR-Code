// Checks the built site after `npm run build`. Run from site/:
//   node tools/check-built-site.mjs
//
// - Every page declares its language, has a title, exactly one h1 and a
//   main landmark to skip to (site/DESIGN.md, section 9).
// - The core pages, the web app manifest, the icon and the service worker
//   exist, so the site stays installable and readable offline (section 10).
// - The manifest is valid JSON with the fields browsers need to install it.
// - The offline fingerprints belong to this build and list every page, so an
//   update downloads only what changed (section 10, "Updates").

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const output = '.svelte-kit/cloudflare/client';
const required = [
	'index.html',
	'glossary.html',
	'changelog.html',
	'acknowledgments.html',
	'nations.html',
	'stories.html',
	'offline.html',
	'downloads.html',
	'manifest.webmanifest',
	'icon.svg',
	'service-worker.js',
	'offline-fingerprints.json'
];

const problems = [];
const problem = (message) => problems.push(message);

if (!existsSync(output)) {
	console.error(`${output} does not exist. Run npm run build first.`);
	process.exit(1);
}

for (const file of required) {
	if (!existsSync(path.join(output, file))) problem(`${file} is missing from the build`);
}

function htmlFiles(folder) {
	const found = [];
	for (const name of readdirSync(folder)) {
		const full = path.join(folder, name);
		if (statSync(full).isDirectory()) {
			if (name !== '_app') found.push(...htmlFiles(full));
		} else if (name.endsWith('.html')) {
			found.push(full);
		}
	}
	return found;
}

const pages = htmlFiles(output);

if (existsSync(path.join(output, 'offline-fingerprints.json'))) {
	const fingerprints = JSON.parse(readFileSync(path.join(output, 'offline-fingerprints.json'), 'utf8'));
	const { version } = JSON.parse(readFileSync(path.join(output, '_app', 'version.json'), 'utf8'));
	if (fingerprints.version !== version) problem('offline-fingerprints.json is not from this build');
	// /copies is read from the network only, so it has no fingerprint.
	for (const file of pages) {
		const address = `/${path.relative(output, file).split(path.sep).join('/')}`.replace(/(\/index)?\.html$/, '') || '/';
		if (!(address in (fingerprints.pages ?? {})) && address !== '/copies') problem(`offline-fingerprints.json does not list ${address}`);
	}
}
for (const file of pages) {
	const html = readFileSync(file, 'utf8');
	const name = path.relative(output, file);
	if (!/<html lang="[a-z]{2,3}(-[A-Za-z0-9]+)*"/.test(html)) problem(`${name}: <html> has no lang`);
	if (!/<title>[^<]+<\/title>/.test(html)) problem(`${name}: no <title>`);
	const headings = html.match(/<h1[\s>]/g) ?? [];
	if (headings.length !== 1) problem(`${name}: ${headings.length} h1 headings, expected 1`);
	if (!html.includes('id="main-content"')) problem(`${name}: no main-content landmark`);
	if (!html.includes('href="#main-content"')) problem(`${name}: no skip link`);
	if (html.normalize('NFC') !== html) problem(`${name}: not in Unicode Normalization Form C`);
}

const manifestPath = path.join(output, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
	try {
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		for (const field of ['name', 'short_name', 'start_url', 'display', 'icons']) {
			if (!manifest[field]) problem(`manifest.webmanifest: no ${field}`);
		}
	} catch (error) {
		problem(`manifest.webmanifest is not valid JSON: ${error.message}`);
	}
}

if (problems.length > 0) {
	console.error(problems.join('\n'));
	console.error(`\n${problems.length} problem(s) in the built site.`);
	process.exit(1);
}
console.log(`Built site checked: ${pages.length} pages.`);
