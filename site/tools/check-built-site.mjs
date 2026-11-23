// Checks the built site after `npm run build`. Run from site/:
//   node tools/check-built-site.mjs
//
// - Every page declares its language, has a title, exactly one h1 and a
//   main landmark to skip to (site/DESIGN.md, section 9).
// - The core pages, the web app manifest, the icon and the service worker
//   exist, so the site stays installable and readable offline (section 10).
// - The manifest is valid JSON with the fields browsers need to install it.
// - No link goes to GitHub unless it says so: the link's words, or the words
//   just before it, name GitHub (site/DESIGN.md, section 6, "Links stay on
//   the site"). The project's own documents are pages on the site instead.
// - No page names the project's internal documents, such as "decision record
//   0007" or "requests.md" (same section; Trevor, Nov. 22, 2026).
// - The offline fingerprints belong to this build and list every page, so an
//   update downloads only what changed (section 10, "Updates").
// - The tiled map's data gives every land area in the table a dot inside the
//   area's box that leads to its row (section 11).

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
	'starred.html',
	'starred/shared.html',
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
	// /copies and its lists are read from the network only, so they have no fingerprint.
	for (const file of pages) {
		const address = `/${path.relative(output, file).split(path.sep).join('/')}`.replace(/(\/index)?\.html$/, '') || '/';
		const networkOnly = address === '/copies' || address.startsWith('/copies/');
		if (!(address in (fingerprints.pages ?? {})) && !networkOnly) problem(`offline-fingerprints.json does not list ${address}`);
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
	const words = html
		.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, ' ')
		.replace(/<[^>]+>/g, ' ');
	for (const mention of words.matchAll(/decision records?\s+\d+|\b[\w./-]+\.md\b/gi)) {
		problem(`${name}: names an internal project document: "${mention[0]}"`);
	}
	for (const link of html.matchAll(/<a\b[^>]*href="https?:\/\/(?:www\.)?github\.com[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
		const words = link[1].replace(/<[^>]+>/g, ' ');
		const before = html.slice(Math.max(0, link.index - 160), link.index).replace(/<[^>]+>/g, ' ');
		if (!/github/i.test(words) && !/github/i.test(before)) {
			problem(`${name}: a link to GitHub does not say it goes to GitHub: ${link[0].slice(0, 160)}`);
		}
	}
}

const tileMapPath = path.join(output, 'nations/map/tile-map.json');
const landAreasPath = path.join(output, 'nations/map/land-areas.json');
if (!existsSync(tileMapPath) || !existsSync(landAreasPath)) {
	problem('nations/map/tile-map.json or land-areas.json is missing from the build');
} else {
	const tileMap = JSON.parse(readFileSync(tileMapPath, 'utf8'));
	const rows = new Set(JSON.parse(readFileSync(landAreasPath, 'utf8')).rows.map((row) => row.anchor));
	if (tileMap.areas.length !== rows.size) problem(`tile-map.json has ${tileMap.areas.length} land areas; the table has ${rows.size}`);
	for (const area of tileMap.areas) {
		if (!rows.has(area.anchor)) problem(`tile-map.json: land area ${area.code} has no row in the table`);
		if (!area.label?.trim()) problem(`tile-map.json: land area ${area.code} has no label`);
		const [west, south, east, north] = area.bounds;
		const [longitude, latitude] = area.point;
		// An area across the 180th meridian has west greater than east.
		const inside = latitude >= south && latitude <= north && (west > east || (longitude >= west && longitude <= east));
		if (!inside) problem(`tile-map.json: land area ${area.code}'s dot is outside its box`);
	}
	// Each shaded view (src/lib/shaded-map-views.ts): every shaded area on the tiled map goes to a row its table has.
	for (const [view, shading] of Object.entries(tileMap.shading ?? {})) {
		const viewPath = path.join(output, `nations/map/views/${view}.json`);
		if (!existsSync(viewPath)) {
			problem(`nations/map/views/${view}.json is missing from the build`);
			continue;
		}
		const body = JSON.parse(readFileSync(viewPath, 'utf8'));
		const anchors = [...body.nationRows, ...body.areaRows, ...(body.stateRows ?? [])].map((row) => row.anchor);
		const viewRows = new Set(anchors);
		// Two rows with one id would break the links to them and the table itself.
		if (viewRows.size !== anchors.length) problem(`views/${view}.json has ${anchors.length - viewRows.size} rows with an id another row has`);
		if (!body.drawing?.startsWith('<svg')) problem(`views/${view}.json has no drawing`);
		for (const [code, area] of Object.entries(shading.areas)) {
			if (!viewRows.has(area.anchor)) problem(`tile-map.json: ${view} sends land area ${code} to ${area.anchor}, which is not a row of its table`);
		}
		for (const [nation, office] of Object.entries(shading.offices ?? {})) {
			if (!viewRows.has(office.anchor)) problem(`tile-map.json: ${view} sends the office of ${nation} to ${office.anchor}, which is not a row of its table`);
		}
		// The by-state map: every state it shades goes to a row of the by-state table, and the drawn copy is there for it.
		for (const [state, shaded] of Object.entries(shading.states ?? {})) {
			if (!viewRows.has(shaded.anchor)) problem(`tile-map.json: ${view} sends the state ${state} to ${shaded.anchor}, which is not a row of its by-state table`);
		}
		if ((body.stateRows ?? []).length > 0 && !body.stateDrawing?.startsWith('<svg')) problem(`views/${view}.json has a by-state table but no by-state drawing`);
	}
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
