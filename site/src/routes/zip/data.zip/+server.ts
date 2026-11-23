/**
 * All the data behind the site in one ZIP file, built with the site (site/DESIGN.md, section 10).
 * Trevor asked for it on Nov. 23, 2026. It gathers the files each page already offers: the list
 * of nations, every nation's record and sources, the dispute resolution provisions, the glossary,
 * the list of document copies, and the stories. A story's full text is included only where it is
 * in the public domain or a nation's law; for the others the file gives the story's address,
 * since a downloaded file cannot be withdrawn the way a page can.
 */
import { strToU8, zipSync, type Zippable } from 'fflate';
import { version } from '$app/env';
import { buildTime } from '#lib/offline-collections.ts';
import { citationDate } from '#lib/page-downloads.ts';
import { nations, storyRecords } from '#lib/server/content.ts';
import { isoDate, shownExcerpts, shownFullText, shownTellings, storyIsShown } from '#lib/story-visibility.ts';
import type { RequestHandler } from './$types';

export const prerender = true;

const sharedFullText = new Set(['public-domain', 'nation-law']);

export const GET: RequestHandler = async ({ fetch }) => {
	const files: Zippable = {};
	const add = async (name: string, address: string) => {
		const response = await fetch(address);
		if (response.ok) files[name] = new Uint8Array(await response.arrayBuffer());
	};
	await add('nations.csv', '/nations/nations.csv');
	await add('dispute-resolution-provisions.csv', '/nations/recourse/provisions.csv');
	await add('dispute-resolution-provisions.json', '/nations/recourse/provisions.json');
	await add('glossary.json', '/glossary/terms.json');
	await add('document-copies.csv', '/copies/list.csv');
	for (const record of nations()) {
		await add(`nations/${record.id}.json`, `/nations/${record.id}/record.json`);
		await add(`nations/${record.id}-sources.json`, `/nations/${record.id}/sources.json`);
	}
	const built = buildTime(version) ?? new Date();
	const today = isoDate(built);
	const stories = storyRecords()
		.filter((record) => storyIsShown(record, today))
		.map((record) => {
			const fullText = shownFullText(record, today);
			const shared = fullText && sharedFullText.has(fullText.basis);
			return {
				id: record.id,
				title: record.title,
				nations: record.nations,
				kind: record.kind,
				tellings: shownTellings(record, today),
				excerpts: shownExcerpts(record, today).filter((excerpt) => excerpt.quoted),
				...(shared ? { full_text: fullText } : {}),
				page: `/stories/${record.id}`
			};
		});
	files['stories.json'] = strToU8(JSON.stringify(stories, null, '\t'));
	files['README.txt'] = strToU8(
		[
			'Model Tribal ADR Code: the data behind the website',
			'',
			`Made ${citationDate(built)}, build ${version}.`,
			'',
			'nations.csv lists every nation and community. nations/ holds each nation’s record, with a source for every fact, and its sources as Citation Style Language JSON. dispute-resolution-provisions.csv and .json are the provisions behind Find recourse. glossary.json holds the glossary. document-copies.csv lists the copies of documents the website holds. stories.json holds the stories; a story’s full text is included where it is in the public domain or a nation’s law, and for the others the story’s page on the website has it.',
			'',
			'SHA256SUMS.txt gives the SHA-256 of every file here, in the form sha256sum -c reads, and Checking a file on the website’s Downloads page (/downloads) checks this ZIP file itself.',
			'',
			'Material a nation has asked the project to restrict is never included. This file cannot be changed after you download it, so check the website for the current version.',
			''
		].join('\r\n')
	);
	// Each file's SHA-256, in the form sha256sum -c reads, so the files can be checked once unpacked.
	const sums: string[] = [];
	for (const [name, content] of Object.entries(files)) {
		const digest = await crypto.subtle.digest('SHA-256', content as Uint8Array<ArrayBuffer>);
		sums.push(`${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}  ${name}\n`);
	}
	files['SHA256SUMS.txt'] = strToU8(sums.join(''));
	return new Response(zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>, {
		headers: { 'content-type': 'application/zip', 'content-disposition': 'attachment; filename="model-tribal-adr-code-data.zip"' }
	});
};
