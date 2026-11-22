#!/usr/bin/env node
/**
 * Finds the public documents the website links to that it may keep its own
 * copy of, downloads each one and files it in the capture index with
 * scripts/captures/mirror_captures.py (decision record 0027), marked for
 * redistribution. The website then serves the copy at /copies/<key>
 * (src/lib/public-copies.ts).
 *
 * Which documents qualify:
 *
 * - Source records whose rights say "us-government-work" or "public-domain"
 *   with redistribution: true, when the link is a PDF on a United States
 *   government site, or a Federal Register document page (the copy is the
 *   official PDF of that document, found with the Federal Register API).
 * - The Statutes at Large, Public Law and Federal Register citations that
 *   nation pages link to GovInfo (src/lib/legal-citations.ts).
 *
 * Web pages (the eCFR, the Legal Information Institute) are not copied: a
 * page changes, and a copy of it would go stale. Nations' laws and
 * constitutions, and anything under copyright, are never copied (they are
 * link-only: docs/data-model.md, "Permission statuses", and the rights field of each record).
 *
 * Run from site/:
 *
 *   node tools/fetch-public-copies.mjs --out DIR [--jobs 4] [--limit N] [--file CAPTURES]
 *
 * --out keeps the downloads and writes DIR/plan.json, one entry per file;
 * DIR/progress.jsonl lets a stopped run start again where it left off.
 * --jobs sets how many downloads run at once.
 * --file runs mirror_captures.py add for each new file, with --captures
 * CAPTURES (the local captures folder the script files into). Files already
 * in research/capture-index.csv, matched by SHA-256, are not filed again.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../src/lib/csv.ts';
import { citationParts } from '../src/lib/legal-citations.ts';
import { nations, repositoryRoot, sources } from '../src/lib/server/content.ts';

const userAgent = 'model-tribal-adr-code research copy (public documents)';
/** Larger files stay link-only; the Worker would not fill them either (largestFill in public-copy-serving.ts). */
const largestCopy = 64 * 1024 * 1024;
const governmentWork = 'Work of the United States government; no copyright (17 U.S.C. § 105).';

function option(name) {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
}

const outFolder = option('--out');
if (!outFolder) {
	console.error('Usage: node tools/fetch-public-copies.mjs --out DIR [--jobs 4] [--limit N] [--file CAPTURES]');
	process.exit(2);
}
const limit = Number(option('--limit') ?? Infinity);
const capturesFolder = option('--file');
mkdirSync(outFolder, { recursive: true });

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function isGovernment(link) {
	try {
		const address = new URL(link);
		return address.protocol === 'https:' && address.hostname.endsWith('.gov');
	} catch {
		return false;
	}
}

const federalRegisterPage = /^https:\/\/www\.federalregister\.gov\/(?:documents|d)\/(?:\d{4}\/\d{2}\/\d{2}\/)?([0-9A-Za-z-]+?)(?:\/|$)/;

/** Candidates, by the address they are fetched from: { links, title, records, rights }. */
const candidates = new Map();

function addCandidate(fetchLink, entry) {
	const existing = candidates.get(fetchLink);
	if (existing) {
		for (const link of entry.links) if (!existing.links.includes(link)) existing.links.push(link);
		for (const record of entry.records) if (!existing.records.includes(record)) existing.records.push(record);
		for (const nation of entry.nations ?? []) if (!existing.nations.includes(nation)) existing.nations.push(nation);
		return;
	}
	candidates.set(fetchLink, { ...entry, links: [...entry.links], records: [...entry.records], nations: [...(entry.nations ?? [])] });
}

const federalRegisterNumbers = new Map(); // document number -> { pages, records, rights }

for (const record of sources().values()) {
	const rights = record.rights ?? {};
	if (!['us-government-work', 'public-domain'].includes(rights.basis) || rights.redistribution !== true) continue;
	const links = [...new Set([record.original_link, record.citation?.URL].filter(Boolean))];
	for (const link of links) {
		const page = federalRegisterPage.exec(link);
		if (page) {
			const entry = federalRegisterNumbers.get(page[1]) ?? { pages: [], records: [], title: record.citation?.title };
			if (!entry.pages.includes(link)) entry.pages.push(link);
			if (!entry.records.includes(record.key)) entry.records.push(record.key);
			federalRegisterNumbers.set(page[1], entry);
		} else if (isGovernment(link) && (/\.pdf($|[?#])/i.test(link) || /link-type=pdf/.test(link))) {
			addCandidate(link, {
				links: [link],
				title: record.citation?.title ?? record.key,
				records: [record.key],
				rights: rights.basis_note ?? governmentWork
			});
		}
	}
}

for (const nation of nations()) {
	for (const fact of nation.recognition ?? []) {
		if (!fact.legal_basis) continue;
		for (const part of citationParts(fact.legal_basis)) {
			if (part.link && part.link.startsWith('https://www.govinfo.gov/link/')) {
				addCandidate(part.link, { links: [part.link], title: part.text, records: [], nations: [nation.id], rights: governmentWork });
			}
		}
	}
}

// The Federal Register API gives each document's official PDF, twenty at a time.
const numbers = [...federalRegisterNumbers.keys()];
for (let start = 0; start < numbers.length; start += 20) {
	const batch = numbers.slice(start, start + 20);
	const response = await fetch(
		`https://www.federalregister.gov/api/v1/documents/${batch.join(',')}.json?fields[]=document_number&fields[]=pdf_url&fields[]=title&fields[]=citation`,
		{ headers: { 'User-Agent': userAgent } }
	);
	const found = response.ok ? await response.json() : {};
	const results = found.results ?? (found.document_number ? [found] : []);
	for (const result of results) {
		const entry = federalRegisterNumbers.get(result.document_number);
		if (!entry || !result.pdf_url) continue;
		addCandidate(result.pdf_url, {
			links: [result.pdf_url, ...entry.pages],
			title: result.citation ? `${result.title}, ${result.citation}` : result.title,
			records: entry.records,
			rights: governmentWork
		});
	}
	await pause(300);
}

/** The capture index's SHA-256 values, so a file already filed is not filed twice. */
const indexPath = path.join(repositoryRoot, 'research', 'capture-index.csv');
const indexed = new Map(
	existsSync(indexPath) ? parseCsv(readFileSync(indexPath, 'utf8')).map((row) => [row.sha256, row]) : []
);

/** The key of a copy: govinfo/<package>/<file> for GovInfo, else <host>/<path>. */
function keyFor(finalLink) {
	const address = new URL(finalLink);
	const govinfo = /^\/content\/pkg\/([^/]+)\/pdf\/([^/]+\.pdf)$/i.exec(address.pathname);
	if (address.hostname === 'www.govinfo.gov' && govinfo) return { topic: 'govinfo', name: `${govinfo[1]}/${govinfo[2]}` };
	const name = decodeURIComponent(address.pathname)
		.replace(/^\/+/, '')
		.replace(/\s+/g, '-')
		.replace(/[^A-Za-z0-9._/-]/g, '_');
	return { topic: address.hostname.replace(/^www\./, ''), name: name.endsWith('.pdf') ? name : `${name}.pdf` };
}

/**
 * One download. Its result is appended to DIR/progress.jsonl, so a run that
 * stops can start again where it left off.
 */
async function download(fetchLink, entry) {
	const response = await fetch(fetchLink, { redirect: 'follow', headers: { 'User-Agent': userAgent } });
	const length = Number(response.headers.get('content-length') ?? 0);
	if (length > largestCopy) {
		await response.body?.cancel();
		return { skipped: { link: fetchLink, reason: `too large (${Math.round(length / 1048576)} MB); stays link-only` } };
	}
	const bytes = Buffer.from(await response.arrayBuffer());
	if (bytes.length > largestCopy) return { skipped: { link: fetchLink, reason: 'too large; stays link-only' } };
	if (!response.ok || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
		return { skipped: { link: fetchLink, reason: response.ok ? 'not a PDF' : `HTTP ${response.status}` } };
	}
	const finalLink = response.url.replace(/#.*$/, '');
	const sha256 = createHash('sha256').update(bytes).digest('hex');
	const { topic, name } = keyFor(finalLink);
	const file = path.join(outFolder, topic, name);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, bytes);
	// The address that serves the PDF directly comes first: the Worker fetches from it.
	const links = [...new Set([finalLink, ...entry.links])].filter(isGovernment);
	return {
		item: {
			file,
			topic,
			name,
			key: `${topic}/${name}`,
			sha256,
			bytes: bytes.length,
			links,
			title: entry.title,
			records: entry.records,
			nations: entry.nations ?? [],
			rights: entry.rights
		}
	};
}

const progressPath = path.join(outFolder, 'progress.jsonl');
const done = new Map(
	existsSync(progressPath)
		? readFileSync(progressPath, 'utf8')
				.split('\n')
				.filter(Boolean)
				.map((line) => JSON.parse(line))
				.map((result) => [result.fetchLink, result])
		: []
);
const queue = [...candidates].filter(([fetchLink]) => !done.has(fetchLink)).slice(0, limit);
const jobs = Number(option('--jobs') ?? 4);
let next = 0;
await Promise.all(
	Array.from({ length: jobs }, async () => {
		while (next < queue.length) {
			const [fetchLink, entry] = queue[next];
			next += 1;
			let result;
			try {
				result = { fetchLink, ...(await download(fetchLink, entry)) };
			} catch (problem) {
				result = { fetchLink, skipped: { link: fetchLink, reason: String(problem) } };
			}
			done.set(fetchLink, result);
			appendFileSync(progressPath, `${JSON.stringify(result)}\n`);
			if (done.size % 25 === 0) console.log(`${done.size} of ${candidates.size} done`);
			await pause(250);
		}
	})
);

const results = [...candidates.keys()].flatMap((fetchLink) => (done.has(fetchLink) ? [done.get(fetchLink)] : []));
// Two citations can lead to the same file; it is filed once, with every link and record.
const byKey = new Map();
for (const { item } of results.filter((result) => result.item)) {
	const existing = byKey.get(item.key);
	if (!existing) {
		byKey.set(item.key, { ...item, links: [...item.links], records: [...item.records], nations: [...item.nations] });
		continue;
	}
	for (const field of ['links', 'records', 'nations']) {
		for (const value of item[field]) if (!existing[field].includes(value)) existing[field].push(value);
	}
}
const plan = [...byKey.values()].map((item) => ({ ...item, already_indexed: indexed.get(item.sha256)?.key ?? null }));
const skipped = results.filter((result) => result.skipped).map((result) => result.skipped);

writeFileSync(path.join(outFolder, 'plan.json'), `${JSON.stringify({ plan, skipped }, null, '\t')}\n`);
console.log(`${candidates.size} candidates; ${plan.length} files; ${skipped.length} skipped.`);

if (capturesFolder) {
	const script = path.join(repositoryRoot, 'scripts', 'captures', 'mirror_captures.py');
	for (const item of plan) {
		if (item.already_indexed) continue;
		const argumentsList = [
			script,
			'add',
			'--captures',
			capturesFolder,
			'--topic',
			item.topic,
			'--name',
			item.name,
			'--title',
			item.title,
			'--obtained',
			'downloaded by site/tools/fetch-public-copies.mjs',
			'--redistribution',
			'yes',
			'--rights',
			item.rights,
			...item.links.flatMap((link) => ['--link', link]),
			...(item.records.length > 0 ? ['--record', item.records.join(';')] : []),
			...(item.nations.length > 0 ? ['--nations', item.nations.join(';')] : []),
			item.file
		];
		execFileSync('python3', argumentsList, { stdio: 'inherit' });
	}
}
