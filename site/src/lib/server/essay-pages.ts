/**
 * The public essay pages, which the Worker renders on request from the
 * private bucket (docs/editing.md, "Website pages"): the newest listed
 * publication of each essay, its earlier publications, and the plain
 * Markdown copies the git copy workflow reads.
 *
 * A rendered page is kept in the Worker's cache, keyed by the file's SHA-256
 * and the site build, so rendering runs once per published version.
 */
import { error } from '@sveltejs/kit';
import { version as siteBuild } from '$app/env';
import { essayBoxFacts, essayCaseLinks, essayCaseNames, essayCitations, essayOpinions, essayTerms, essaysInGit } from 'virtual:essay-library';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { renderEssay, type EssayHeading, type EssayLibrary, type RenderedEssay } from '../essays/render.ts';
import { essayDateTime } from '../essays/dates.ts';
import type { LineChange } from '../essays/merge.ts';
import { syncEssaysFromGitOnce } from './essay-git-sync.ts';
import { casesByTopicMarkdown, taggedCases } from '../essays/case-topics.ts';
import { frontMatterField, splitFrontMatter } from '../essays/syntax.ts';
import { workerEnvironment } from './environment.ts';
import { essayAttestations } from './essay-attestations.ts';
import { essaySectionHashes, readerCredits, withReaderCredits } from '../essays/attestations.ts';
import { parseEssay } from '../essays/document.ts';
import {
	boxPages,
	essayPath,
	essayRow,
	identifierFromPath,
	latestVersion,
	allListedPublications,
	listEssays,
	publications,
	readVersionText,
	type EssayPart,
	type PublicationRow
} from './essays.ts';

let boxPageList: Record<string, string> | undefined;
let caseTitles: Record<string, string> | undefined;

export const essayLibrary: EssayLibrary = {
	citation: (key) => essayCitations[key],
	term: (id) => essayTerms[id],
	facts: (box, key) => (box === 'law' ? essayBoxFacts.laws[key] : essayBoxFacts.cases[key]) ?? [],
	boxPage: (anchor) => (boxPageList ??= boxPages(essaysInGit))[anchor],
	caseNames: () => (caseTitles ??= Object.fromEntries(Object.entries(essayCaseNames).map(([key, name]) => [key, name.title]))),
	caseLink: (key) => essayCaseLinks[key],
	opinions: (key) => essayOpinions[key]
};

export function storageForPages(): { database: D1Database; bucket: R2Bucket } {
	const environment = workerEnvironment();
	if (!environment.database || !environment.sourceDocuments) error(503, 'Essays cannot be read right now.');
	return { database: environment.database, bucket: environment.sourceDocuments };
}

/**
 * Which text of each essay a generated page is built from: the newest
 * published version for the public pages, the newest saved one in the
 * workspace. An essay the bucket does not hold yet is read from git.
 */
export type EssayTexts = 'published' | 'saved';

async function currentTexts(which: EssayTexts): Promise<Record<string, string>> {
	const texts: Record<string, string> = { ...essaysInGit };
	const { database, bucket } = storageForPages();
	if (which === 'published') {
		const newest = new Map<string, PublicationRow>();
		for (const row of await allListedPublications(database)) newest.set(row.essay_identifier, row);
		for (const [identifier, row] of newest) if (row.object_key) texts[identifier] = await readVersionText(bucket, { object_key: row.object_key });
	} else {
		for (const essay of await listEssays(database)) {
			const row = await latestVersion(database, essay.identifier);
			if (row) texts[essay.identifier] = await readVersionText(bucket, row);
		}
	}
	return texts;
}

/** Whether a page is generated, such as the index of cases by topic ("generated: cases-by-topic"). */
export function generatedKind(text: string): string | undefined {
	return frontMatterField(splitFrontMatter(text).frontMatter, 'generated')?.trim() || undefined;
}

/**
 * Renders an essay. A page that says "generated: cases-by-topic" is followed
 * by the index built from the Topics parts of every other essay's case boxes,
 * each linked to the page that holds its box (case-topics.ts).
 */
export async function renderWithGenerated(text: string, which: EssayTexts, options: { lines?: LineChange[] } = {}): Promise<RenderedEssay> {
	if (generatedKind(text) !== 'cases-by-topic') return renderEssay(text, essayLibrary, options);
	const texts = Object.fromEntries(Object.entries(await currentTexts(which)).filter(([, other]) => !generatedKind(other)));
	const tagged = Object.values(texts).flatMap((other) => taggedCases(other));
	const index = casesByTopicMarkdown(tagged, (key) => essayCaseNames[key]);
	const pages = boxPages(texts);
	return renderEssay(`${text.trimEnd()}\n\n${index}\n`, { ...essayLibrary, boxPage: (anchor) => pages[anchor] }, options);
}

/**
 * Renders a version, reusing an earlier rendering of the same file in the
 * same build. A generated page is rendered afresh each time, since the
 * essays it is built from change without it.
 */
export async function renderedVersion(bucket: R2Bucket, row: { object_key: string; sha256: string }, which: EssayTexts = 'published'): Promise<RenderedEssay> {
	const text = await readVersionText(bucket, row);
	if (generatedKind(text)) return renderWithGenerated(text, which);
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = `https://essay-cache.invalid/${encodeURIComponent(siteBuild)}/${row.sha256}`;
	if (cache) {
		const cached = await cache.match(cacheKey).catch(() => undefined);
		if (cached) return (await cached.json()) as RenderedEssay;
	}
	const rendered = renderEssay(text, essayLibrary);
	if (cache) {
		await cache
			.put(cacheKey, new Response(JSON.stringify(rendered), { headers: { 'Cache-Control': 'max-age=31536000' } }))
			.catch(() => undefined);
	}
	return rendered;
}

/**
 * Each section's SHA-256 in a version, by heading id, kept in the Worker's
 * cache like the rendering, for the credits under each heading.
 */
async function sectionHashesOf(bucket: R2Bucket, row: { object_key: string; sha256: string }): Promise<Record<string, string>> {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = `https://essay-cache.invalid/${encodeURIComponent(siteBuild)}/sections/${row.sha256}`;
	if (cache) {
		const cached = await cache.match(cacheKey).catch(() => undefined);
		if (cached) return (await cached.json()) as Record<string, string>;
	}
	const hashes = await essaySectionHashes(parseEssay(splitFrontMatter(await readVersionText(bucket, row)).body));
	if (cache) {
		await cache
			.put(cacheKey, new Response(JSON.stringify(hashes), { headers: { 'Cache-Control': 'max-age=31536000' } }))
			.catch(() => undefined);
	}
	return hashes;
}

/**
 * The published HTML with "Written by", "Edited by" and "Reviewed by" under
 * each heading whose people chose to show their names and attested to the
 * section as published (docs/editing.md, "Attesting to a section"). A
 * failure here leaves the essay as it is, without credits.
 */
async function withCredits(database: D1Database, bucket: R2Bucket, identifier: string, row: { object_key: string; sha256: string }, html: string): Promise<string> {
	try {
		const attestations = (await essayAttestations(database, identifier)).filter((attestation) => attestation.shownToReaders);
		if (attestations.length === 0) return html;
		return withReaderCredits(html, readerCredits(attestations, await sectionHashesOf(bucket, row)));
	} catch (problem) {
		console.error('Essay credits could not be added', problem);
		return html;
	}
}

export interface PublicationSummary {
	number: number;
	versionNumber: number;
	publishedAt: string;
	publishedAtText: string;
	title: string;
	link: string;
}

function summary(row: PublicationRow, path: string, newest: boolean): PublicationSummary {
	return {
		number: row.number,
		versionNumber: row.version_number,
		publishedAt: row.published_at,
		publishedAtText: essayDateTime(row.published_at),
		title: row.title ?? '',
		link: newest ? path : `${path}/history/${row.number}`
	};
}

/** The sidebar outline for an essay: its h2 headings, opening into their h3s. */
function outlineOf(title: string, headings: EssayHeading[]) {
	return { title, items: headings };
}

export async function essayPage(part: EssayPart, slug: string, publicationNumber?: number) {
	const identifier = identifierFromPath(part, slug);
	const { database, bucket } = storageForPages();
	// Text merged in git since the build is saved as a draft version; readers see it once published.
	await syncEssaysFromGitOnce(database, bucket);
	const essay = await essayRow(database, identifier);
	if (!essay || essay.part !== part) error(404, 'No essay has this address.');
	const listed = await publications(database, identifier, true);
	const path = essayPath(identifier, part);
	// Not published yet: readers get a page that says so and nothing more,
	// and people with access to the essay get its draft there to read,
	// comment on and edit (EssayArticle.svelte), as on a published essay.
	if (listed.length === 0) {
		if (publicationNumber !== undefined) error(404, 'This essay is not published yet.');
		return {
			identifier,
			part,
			path,
			title: 'Not published yet',
			html: '',
			sources: [],
			headings: [],
			publication: undefined,
			isNewest: true,
			newest: undefined,
			publicationCount: 0,
			unpublished: true,
			outline: outlineOf('Not published yet', [])
		};
	}
	const row = publicationNumber === undefined ? listed[0] : listed.find((candidate) => candidate.number === publicationNumber);
	if (!row?.object_key || !row.sha256) error(404, 'No publication of this essay has this number.');
	const rendered = await renderedVersion(bucket, { object_key: row.object_key, sha256: row.sha256 });
	const html = await withCredits(database, bucket, identifier, { object_key: row.object_key, sha256: row.sha256 }, rendered.html);
	return {
		identifier,
		part,
		path,
		title: rendered.title,
		html,
		sources: rendered.sources,
		headings: rendered.headings,
		publication: summary(row, path, row === listed[0]),
		isNewest: row === listed[0],
		newest: summary(listed[0], path, true),
		publicationCount: listed.length,
		unpublished: false,
		outline: outlineOf(rendered.title, rendered.headings)
	};
}

export async function essayHistory(part: EssayPart, slug: string) {
	const identifier = identifierFromPath(part, slug);
	const { database } = storageForPages();
	const essay = await essayRow(database, identifier);
	if (!essay || essay.part !== part) error(404, 'No essay has this address.');
	const listed = await publications(database, identifier, true);
	if (listed.length === 0) error(404, 'This essay is not published yet.');
	const path = essayPath(identifier, part);
	return {
		path,
		title: listed[0].title ?? identifier,
		publications: listed.map((row, index) => summary(row, path, index === 0))
	};
}

export async function essayIndex(part: EssayPart) {
	const { database } = storageForPages();
	const essays = (await listEssays(database))
		.filter((essay) => essay.part === part && essay.published)
		.map((essay) => ({
			identifier: essay.identifier,
			title: essay.published!.title,
			link: essayPath(essay.identifier, essay.part),
			publishedAtText: essayDateTime(essay.published!.publishedAt)
		}));
	return {
		essays,
		outline: { items: essays.map((essay) => ({ label: essay.title, link: essay.link })) }
	};
}
