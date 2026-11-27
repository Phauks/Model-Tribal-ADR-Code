/**
 * Several search results in one .zip, put together when a reader asks (src/lib/search-selection.ts).
 * The search page sends each chosen result's link, title and group with the reader's choices. The
 * Worker looks each link up in the records built with the site and takes a file only from there,
 * only a copy on the build's list of copies it may serve, and only one every nation it belongs to lets
 * the site show (src/lib/nation-restrictions.ts): a copy a nation hid leaves its result out, and one
 * a nation asked to cite only is listed by its citation and where it was published. Everything else
 * is listed by its citation and link. Files are streamed from the bucket, never held whole.
 */
import { error } from '@sveltejs/kit';
import { siteName } from '#lib';
import { fileNumber, searchSelectionFiles, spreadFilePath } from '#lib/built-files.ts';
import { bibtexFile, risFile, type CitationItem } from '#lib/citation-formats.ts';
import { citePage, indigoDate } from '#lib/citation-styles.ts';
import { csvLine } from '#lib/csv.ts';
import { dayOf } from '#lib/download-names.ts';
import { plainCitation } from '#lib/essay-citation-files.ts';
import { resultGroupLabels } from '#lib/search-everything.ts';
import {
	citationFileNames,
	citationsAlone,
	filePaths,
	readSelectionRequest,
	readmeName,
	selectionListName,
	suggestedZipName,
	sumsName,
	type SelectionOptions,
	type SelectionRequest
} from '#lib/search-selection.ts';
import { servedCopies, type ServedCopy } from '#lib/server/copy-list.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { citationsFor } from '#lib/server/essay-citations.ts';
import { copyLevels } from '#lib/server/nation-restrictions.ts';
import type { SelectionRecord } from '#lib/server/search-selection.ts';
import { zipStream, type ZipEntry } from '#lib/server/zip-stream.ts';
import { verifierReadme, verifyPowerShell, verifyPowerShellName, verifyShell, verifyShellName } from '#lib/zip-verifiers.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

type Fetch = typeof fetch;

/** The built records of these links, read from the private files that hold them (src/lib/built-files.ts). */
async function selectionRecords(links: string[], fetcher: Fetch, origin: string): Promise<Map<string, SelectionRecord>> {
	const assets = workerEnvironment().ASSETS;
	const numbers = [...new Set(links.map((link) => fileNumber(link, searchSelectionFiles.count)))];
	const files = new Map<number, Record<string, SelectionRecord>>();
	await Promise.all(
		numbers.map(async (number) => {
			const address = new URL(spreadFilePath(searchSelectionFiles, number), origin).toString();
			// The Worker reads its static files directly; the development server draws them as it goes.
			const response = assets ? await assets.fetch(address) : await fetcher(address);
			if (!response.ok) throw new Error(`Reading ${address} failed: ${response.status}`);
			files.set(number, (await response.json()) as Record<string, SelectionRecord>);
		})
	);
	const found = new Map<string, SelectionRecord>();
	for (const link of links) {
		const record = files.get(fileNumber(link, searchSelectionFiles.count))?.[link];
		if (record) found.set(link, record);
	}
	return found;
}

/** One result as it goes in the .zip. */
interface Planned {
	link: string;
	title: string;
	group: SelectionRequest['items'][number]['group'];
	nation?: string;
	record?: SelectionRecord;
	/** The copy that goes in as a file, when this site may share it and the bucket has it. */
	copy?: ServedCopy;
	/** Where a cited-only copy was published, in place of this site's copy. */
	original?: string;
}

const absolute = (link: string, origin: string) => (link.startsWith('/') ? `${origin}${link}` : link);

function readme(options: SelectionOptions, planned: Planned[], filed: number, query: string, origin: string, made: Date): string {
	const linked = planned.length - filed;
	const citations = citationFileNames[options.format];
	const lines = [
		'Search results from the Tribal Law Project',
		'',
		`From the Tribal Law Project website, ${origin}, made ${indigoDate(made)}${query ? `, from a search for “${query}”` : ''}.`,
		'',
		options.files
			? `It holds ${planned.length} ${planned.length === 1 ? 'result' : 'results'}: ${filed} as ${filed === 1 ? 'a file' : 'files'}, the website’s own copies of works it may share (works of the United States government, and nations’ constitutions, laws and court opinions), and ${linked} by ${linked === 1 ? 'its' : 'their'} citation and link, since ${linked === 1 ? 'it is a page or a work' : 'they are pages or works'} the website does not share as files.`
			: `It lists ${planned.length} ${planned.length === 1 ? 'result' : 'results'} by citation and link.`
	];
	const parts: string[] = [];
	if (options.citations) parts.push(`${citations}: each result’s citation${options.format === 'txt' ? ' in Indigo Book form' : options.format === 'ris' ? ' as RIS, for reference managers such as Zotero' : ' as BibTeX'}.`);
	if (options.list) parts.push(`${selectionListName}: each result’s title, kind, nation, year, link, where it was published, and its file in this .zip with its size and SHA-256.`);
	if (options.sums && filed > 0) parts.push(`${sumsName}: the SHA-256 of each file, in the form sha256sum -c reads.`);
	if (parts.length > 0) lines.push('', ...parts);
	if (options.sums && filed > 0) {
		lines.push('', `To check that a file is the one the website published, unchanged, choose it on Verify File at ${origin}/verify, or compare its SHA-256 with ${sumsName}.`);
		if (options.verify) lines.push('', verifierReadme(`${origin}/verify`));
	}
	lines.push('', 'This file cannot be changed after you download it. If a nation has asked for a document to be removed, the website no longer offers it: check the website for the current list, and please delete a removed document from your copy.', '');
	return lines.join('\r\n');
}

/** The ASCII form of a file name for the header, with the full name beside it for browsers that read it. */
function disposition(name: string): string {
	const plain = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	return `attachment; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export const POST: RequestHandler = async ({ request, fetch, url }) => {
	const form = await request.formData().catch(() => /* expected: a body that is not a form chose nothing, answered 400 below */ undefined);
	const text = form?.get('selection');
	const selection = typeof text === 'string' ? readSelectionRequest(text) : undefined;
	if (!selection) error(400, 'Choose at least one search result to download.');
	const { options, query } = selection;
	const environment = workerEnvironment();
	const bucket = environment.sourceDocuments;

	const records = await selectionRecords(
		selection.items.map((item) => item.link),
		fetch,
		url.origin
	);
	const copyKeys = [...records.values()].flatMap((record) => (record.copy ? [record.copy] : []));
	const copies = await servedCopies(copyKeys);
	const levels = await copyLevels(environment.database, [...copies.values()]);

	const planned: Planned[] = [];
	for (const item of selection.items) {
		const record = records.get(item.link);
		const copy = record?.copy ? copies.get(record.copy) : undefined;
		const level = copy ? levels.get(copy.key) : undefined;
		// A copy a nation hid is not offered at all, so neither is its result.
		if (level === 'hide') continue;
		planned.push({
			...item,
			...(record?.nation ? { nation: record.nation } : {}),
			record,
			...(copy && !level && options.files ? { copy } : {}),
			...(copy && level === 'cite' ? { original: copy.links[0] } : {})
		});
	}
	if (planned.length === 0) error(404, 'None of these results can be downloaded.');

	// Only files the bucket holds go in; the rest are listed with their links.
	if (options.files && bucket) {
		const held = await Promise.all(planned.map((item) => (item.copy ? bucket.head(item.copy.key) : null)));
		planned.forEach((item, index) => {
			if (item.copy && !held[index]) delete item.copy;
		});
	} else {
		for (const item of planned) delete item.copy;
	}

	const made = new Date();
	const paths = filePaths(
		planned.map((item) => ({ title: item.title, group: item.group, nation: item.nation, file: item.copy ? [item.copy.bytes, `/copies/${item.copy.key}`] : undefined })),
		options
	);
	const filed = paths.filter(Boolean).length;

	// Citations: the source record's, in the project's Indigo Book form, else a citation to the page or the work's own address.
	const sourceKeys = planned.flatMap((item) => (item.record?.source ? [item.record.source] : []));
	const citations = options.citations && options.format === 'txt' ? await citationsFor(sourceKeys) : new Map<string, string>();
	const citationText = (item: Planned): string => {
		const html = item.record?.source ? citations.get(item.record.source) : undefined;
		if (html) return plainCitation(html);
		const address = absolute(item.original ?? item.link, url.origin);
		if (item.link.startsWith('/') && !item.original) return citePage('indigo', { title: item.title, siteName, address, visited: made }).text;
		return `${item.title}, ${address} (last visited ${indigoDate(made)}).`;
	};
	const citationItem = (item: Planned, index: number): CitationItem =>
		item.record?.item ?? {
			id: `result-${index + 1}`,
			type: 'webpage',
			title: item.title,
			...(item.link.startsWith('/') && !item.original ? { 'container-title': siteName } : {}),
			URL: absolute(item.original ?? item.link, url.origin),
			accessed: { 'date-parts': [[made.getUTCFullYear(), made.getUTCMonth() + 1, made.getUTCDate()]] }
		};
	const citationsFile = (): string => {
		if (options.format === 'ris') return risFile(planned.map(citationItem));
		if (options.format === 'bib') return bibtexFile(planned.map(citationItem));
		return `${planned.map((item) => citationText(item)).join('\r\n\r\n')}\r\n`;
	};

	const stem = options.name || suggestedZipName(query, dayOf(made));
	const encoder = new TextEncoder();

	if (citationsAlone(options)) {
		return new Response(citationsFile(), {
			headers: {
				'content-type': options.format === 'bib' ? 'application/x-bibtex; charset=utf-8' : options.format === 'ris' ? 'application/x-research-info-systems; charset=utf-8' : 'text/plain; charset=utf-8',
				'content-disposition': disposition(`${stem}.${options.format}`),
				'cache-control': 'no-store'
			}
		});
	}

	const listLines = [csvLine(['title', 'kind', 'nation', 'year', 'link', 'published_at', 'file', 'bytes', 'sha256'])];
	const sums: string[] = [];
	planned.forEach((item, index) => {
		const path = paths[index];
		const original = item.original ?? item.record?.original ?? (item.link.startsWith('/') ? '' : item.link);
		listLines.push(
			csvLine([
				item.title,
				resultGroupLabels[item.group],
				item.nation ?? '',
				item.record?.year ?? '',
				item.link.startsWith('/') ? absolute(item.link, url.origin) : '',
				original,
				path ?? '',
				path && item.copy ? item.copy.bytes : '',
				path && item.copy ? item.copy.sha256 : ''
			])
		);
		if (path && item.copy) sums.push(`${item.copy.sha256}  ${path}\n`);
	});

	async function* entries(): AsyncGenerator<ZipEntry> {
		if (options.readme) yield { name: readmeName, open: async () => encoder.encode(readme(options, planned, filed, query, url.origin, made)) };
		if (options.citations) yield { name: citationFileNames[options.format], open: async () => encoder.encode(citationsFile()) };
		if (options.list) yield { name: selectionListName, open: async () => encoder.encode(`${listLines.join('\r\n')}\r\n`) };
		if (options.sums && sums.length > 0) {
			yield { name: sumsName, open: async () => encoder.encode(sums.join('')) };
			if (options.verify) {
				yield { name: verifyShellName, open: async () => encoder.encode(verifyShell) };
				yield { name: verifyPowerShellName, open: async () => encoder.encode(verifyPowerShell) };
			}
		}
		for (const [index, item] of planned.entries()) {
			const path = paths[index];
			if (!path || !item.copy || !bucket) continue;
			const key = item.copy.key;
			yield {
				name: path,
				open: async () => {
					const object = await bucket.get(key);
					return (object?.body as unknown as ReadableStream<Uint8Array> | undefined) ?? undefined;
				}
			};
		}
	}

	return new Response(zipStream(entries()), {
		headers: {
			'content-type': 'application/zip',
			'content-disposition': disposition(`${stem}.zip`),
			'cache-control': 'no-store'
		}
	});
};

