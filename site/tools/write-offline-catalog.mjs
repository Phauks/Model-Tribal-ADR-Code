// Writes the catalog of what a reader can save for offline reading into the built site after `vite build`
// (site/DESIGN.md, section 10). Run from site/:
//   node tools/write-offline-catalog.mjs
//
// Settings > This device draws its outline of the site from this catalog: each part of the site, its groups and,
// one group at a time, its pages, with how many pages each holds and how much space they take on a device. Trevor
// asked on Nov. 26, 2026 for one modular outline in place of the fixed list of collections, so that a reader can
// save a whole part, a group or a single page, and see what they chose in the same place.
//
// - offline-catalog.json: the outline down to the groups, with counts and sizes.
// - offline-catalog/<group>.json: the pages of one group, read only when a reader opens that group.
// - offline-catalog/index.json: every page's address, name and list, for "Find a page".
//
// A part is described once, in `parts` below. A group may be split, as the Federal Register is by year. A group whose
// pages are many is cut into runs of `run` pages, named by their first and last page, as a dictionary's page headers
// are, so no list a reader opens is long.
//
// Cases, laws, biographies and the Supreme Court's pages are drawn by the Worker when a reader opens one
// (src/lib/server/page-data.ts), so their HTML is not built. They come from their page data instead, and the space
// one takes once saved is estimated from it: a page and its __data.json took about 83 KB plus 6.4 times the size of
// its page data, fitted on 26 pages of every family drawn by the live site on Nov. 26, 2026.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'devalue';

const output = '.svelte-kit/cloudflare/client';
const catalogFolder = 'offline-catalog';
/** The most pages a list a reader opens shows before it is cut into runs. */
export const run = 50;

/**
 * @typedef {{ court?: string, decidedBy?: string, year?: string }} PageFacts What the sorting below needs from a page's data.
 * @typedef {{ path: string, label: string, files: string[], bytes: number, count?: number, facts?: PageFacts }} Page
 * @typedef {{ key: string, label: string, hint?: string, pages: number, bytes: number, unit?: 'document', run?: true, children?: CatalogNode[], list?: string }} CatalogNode
 * @typedef {(page: Page) => { key: string, label: string } | undefined} Split Splits a group into smaller ones, newest first when the label is a year.
 * @typedef {{ key: string, label: string, hint?: string, test: (page: Page) => boolean, split?: Split }} GroupRule
 * @typedef {{ key: string, label: string, hint?: string, test: (page: Page) => boolean, groups?: GroupRule[], itemOf?: (page: string) => string }} PartRule
 */

/**
 * @param {string} address
 * @param {string} section
 */
function under(address, section) {
	return address === section || address.startsWith(`${section}/`);
}

/** Nations, filled in from the built nation records before the parts are sorted. */
const nations = new Set();
/** The nation a page belongs to: "/nations/navajo-nation/opinions" belongs to "/nations/navajo-nation". */
function nationPageOf(/** @type {string} */ page) {
	const [, , identifier] = page.split('/');
	return identifier && nations.has(identifier) ? `/nations/${identifier}` : undefined;
}

/** @type {Split} */
const byYear = (page) => (page.facts?.year ? { key: page.facts.year, label: page.facts.year } : { key: 'undated', label: 'Undated' });

/** Agencies whose decisions the site lists as cases. */
const agencies = /Board of Indian Appeals|Gaming Commission/;
/** Federal courts, including the territorial Court of Appeals of Indian Territory. */
const federalCourts = /^United States (Court|District|Circuit)|^Court of Appeals of Indian Territory|Court of (Federal )?Claims$/;
/** Courts and bodies of other countries and international bodies. */
const elsewhere = /Commission on Human Rights|U\.N\.|Suprema Corte|Tribunal|\(Canada\)/;

/** @type {PartRule[]} */
export const parts = [
	{
		key: 'nations',
		label: 'Nations',
		test: (page) => under(page.path, '/nations'),
		itemOf: (page) => nationPageOf(page) ?? page,
		groups: [
			{ key: 'nations-each', label: 'Each nation’s page', hint: 'With its court opinions and service pages', test: (page) => nationPageOf(page.path) !== undefined },
			{ key: 'nations-charts', label: 'Maps, tables and charts', test: (page) => under(page.path, '/nations/data') || under(page.path, '/nations/map') },
			{ key: 'nations-lists', label: 'Lists of nations', hint: 'All nations, and by letter and by state', test: () => true }
		]
	},
	{
		key: 'laws',
		label: 'Laws',
		test: (page) => under(page.path, '/laws'),
		groups: [
			{ key: 'laws-treaties', label: 'Treaties and agreements', test: (page) => /^\/laws\/(treaty|agreement|supplementary-treaty)-/.test(page.path) },
			{ key: 'laws-acts', label: 'Acts of Congress', test: (page) => /^\/laws\/(public-law|act|statutes-at)-/.test(page.path) },
			{ key: 'laws-code', label: 'United States Code', test: (page) => /^\/laws\/(usc|us-code)-/.test(page.path) },
			{ key: 'laws-regulations', label: 'Code of Federal Regulations', test: (page) => page.path.startsWith('/laws/cfr-') },
			{ key: 'laws-orders', label: 'Executive orders', test: (page) => /^\/laws\/(executive-order|eo)-/.test(page.path) },
			{ key: 'laws-register', label: 'Federal Register notices', hint: 'By year', test: (page) => page.path.startsWith('/laws/federal-register'), split: byYear },
			{ key: 'laws-gaming', label: 'National Indian Gaming Commission', hint: 'Bulletins, decisions, game rulings and enforcement', test: (page) => page.path.startsWith('/laws/nigc-') },
			{ key: 'laws-acknowledgment', label: 'Federal acknowledgment', test: (page) => /^\/laws\/(acknowledgment|bia-recognized)-/.test(page.path) },
			{ key: 'laws-other', label: 'Other laws', test: () => true }
		]
	},
	{
		key: 'cases',
		label: 'Cases',
		test: (page) => under(page.path, '/cases'),
		groups: [
			{ key: 'cases-supreme-court', label: 'Supreme Court of the United States', test: (page) => Boolean(page.facts?.court) },
			{ key: 'cases-federal', label: 'Federal courts', test: (page) => federalCourts.test(page.facts?.decidedBy ?? '') },
			{ key: 'cases-agencies', label: 'Agency decisions', hint: 'Interior Board of Indian Appeals and National Indian Gaming Commission', test: (page) => agencies.test(page.facts?.decidedBy ?? ''), split: byYear },
			{ key: 'cases-elsewhere', label: 'Other countries and international bodies', test: (page) => elsewhere.test(page.facts?.decidedBy ?? '') },
			{ key: 'cases-state', label: 'State courts', test: (page) => Boolean(page.facts?.decidedBy) },
			{ key: 'cases-other', label: 'Other cases', test: () => true }
		]
	},
	{
		key: 'supreme-court',
		label: 'Supreme Court',
		hint: 'Its Justices, Presidents and Courts',
		test: (page) => under(page.path, '/supreme-court'),
		groups: [
			{ key: 'supreme-court-justices', label: 'Justices', test: (page) => under(page.path, '/supreme-court/justices') },
			{ key: 'supreme-court-presidents', label: 'Presidents', test: (page) => under(page.path, '/supreme-court/presidents') },
			{ key: 'supreme-court-courts', label: 'Courts', test: () => true }
		]
	},
	{ key: 'biographies', label: 'Biographies', test: (page) => under(page.path, '/biographies') },
	{ key: 'stories', label: 'Stories', test: (page) => under(page.path, '/stories') },
	{ key: 'glossary', label: 'Glossary', test: (page) => under(page.path, '/glossary') },
	{ key: 'other', label: 'Other pages', hint: 'Home, help, forms, licenses and about pages', test: () => true }
];

/** The page families drawn on request, and where each family's pages are (src/lib/page-data.ts and src/routes). */
const onRequest = [
	{ family: 'cases', prefix: '/cases/' },
	{ family: 'laws', prefix: '/laws/' },
	{ family: 'sections', prefix: '/laws/usc-25/' },
	{ family: 'biographies', prefix: '/biographies/' },
	{ family: 'justices', prefix: '/supreme-court/justices/' },
	{ family: 'presidents', prefix: '/supreme-court/presidents/' },
	{ family: 'courts', prefix: '/supreme-court/' }
];

/** About how many bytes a page drawn on request takes once saved, from the size of its page data (see the top). */
export function onRequestBytes(/** @type {number} */ dataBytes) {
	return Math.round(83000 + 6.4 * dataBytes);
}

/** A year in a page's facts: "Published July 27, 2009", "Decided January 5, 1993". */
function yearOf(/** @type {unknown} */ facts) {
	const text = JSON.stringify(facts ?? '');
	const match = /\b(1[6-9]\d\d|20\d\d)\b/.exec(text);
	return match?.[1];
}

/**
 * The pages drawn on request, from their page data: name, size and what the sorting needs.
 * @returns {Page[]}
 */
function onRequestPages() {
	/** @type {Page[]} */
	const found = [];
	for (const { family, prefix } of onRequest) {
		const folder = path.join(output, 'page-data', family);
		if (!existsSync(folder)) continue;
		for (const name of readdirSync(folder)) {
			if (!name.endsWith('.json')) continue;
			const key = decodeURIComponent(name.slice(0, -'.json'.length));
			const file = path.join(folder, name);
			const text = readFileSync(file, 'utf8');
			/** @type {Record<string, any>} */
			const data = parse(text);
			const address = `${prefix}${key}`;
			found.push({
				path: address,
				label: typeof data.name === 'string' ? data.name : key,
				files: [address, `${address}/__data.json`],
				bytes: onRequestBytes(Buffer.byteLength(text)),
				facts: {
					court: data.court?.name,
					decidedBy: data.decidedBy?.name,
					year: yearOf(data.glance ?? data.facts)
				}
			});
		}
	}
	return found;
}

/** Addresses that are never saved for offline reading (mirrors neverCached in src/service-worker/index.ts). */
const neverCached = ['/workspace', '/sign-in', '/sign-out', '/requests', '/copies', '/map-tiles', '/zip', '/page-data', '/offline-catalog'];

/** The address a built file is served at. */
function addressOf(/** @type {string} */ file) {
	const address = `/${file.split(path.sep).join('/')}`;
	if (address === '/index.html') return '/';
	return address.endsWith('.html') ? address.slice(0, -'.html'.length) : address;
}

/** @returns {string[]} */
function files(/** @type {string} */ folder, prefix = '') {
	/** @type {string[]} */
	const found = [];
	for (const name of readdirSync(path.join(folder, prefix))) {
		const relative = path.join(prefix, name);
		if (statSync(path.join(folder, relative)).isDirectory()) found.push(...files(folder, relative));
		else found.push(relative);
	}
	return found;
}

/** The page's own name, from its <title> ("Navajo Nation · Nations · Model Tribal ADR Code"). */
function titleOf(/** @type {string} */ html, /** @type {string} */ fallback) {
	const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
	const name = title?.split(' · ')[0]?.trim();
	return name ? decode(name) : fallback;
}

function decode(/** @type {string} */ text) {
	return text
		.replaceAll('&amp;', '&')
		.replaceAll('&#39;', '’')
		.replaceAll('&quot;', '"')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

/** Cuts a sorted list into runs named by their first and last entries. */
function runs(/** @type {Page[]} */ pages, /** @type {string} */ key) {
	/** @type {{ key: string, label: string, pages: Page[] }[]} */
	const cut = [];
	for (let start = 0; start < pages.length; start += run) {
		const slice = pages.slice(start, start + run);
		cut.push({ key: `${key}-${cut.length + 1}`, label: `${shortName(slice[0].label)} – ${shortName(slice.at(-1)?.label ?? '')}`, pages: slice });
	}
	return cut;
}

/** Words that do not tell one name from another: "United States v." begins hundreds of cases. */
const commonWords = new Set(['v.', 'v', 'of', 'the', 'and', 'in', 're', 'ex', 'parte', 'united', 'states', 'tribe', 'nation', 'treaty', 'with', 'agreement', 'executive', 'order', 'no.', 'act', '&']);

/** The first words of a name, up to the first word that tells it apart, for a run's label: "United States v. Kagama", "Brendale v. Confederated…". */
export function shortName(/** @type {string} */ name) {
	const words = name.replace(/^[[(]/, '').split(/\s+/);
	let end = 0;
	while (end < words.length && end < 6 && (end < 2 || commonWords.has(words[end - 1].toLowerCase().replace(/[,;:]$/, '')))) end += 1;
	return end >= words.length ? words.join(' ') : `${words.slice(0, end).join(' ')}…`;
}

const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' });

function main() {
	if (!existsSync(output)) {
		console.error(`${output} does not exist. Run vite build first.`);
		process.exit(1);
	}
	/** Every page of the build, with the files saved for it. */
	/** @type {Map<string, Page>} */
	const pages = new Map();
	for (const file of files(output)) {
		if (file.startsWith(`_app${path.sep}`)) continue;
		const address = addressOf(file);
		if (neverCached.some((prefix) => under(address, prefix))) continue;
		const recordMatch = /^\/nations\/([^/]+)\/record\.json$/.exec(address);
		if (recordMatch) nations.add(recordMatch[1]);
		const isPage = file.endsWith('.html');
		const isData = address.endsWith('/__data.json');
		// A nation's preview, which the map reads when a nation is pointed at; the other files beside a page are downloads.
		const isPreview = /^\/nations\/[^/]+\/preview\.json$/.test(address);
		if (!isPage && !isData && !isPreview) continue;
		const page = isPage ? address : address === '/__data.json' ? '/' : address.slice(0, address.lastIndexOf('/'));
		const bytes = statSync(path.join(output, file)).size;
		const entry = pages.get(page) ?? { path: page, label: page, files: [], bytes: 0 };
		entry.files.push(address);
		entry.bytes += bytes;
		if (isPage) entry.label = titleOf(readFileSync(path.join(output, file), 'utf8'), page);
		pages.set(page, entry);
	}
	// A data file whose page is not built (an endpoint's data) is not a page.
	for (const [address, entry] of pages) {
		if (!entry.files.some((file) => !file.endsWith('.json'))) pages.delete(address);
	}
	for (const page of onRequestPages()) if (!pages.has(page.path)) pages.set(page.path, page);

	rmSync(path.join(output, catalogFolder), { recursive: true, force: true });
	mkdirSync(path.join(output, catalogFolder), { recursive: true });

	/** Sorts pages into a part's groups, folds a nation's pages into one entry, and writes each list. */
	const sorted = new Set();
	/** @type {CatalogNode[]} */
	const catalog = [];
	for (const part of parts) {
		const mine = [...pages.values()].filter((page) => !sorted.has(page.path) && part.test(page));
		for (const page of mine) sorted.add(page.path);
		const groups = part.groups ?? [{ key: part.key, label: part.label, hint: part.hint, test: () => true }];
		const taken = new Set();
		/** @type {CatalogNode[]} */
		const children = [];
		for (const group of groups) {
			const members = mine.filter((page) => !taken.has(page.path) && group.test(page));
			for (const page of members) taken.add(page.path);
			/** @type {Map<string, Page>} */
			const items = new Map();
			for (const page of members) {
				const itemPath = part.itemOf?.(page.path) ?? page.path;
				const item = items.get(itemPath) ?? { path: itemPath, label: '', files: [], bytes: 0, facts: page.facts };
				if (page.path === itemPath) item.label = page.label;
				item.files.push(...page.files);
				item.bytes += page.bytes;
				items.set(itemPath, item);
			}
			const list = [...items.values()].map((item) => ({ ...item, label: item.label || item.path }));
			if (list.length === 0) continue;
			children.push(groupNode(group.key, group.label, group.hint, list, { split: group.split, count: pageCount }));
		}
		if (children.length === 0) continue;
		catalog.push(
			part.groups
				? { key: part.key, label: part.label, ...(part.hint ? { hint: part.hint } : {}), pages: sum(children, 'pages'), bytes: sum(children, 'bytes'), children }
				: { ...children[0], key: part.key, label: part.label, ...(part.hint ? { hint: part.hint } : {}) }
		);
	}
	const documents = documentsPart();
	if (documents) catalog.push(documents);
	// Every page's name and the list it is in, for the outline's filter, read the first time a reader types in it.
	writeFileSync(path.join(output, catalogFolder, 'index.json'), `${JSON.stringify(searchIndex)}\n`);
	const version = JSON.parse(readFileSync(path.join(output, '_app', 'version.json'), 'utf8')).version;
	writeFileSync(path.join(output, 'offline-catalog.json'), `${JSON.stringify({ version, parts: catalog })}\n`);
	console.log(`Offline catalog: ${catalog.map((part) => `${part.label} ${part.pages}`).join(', ')}`);
}

/** @param {CatalogNode[]} nodes @param {'pages' | 'bytes'} field */
function sum(nodes, field) {
	return nodes.reduce((total, node) => total + node[field], 0);
}

/** The pages an entry stands for: a nation's entry holds its page and its opinions and service pages. */
function pageCount(/** @type {Page[]} */ items) {
	return items.reduce((total, item) => total + item.files.filter((file) => !file.endsWith('.json')).length, 0);
}

/** The documents an entry stands for: one copy, or a nation's set. */
function documentCount(/** @type {Page[]} */ items) {
	return items.reduce((total, item) => total + (item.count ?? 1), 0);
}

/**
 * A group of the outline, split if its rule says so, and cut into runs when its list is long, with each list written.
 * @param {string} key
 * @param {string} label
 * @param {string | undefined} hint
 * @param {Page[]} list
 * @param {{ split?: Split, count: (items: Page[]) => number, unit?: 'document' }} how
 * @returns {CatalogNode}
 */
function groupNode(key, label, hint, list, how) {
	const unit = how.unit ? { unit: how.unit } : {};
	/** @type {CatalogNode} */
	const node = { key, label, ...(hint ? { hint } : {}), pages: how.count(list), bytes: list.reduce((total, item) => total + item.bytes, 0), ...unit };
	if (how.split && list.length > run) {
		/** @type {Map<string, { label: string, items: Page[] }>} */
		const parts = new Map();
		for (const item of list) {
			const part = how.split(item);
			const name = part?.key ?? 'other';
			const entry = parts.get(name) ?? { label: part?.label ?? 'Other', items: [] };
			entry.items.push(item);
			parts.set(name, entry);
		}
		// Years newest first; anything else after them, in order.
		const ordered = [...parts.entries()].sort(([a], [b]) => {
			const yearA = /^\d{4}$/.test(a);
			const yearB = /^\d{4}$/.test(b);
			if (yearA && yearB) return b.localeCompare(a);
			if (yearA !== yearB) return yearA ? -1 : 1;
			return collator.compare(a, b);
		});
		// The oldest years hold few pages each: they share one group, as long as it stays short.
		const years = ordered.filter(([name]) => /^\d{4}$/.test(name));
		/** @type {[string, { label: string, items: Page[] }][]} */
		const earliest = [];
		while (years.length > 1 && earliest.reduce((total, [, part]) => total + part.items.length, 0) + (years.at(-1)?.[1].items.length ?? 0) <= run) {
			const oldest = years.pop();
			if (oldest) earliest.unshift(oldest);
		}
		const kept = ordered.filter((entry) => !earliest.includes(entry));
		if (earliest.length > 1) {
			const merged = { label: `${earliest.at(-1)?.[0]}–${earliest[0][0]}`, items: earliest.flatMap(([, part]) => part.items) };
			kept.splice(years.length, 0, [`${earliest.at(-1)?.[0]}-${earliest[0][0]}`, merged]);
		} else kept.splice(years.length, 0, ...earliest);
		node.children = kept.map(([name, part]) => groupNode(`${key}-${name}`, part.label, undefined, part.items, { count: how.count, ...unit }));
		return node;
	}
	list.sort((a, b) => collator.compare(a.label, b.label));
	if (list.length > run) {
		node.children = runs(list, key).map((slice) => {
			writeList(slice.key, slice.pages);
			return { key: slice.key, label: slice.label, run: true, pages: how.count(slice.pages), bytes: slice.pages.reduce((total, item) => total + item.bytes, 0), ...unit, list: `/${catalogFolder}/${slice.key}.json` };
		});
	} else {
		writeList(key, list);
		node.list = `/${catalogFolder}/${key}.json`;
	}
	return node;
}

/** Where the United States documents come from, by the folder of their copies, for the outline's groups. */
const documentSources = [
	{ key: 'opinions', label: 'Court opinions', test: /^(caselaw-access-project|state-court-opinions|supremecourt\.gov|federal-reports|fjc\.gov|[a-z.]*uscourts\.gov)$/ },
	{ key: 'ibia', label: 'Interior Board of Indian Appeals decisions', test: /^ibia-decisions$/, split: true },
	{ key: 'register', label: 'Federal Register', test: /^federal-register$/, split: true },
	{ key: 'statutes', label: 'Statutes and the United States Code', test: /^(govinfo|united-states-code|congress)$/ },
	{ key: 'regulations', label: 'Code of Federal Regulations', test: /^code-of-federal-regulations$/ },
	{ key: 'orders', label: 'Executive orders', test: /^executive-orders$/ },
	{ key: 'treaties', label: 'Treaties', test: /^treaties$/ },
	{ key: 'gaming', label: 'National Indian Gaming Commission', test: /^(nigc|gaming)$/ },
	{ key: 'acknowledgment', label: 'Federal acknowledgment and recognition lists', test: /^(acknowledgment|recognition-lists|jurisdiction)$/ },
	{ key: 'oklahoma', label: 'Oklahoma state-tribal agreements', test: /^oklahoma-secretary-of-state$/ },
	{ key: 'maps', label: 'Maps', test: /^(tile\.loc\.gov|historic-maps|land-cessions)$/ },
	{ key: 'other', label: 'Other documents', test: /./ }
];

/**
 * The year of a United States document, for the groups split by year: from a Federal Register document number
 * ("2020-21558", "E9-17121" for 2009, "99-8851" for 1999), else a year in parentheses in its title ("39 IBIA 253
 * (2004)"), else a year in its address.
 */
export function documentYear(/** @type {string} */ address, /** @type {string} */ title) {
	const name = address.split('/').pop() ?? '';
	if (address.includes('/federal-register/')) {
		const full = /^(19[3-9]\d|20\d\d)-/.exec(name);
		if (full) return full[1];
		const oneDigit = /^[A-Z](\d)-/.exec(name);
		if (oneDigit) return `200${oneDigit[1]}`;
		const twoDigits = /^[A-Z]?(\d\d)-/.exec(name);
		if (twoDigits) return `${Number(twoDigits[1]) >= 50 ? 19 : 20}${twoDigits[1]}`;
	}
	const inTitle = /\((?:[^()]*\s)?(1[6-9]\d\d|20\d\d)\)/.exec(title);
	if (inTitle) return inTitle[1];
	return /\b(1[6-9]\d\d|20\d\d)\b/.exec(address.split('/').slice(3).join('/'))?.[1];
}

/**
 * The documents this site holds and may share (src/lib/offline-documents.ts): the United States documents one by one,
 * grouped by where they come from, and each nation's constitutions, laws and court opinions together, as the nation's
 * page saves them.
 * @returns {CatalogNode | undefined}
 */
function documentsPart() {
	const summaryFile = path.join(output, 'copies', 'offline.json');
	if (!existsSync(summaryFile)) return undefined;
	/** @type {{ federal?: { title: string, count: number, bytes: number }, nations?: Record<string, { title: string, count: number, bytes: number }> }} */
	const summary = JSON.parse(readFileSync(summaryFile, 'utf8'));
	/** @type {CatalogNode[]} */
	const children = [];
	const federalFile = path.join(output, 'copies', 'offline', 'federal.json');
	if (summary.federal && existsSync(federalFile)) {
		/** @type {{ files: [string, number, string, string?][] }} */
		const federal = JSON.parse(readFileSync(federalFile, 'utf8'));
		/** @type {Map<string, Page[]>} */
		const bySource = new Map();
		for (const [address, bytes, , title] of federal.files) {
			const folder = address.split('/')[2] ?? '';
			const source = documentSources.find((item) => item.test.test(folder)) ?? documentSources.at(-1);
			if (!source) continue;
			const year = documentYear(address, title ?? '');
			const list = bySource.get(source.key) ?? [];
			list.push({ path: address, label: (title ?? address).trim(), files: [], bytes, facts: { year } });
			bySource.set(source.key, list);
		}
		/** @type {CatalogNode[]} */
		const groups = documentSources
			.filter((source) => bySource.has(source.key))
			.map((source) => groupNode(`documents-federal-${source.key}`, source.label, undefined, bySource.get(source.key) ?? [], { split: source.split ? byYear : undefined, count: documentCount, unit: 'document' }));
		children.push({ key: 'documents-federal', label: 'United States documents', hint: 'Laws, regulations, opinions and reports from federal and state sources', pages: sum(groups, 'pages'), bytes: sum(groups, 'bytes'), unit: 'document', children: groups });
	}
	if (summary.nations && Object.keys(summary.nations).length > 0) {
		/** @type {Page[]} */
		const list = Object.entries(summary.nations).map(([nation, set]) => ({ path: `/nations/${nation}#documents`, label: set.title, files: [], bytes: set.bytes, count: set.count }));
		children.push(groupNode('documents-nations', 'Nations’ constitutions, laws and court opinions', 'Saved one nation at a time', list, { count: documentCount, unit: 'document' }));
	}
	if (children.length === 0) return undefined;
	return { key: 'documents', label: 'Documents this site holds', pages: sum(children, 'pages'), bytes: sum(children, 'bytes'), unit: 'document', children };
}

/** @type {[string, string, string][]} Each page's address, name and list. */
const searchIndex = [];

/** A page's data file: "/x" has "/x/__data.json", and the home page has "/__data.json". */
function dataFileOf(/** @type {string} */ page) {
	return page === '/' ? '/__data.json' : `${page}/__data.json`;
}

/** One list a reader can open: each entry's address, name, files and size. */
function writeList(/** @type {string} */ key, /** @type {Page[]} */ list) {
	for (const item of list) searchIndex.push([item.path, item.label, key]);
	// Most pages are saved as the page and its __data.json, which the list leaves out (filesOf in src/lib/offline-choices.ts).
	const entries = list.map((item) => {
		const files = item.files.sort();
		const usual = files.length === 2 && files[0] === item.path && files[1] === dataFileOf(item.path);
		return { path: item.path, label: item.label, ...(usual ? {} : { files }), bytes: item.bytes, ...(item.count ? { count: item.count } : {}) };
	});
	writeFileSync(path.join(output, catalogFolder, `${key}.json`), `${JSON.stringify(entries)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
