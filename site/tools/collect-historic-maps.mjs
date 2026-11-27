// Collects the rest of steps A and B of the historic maps study (research/analyses/2026-11-26-historic-maps-of-indian-lands.md; Trevor, 2026-11-26: "lets get A, and B"), beside what tools/build-historic-maps.mjs already holds (Royce's sheets, the Forest Service's cessions, the Census years):
//
// - A: the Bureau of Indian Affairs' land area representations (its national land areas, its Oklahoma Tribal Statistical Areas and its supplemental areas), saved as GeoJSON. They are today's areas only; the Bureau publishes no past years.
// - B: the Library of Congress's scans of historic maps of Indian lands, the rows marked "keep" in research/reviews/2026-11-26-historic-maps-library-of-congress.csv. Each is kept as the Library's JPEG 2000 file and as a JPEG (with a thumbnail) the site's image viewer can show. geography/historic-map-scans.json lists them with their bucket keys, sizes and SHA-256 (geography/historic-map-scans-served.json is the short list the website reads), and their source records are content/sources/*/<record>.yaml.
//
// Commands, from site/:
//   node tools/collect-historic-maps.mjs fetch [--work folder]    downloads the Bureau's areas, then each kept map's record and scans from the Library (slowly: the Library turns away fast robots)
//   node tools/collect-historic-maps.mjs build [--work folder]    makes the JPEGs and thumbnails, writes geography/historic-map-scans.json and the maps' source records
//   node tools/collect-historic-maps.mjs upload [--work folder]   puts every file in the bucket, skipping files already there with the same SHA-256 (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID or R2_ACCOUNT_ID)
//   node tools/collect-historic-maps.mjs index [--work folder]    adds a row for each uploaded file to research/capture-index.csv, so the site serves the scans as copies (/copies/historic-maps/...)
//
// Turning the JPEG 2000 scans into JPEGs needs ImageMagick (`magick` or `convert`) with OpenJPEG. None of these maps is drawn on the website's map yet: the scans are not georeferenced, and the Bureau's areas wait for a mockup of a layer for them.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { addToCaptureIndex } from './capture-index.mjs';

const root = new URL('../../', import.meta.url);
const scansPath = new URL('site/geography/historic-map-scans.json', root);
const servedPath = new URL('site/geography/historic-map-scans-served.json', root);
const listPath = new URL('research/reviews/2026-11-26-historic-maps-library-of-congress.csv', root);
const sourcesFolder = new URL('content/sources/', root);

const bureau = 'https://biamaps.geoplatform.gov/server/rest/services/DivLTR';
/** The Bureau of Indian Affairs' land area layers: file name, map service and title. */
export const bureauLayers = [
	['national-land-areas.geojson', `${bureau}/BIA_AIAN_National_LAR/FeatureServer/0`, 'American Indian and Alaska Native Land Area Representations (national)'],
	['tribal-statistical-areas.geojson', `${bureau}/BIA_AIAN_Tribal_Statistical_Areas/FeatureServer/0`, 'Tribal Statistical Areas (Oklahoma)'],
	['supplemental-land-areas.geojson', `${bureau}/BIA_AIAN_LAR_Supplemental/FeatureServer/0`, 'Land Area Representations, supplemental areas']
];
const bureauRecord = 'bia-land-area-representations';
const bureauPrefix = 'historic-maps/bia-land-areas/';
const scansPrefix = 'historic-maps/library-of-congress/';
const agent = 'Mozilla/5.0 (compatible; model-tribal-code-maps/1.0)';

function option(name, fallback) {
	const index = process.argv.indexOf(`--${name}`);
	return index > 0 ? process.argv[index + 1] : fallback;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function download(url, path) {
	if (existsSync(path) && statSync(path).size > 0) return;
	for (let attempt = 1; ; attempt += 1) {
		let problem;
		try {
			const response = await fetch(url, { headers: { 'User-Agent': agent } });
			if (response.ok) {
				writeFileSync(path, new Uint8Array(await response.arrayBuffer()));
				return;
			}
			problem = `answered ${response.status}`;
		} catch (error) {
			// A connection cut off partway is tried again, like a refusal.
			problem = `failed (${error.message})`;
		}
		if (attempt === 5) throw new Error(`${url} ${problem}`);
		await pause(20000 * attempt);
	}
}

/** Reads a small CSV file (fields may be quoted) into objects. */
function readCsv(text) {
	const rows = [];
	let field = '';
	let row = [];
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
		} else if (character === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (character !== '\r') field += character;
	}
	if (field !== '' || row.length) rows.push([...row, field]);
	const [header, ...body] = rows;
	return body.map((values) => Object.fromEntries(header.map((name, index) => [name, values[index] ?? ''])));
}

/** The Library of Congress maps marked "keep" in the review list. */
function keptMaps() {
	return readCsv(readFileSync(listPath, 'utf8')).filter((row) => row.keep === 'yes');
}

const itemId = (url) => url.replace(/\/$/, '').split('/').pop();

/** Downloads every layer of the Bureau's land areas as GeoJSON, a page of features at a time. */
async function fetchBureau(work) {
	const folder = join(work, 'bia');
	mkdirSync(folder, { recursive: true });
	for (const [file, layer] of bureauLayers) {
		const path = join(folder, file);
		if (existsSync(path)) continue;
		const features = [];
		for (let offset = 0; ; offset += 200) {
			const query = new URLSearchParams({ where: '1=1', outFields: '*', f: 'geojson', resultOffset: String(offset), resultRecordCount: '200', orderByFields: 'OBJECTID' });
			const page = await (await fetch(`${layer}/query?${query}`, { headers: { 'User-Agent': agent } })).json();
			features.push(...page.features);
			if (page.features.length < 200) break;
		}
		writeFileSync(path, JSON.stringify({ type: 'FeatureCollection', features }));
		console.log(`${file}: ${features.length} areas.`);
	}
}

/** Downloads each kept map's record from the Library, then its JPEG 2000 scans. */
async function fetchScans(work) {
	const folder = join(work, 'loc');
	mkdirSync(folder, { recursive: true });
	for (const row of keptMaps()) {
		const id = itemId(row.url);
		const recordPath = join(folder, `${id}.json`);
		if (!existsSync(recordPath)) {
			await download(`${row.url.replace(/\/$/, '')}/?fo=json`, recordPath);
			await pause(6000);
		}
		const record = JSON.parse(readFileSync(recordPath, 'utf8'));
		for (const image of imagesOf(record)) {
			await download(image.url, join(folder, `${id}-${basename(image.url)}`));
			await pause(1000);
		}
	}
	console.log(`Downloaded ${keptMaps().length} maps' records and scans to ${folder}.`);
}

/** The JPEG 2000 file of each image in a Library record. */
function imagesOf(record) {
	return (record.resources ?? []).flatMap((resource) => (resource.files ?? []).map((files) => files.find((file) => file.mimetype === 'image/jp2')).filter(Boolean));
}

function imageTool() {
	for (const name of ['magick', 'convert']) {
		try {
			execFileSync('which', [name], { stdio: 'ignore' });
			return name;
		} catch {
			// Try the next name.
		}
	}
	throw new Error('Install ImageMagick with OpenJPEG to turn the JPEG 2000 scans into JPEGs.');
}

const entry = (path, key, mediaType) => {
	const bytes = readFileSync(path);
	return { key, media_type: mediaType, bytes: bytes.length, sha256: sha256(bytes) };
};

const first = (value) => (Array.isArray(value) ? value[0] : value) ?? '';
const plain = (text) => String(text ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function slug(text) {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.split('-')
		.slice(0, 10)
		.join('-');
}

/** Makes the JPEGs and thumbnails and writes geography/historic-map-scans.json. */
function buildScans(work) {
	const tool = imageTool();
	const folder = join(work, 'loc');
	const jpegs = join(work, 'loc-jpeg');
	mkdirSync(jpegs, { recursive: true });
	const used = new Set();
	const maps = keptMaps().map((row) => {
		const id = itemId(row.url);
		const record = JSON.parse(readFileSync(join(folder, `${id}.json`), 'utf8'));
		const item = record.item ?? {};
		const year = Number(String(item.date ?? row.date).match(/\d{4}/)?.[0]) || null;
		const rights = plain(first(item.rights_advisory) || first(item.rights));
		let key = `${slug(plain(item.title ?? row.title))}${year ? `-${year}` : ''}`;
		if (used.has(key)) key = `${key}-${id}`;
		used.add(key);
		const images = imagesOf(record).map((image, number) => {
			const name = `${id}-${basename(image.url)}`;
			const original = join(folder, name);
			const jpeg = join(jpegs, name.replace(/\.jp2$/, '.jpg'));
			const thumbnail = join(jpegs, name.replace(/\.jp2$/, '-small.jpg'));
			if (!existsSync(jpeg)) {
				try {
					execFileSync(tool, [original, '-quality', '85', jpeg], { stdio: 'ignore' });
				} catch {
					// A scan too big for ImageMagick's limits is decoded at a lower resolution for the viewer; the JPEG 2000 file keeps the full one.
					execFileSync(tool, ['-define', 'jp2:reduce-factor=1', original, '-quality', '85', jpeg]);
				}
			}
			if (!existsSync(thumbnail)) execFileSync(tool, [jpeg, '-resize', '240x240', '-quality', '80', thumbnail]);
			return {
				number: number + 1,
				width: image.width ?? null,
				height: image.height ?? null,
				original: { ...entry(original, `${scansPrefix}${name}`, 'image/jp2'), link: image.url },
				image: entry(jpeg, `${scansPrefix}${basename(jpeg)}`, 'image/jpeg'),
				thumbnail: entry(thumbnail, `${scansPrefix}${basename(thumbnail)}`, 'image/jpeg')
			};
		});
		return {
			record: key,
			item: row.url.replace(/^http:/, 'https:'),
			title: plain(item.title ?? row.title),
			date: plain(first(item.date) || row.date),
			year,
			creators: (item.contributor_names ?? item.contributors ?? []).map(plain),
			rights,
			// Served only when the Library's rights line clears it and the review list does not hold it back (allotment maps name individual people: charter commitment 4).
			serve: row.serve !== 'no' && freeToUse(rights),
			held_back: row.serve === 'no' ? row.reason : freeToUse(rights) ? null : 'The Library of Congress does not mark it free to use.',
			call_number: plain(first(item.call_number)),
			images
		};
	});
	const result = {
		description: "The Library of Congress's scans of historic maps of Indian lands (research/reviews/2026-11-26-historic-maps-library-of-congress.csv, rows marked keep), kept in the bucket and shown in the site's image viewer. Written by tools/collect-historic-maps.mjs. Not georeferenced.",
		maps
	};
	writeFileSync(scansPath, `${JSON.stringify(result, null, '\t')}\n`);
	// The website reads only the served maps, with only the facts it shows, so the Worker stays small.
	const served = maps
		.filter((map) => map.serve)
		.map((map) => ({ record: map.record, item: map.item, title: map.title, year: map.year, images: map.images.map((image) => ({ image: image.image.key, thumbnail: image.thumbnail.key })) }));
	writeFileSync(servedPath, `${JSON.stringify({ description: 'The served maps in geography/historic-map-scans.json, with only what the website shows. Written by tools/collect-historic-maps.mjs.', maps: served }, null, '\t')}\n`);
	console.log(`Wrote ${maps.length} maps (${maps.reduce((sum, map) => sum + map.images.length, 0)} images) to geography/historic-map-scans.json.`);
	writeRecords(maps);
}

/** Whether the Library's rights line says the item may be reused freely. */
const freeToUse = (rights) => /public domain|no known restrictions|free to use/i.test(rights);

const yamlString = (text) => `'${String(text).replaceAll("'", "''")}'`;

/** Writes a source record for each map, so it can be cited; records already there are left alone. */
function writeRecords(maps) {
	const today = new Date().toISOString().slice(0, 10);
	const [year, month, day] = today.split('-').map(Number);
	let written = 0;
	for (const map of maps) {
		const folder = new URL(`${map.record[0]}/`, sourcesFolder);
		mkdirSync(folder, { recursive: true });
		const path = new URL(`${map.record}.yaml`, folder);
		if (existsSync(path)) continue;
		const authors = map.creators.length ? map.creators.slice(0, 4).map((name) => `  - literal: ${yamlString(name)}`).join('\n') : '  - literal: Unknown';
		const issued = map.year ? `  issued:\n    date-parts: [[${map.year}]]\n` : '';
		const lines = [
			`key: ${map.record}`,
			'kind: other',
			'citation:',
			'  type: map',
			`  title: ${yamlString(map.title)}`,
			'  author:',
			authors,
			issued.trimEnd(),
			'  medium: Scanned map',
			'  publisher: Library of Congress, Geography and Map Division',
			`  URL: ${map.item}`,
			'  accessed:',
			`    date-parts: [[${year}, ${month}, ${day}]]`,
			`original_link: ${map.item}`,
			`retrieved: '${today}'`,
			'archives: []',
			'history:',
			'  status: live',
			`  last_checked: '${today}'`,
			'rights:',
			'  status: no-permission-needed',
			'  basis: public-domain',
			`  basis_note: ${yamlString(`The Library of Congress's rights line for this item: "${(map.rights || 'none given').split(/(?<=\.)\s/)[0]}"`)}`,
			`  redistribution: ${map.serve}`,
			'jurisdictions:',
			'- level: federal',
			'found_in:',
			'- 2026-11-26-historic-maps-collection',
			`notes: ${yamlString(`A historic map of Indian lands from the Library of Congress (call number ${map.call_number || 'not given'}). The scans are kept in the project's bucket under ${scansPrefix} and shown in the site's image viewer; they are not georeferenced. Listed in site/geography/historic-map-scans.json (tools/collect-historic-maps.mjs).`)}`
		].filter((line) => line !== '');
		writeFileSync(path, `${lines.join('\n')}\n`);
		written += 1;
	}
	console.log(`Wrote ${written} source records.`);
}

function bucketClient() {
	return import('aws4fetch').then(({ AwsClient }) => {
		const account = process.env.R2_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;
		if (!account || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error('Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID).');
		const client = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
		return { client, base: `https://${account}.r2.cloudflarestorage.com/${process.env.R2_BUCKET ?? 'tribal-law-project-files'}` };
	});
}

/** Every file this tool keeps in the bucket: [local path, key, media type]. */
function bucketFiles(work) {
	const scans = JSON.parse(readFileSync(scansPath, 'utf8'));
	return [
		...bureauLayers.map(([file]) => [join(work, 'bia', file), `${bureauPrefix}${file}`, 'application/geo+json']),
		...scans.maps.flatMap((map) =>
			map.images.flatMap((image) => [
				[join(work, 'loc', basename(image.original.key)), image.original.key, 'image/jp2'],
				[join(work, 'loc-jpeg', basename(image.image.key)), image.image.key, 'image/jpeg'],
				[join(work, 'loc-jpeg', basename(image.thumbnail.key)), image.thumbnail.key, 'image/jpeg']
			])
		)
	];
}

/** Puts every file in the bucket, eight at a time, skipping files already there with the same SHA-256. */
async function upload() {
	const work = option('work', '/tmp/historic-maps');
	const { client, base } = await bucketClient();
	const queue = bucketFiles(work);
	let sent = 0;
	let skipped = 0;
	async function worker() {
		for (let next = queue.shift(); next; next = queue.shift()) {
			const [path, key, contentType] = next;
			const bytes = readFileSync(path);
			const hash = sha256(bytes);
			const address = `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
			const head = await client.fetch(address, { method: 'HEAD' });
			if (head.ok && head.headers.get('x-amz-meta-sha256') === hash) {
				skipped += 1;
				continue;
			}
			let response;
			for (let attempt = 1; attempt <= 4; attempt += 1) {
				response = await client.fetch(address, { method: 'PUT', body: bytes, headers: { 'Content-Type': contentType, 'x-amz-meta-sha256': hash } });
				if (response.ok) break;
				await pause(2000 * attempt);
			}
			if (!response.ok) throw new Error(`The bucket refused ${key}: ${response.status}`);
			sent += 1;
		}
	}
	await Promise.all(Array.from({ length: 8 }, worker));
	console.log(`Uploaded ${sent} files; ${skipped} were already in the bucket.`);
}


/** Adds the uploaded files to the capture index (research/capture-index.csv), replacing rows with the same key. */
function index() {
	const work = option('work', '/tmp/historic-maps');
	const scans = JSON.parse(readFileSync(scansPath, 'utf8'));
	const today = new Date().toISOString().slice(0, 10);
	const row = (fields) => ({ topic: 'historic-maps', nations: '', captured: today, record_kinds: 'source', listed_in: '', catalog: '', derived_from: '', redistribution: 'yes', keep_local: 'no', orphan: 'no', ...fields });
	const rows = [
		...bureauLayers.map(([file, layer, title]) => {
			const found = entry(join(work, 'bia', file), `${bureauPrefix}${file}`, 'application/geo+json');
			return row({ ...found, title: `Bureau of Indian Affairs, ${title}`, obtained: `downloaded from the Bureau's map service by tools/collect-historic-maps.mjs, ${today}`, link: layer, records: bureauRecord, rights: 'United States government work (17 U.S.C. § 105).' });
		}),
		...scans.maps.flatMap((map) =>
			map.images.flatMap((image) => {
				const title = `${map.title}${map.images.length > 1 ? `, image ${image.number}` : ''}`;
				const rights = `Library of Congress rights line: ${map.rights || 'none given'}`;
				const common = { link: map.item, records: map.record, rights, redistribution: map.serve ? 'yes' : 'no' };
				return [
					row({ ...common, key: image.original.key, bytes: image.original.bytes, sha256: image.original.sha256, media_type: 'image/jp2', title, obtained: `downloaded from the Library of Congress by script, ${today}` }),
					row({ ...common, key: image.image.key, bytes: image.image.bytes, sha256: image.image.sha256, media_type: 'image/jpeg', title, obtained: `made from the Library of Congress's JPEG 2000 scan by tools/collect-historic-maps.mjs, ${today}` }),
					row({ ...common, key: image.thumbnail.key, bytes: image.thumbnail.bytes, sha256: image.thumbnail.sha256, media_type: 'image/jpeg', title: `${title} (small)`, obtained: `made from the Library of Congress's JPEG 2000 scan by tools/collect-historic-maps.mjs, ${today}` })
				];
			})
		)
	];
	// Each row replaces any row with the same key, and the index stays in key order (tools/capture-index.mjs).
	addToCaptureIndex(rows);
	console.log(`Indexed ${rows.length} files in research/capture-index.csv.`);
}

const command = process.argv[2];
const work = option('work', '/tmp/historic-maps');
if (command === 'fetch') {
	await fetchBureau(work);
	await fetchScans(work);
} else if (command === 'build') buildScans(work);
else if (command === 'upload') await upload();
else if (command === 'index') index();
else console.log('Usage: node tools/collect-historic-maps.mjs fetch|build|upload|index [--work folder]');
