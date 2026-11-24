/**
 * Files made when the site is built, filtered by what nations chose the site
 * shows of their own laws and court opinions (src/lib/restricted-files.ts).
 * The Worker sends requests for these files here
 * (tools/nation-page-changes-worker.js), since the static files would
 * otherwise answer before it saw them. With nothing restricted, or nothing
 * in the file, the file goes out as built.
 *
 * The address names a public file, and the answer is that file as any
 * reader may have it, so asking here directly shows nothing more.
 */
import { error } from '@sveltejs/kit';
import { strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { workerEnvironment } from '#lib/server/environment.ts';
import { siteRestrictions } from '#lib/server/site-restrictions.ts';
import {
	filterBuilderFile,
	filterCopiesCsv,
	filterCopyDetails,
	filterLawItems,
	filterOfflineList,
	filterSearchRecords,
	filterTimelineRows,
	type BuilderFile,
	type SiteRestrictions
} from '#lib/restricted-files.ts';
import { timelineCsv, type TimelineRow } from '#lib/timeline.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

type Assets = { fetch(request: Request | string): Promise<Response> };

interface RestrictedFile {
	pattern: RegExp;
	/** The built file the answer is made from: the file itself unless given. */
	from?: (match: RegExpExecArray) => string;
	filter: (text: string, restrictions: SiteRestrictions, match: RegExpExecArray, assets: Assets, origin: string) => Promise<string | Uint8Array> | string | Uint8Array;
	binary?: boolean;
}

const json = (value: unknown) => JSON.stringify(value);

/** The files the Worker filters, by their address. Keep in step with filteredFiles in tools/nation-page-changes-worker.js. */
const restrictedFiles: RestrictedFile[] = [
	{ pattern: /^\/search\/records\.json$/, filter: (text, restrictions) => json(filterSearchRecords(JSON.parse(text), restrictions)) },
	{ pattern: /^\/copies\/list\.csv$/, filter: (text, restrictions) => filterCopiesCsv(text, restrictions) },
	{
		pattern: /^\/copies\/offline\/nations\/([a-z0-9-]+)\.json$/,
		filter: (text, restrictions) => json(filterOfflineList(JSON.parse(text) as { files: unknown[][] }, restrictions))
	},
	{ pattern: /^\/copies\/details\/[0-9a-f]{2}\.json$/, filter: (text, restrictions) => json(filterCopyDetails(JSON.parse(text), restrictions)) },
	{
		pattern: /^\/nations\/([a-z0-9-]+)\/timeline\.json$/,
		filter: (text, restrictions, match) => json(filterTimelineRows(JSON.parse(text), restrictions, match[1]))
	},
	{
		pattern: /^\/nations\/([a-z0-9-]+)\/timeline\.csv$/,
		from: (match) => `/nations/${match[1]}/timeline.json`,
		filter: (text, restrictions, match) => timelineCsv(filterTimelineRows(JSON.parse(text), restrictions, match[1]))
	},
	{ pattern: /^\/nations\/timeline\/entries\.json$/, filter: (text, restrictions) => json(filterTimelineRows(JSON.parse(text), restrictions)) },
	{
		pattern: /^\/nations\/timeline\/entries\.csv$/,
		from: () => '/nations/timeline/entries.json',
		filter: (text, restrictions) => timelineCsv(filterTimelineRows(JSON.parse(text), restrictions))
	},
	{
		pattern: /^\/nations\/law\/([a-z0-9-]+)\.json$/,
		filter: (text, restrictions) => {
			const file = JSON.parse(text) as { items: { link?: string }[] };
			return json({ ...file, items: filterLawItems(file.items, restrictions) });
		}
	},
	{ pattern: /^\/nations\/data\/build\/([a-z-]+)\.json$/, filter: (text, restrictions) => json(filterBuilderFile(JSON.parse(text) as BuilderFile, restrictions)) },
	{ pattern: /^\/zip\/data\.zip$/, binary: true, filter: (_text, restrictions, _match, assets, origin) => filteredDataZip(restrictions, assets, origin) }
];

/** The same request without the conditions that would let the files answer "not modified". */
function plainRequest(address: URL, request: Request): Request {
	const headers = new Headers(request.headers);
	headers.delete('if-none-match');
	headers.delete('if-modified-since');
	return new Request(address, { method: 'GET', headers });
}

async function hex(content: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', content as Uint8Array<ArrayBuffer>);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

let zipCache: { key: string; zip: Uint8Array } | undefined;

/**
 * All the data in one ZIP (/zip/data.zip), with its list of copies and its
 * timeline filtered as their own files are, and SHA256SUMS.txt made again
 * for them. Kept until the restrictions or the build change.
 */
async function filteredDataZip(restrictions: SiteRestrictions, assets: Assets, origin: string): Promise<Uint8Array> {
	const built = await assets.fetch(new URL('/zip/data.zip', origin).toString());
	const key = `${restrictions.stamp}-${built.headers.get('etag') ?? ''}`;
	if (zipCache?.key === key) {
		await built.body?.cancel();
		return zipCache.zip;
	}
	const files: Zippable = unzipSync(new Uint8Array(await built.arrayBuffer()));
	const decoder = new TextDecoder();
	const text = (name: string) => (files[name] ? decoder.decode(files[name] as Uint8Array) : undefined);
	const copies = text('document-copies.csv');
	if (copies !== undefined) files['document-copies.csv'] = strToU8(filterCopiesCsv(copies, restrictions));
	if (files['timeline.csv']) {
		const entries = await assets.fetch(new URL('/nations/timeline/entries.json', origin).toString());
		if (entries.ok) files['timeline.csv'] = strToU8(timelineCsv(filterTimelineRows((await entries.json()) as TimelineRow[], restrictions)));
	}
	const sums: string[] = [];
	for (const [name, content] of Object.entries(files)) {
		if (name === 'SHA256SUMS.txt') continue;
		sums.push(`${await hex(content as Uint8Array)}  ${name}\n`);
	}
	files['SHA256SUMS.txt'] = strToU8(sums.join(''));
	const zip = zipSync(files, { level: 6 });
	zipCache = { key, zip };
	return zip;
}

export const GET: RequestHandler = async ({ params, request, url }) => {
	const path = `/${params.path}`;
	let match: RegExpExecArray | null = null;
	const file = restrictedFiles.find((candidate) => (match = candidate.pattern.exec(path)));
	if (!file || !match) error(404, 'Not found');
	const environment = workerEnvironment();
	const assets = environment.ASSETS;
	if (!assets) error(404, 'Not found');
	const address = new URL(path, url);
	const restrictions = await siteRestrictions(environment.database, assets, url.origin);
	// Nothing restricted: the file as built, answering "not modified" as it would.
	if (!restrictions) return assets.fetch(new Request(address, { method: request.method, headers: request.headers }));

	const built = await assets.fetch(plainRequest(address, request));
	if (built.status !== 200) return built;
	const source = file.from ? await assets.fetch(new URL(file.from(match), url).toString()) : built;
	if (source.status !== 200) return built;
	const text = file.binary ? '' : await source.text();
	const body = await file.filter(text, restrictions, match, assets, url.origin);
	if (file.from) await built.body?.cancel();

	const headers = new Headers(built.headers);
	const builtTag = (built.headers.get('etag') ?? '').replace(/^W\//, '').replaceAll('"', '');
	headers.set('etag', `W/"restricted-${restrictions.stamp.replace(/[^\w-]/g, '')}-${builtTag}"`);
	headers.delete('content-length');
	headers.set('cache-control', 'no-cache');
	if (request.headers.get('if-none-match') === headers.get('etag')) return new Response(null, { status: 304, headers });
	return new Response(request.method === 'HEAD' ? null : (body as BodyInit), { status: 200, headers });
};
