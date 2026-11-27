/**
 * The public essay pages, which the Worker renders on request from the
 * private bucket (docs/editing.md, "Website pages"): the newest listed
 * publication of each essay, its earlier publications, and the plain
 * Markdown copies the git copy workflow reads.
 *
 * A rendered page is kept in the Worker's cache, keyed by the file's SHA-256
 * and the site build, so rendering runs once per published version.
 */
import { error, type Cookies } from '@sveltejs/kit';
import { version as siteBuild } from '$app/env';
import { essayTerms, essaysInGit } from 'virtual:essay-library';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { EssayHeading, EssayLibrary, RenderedEssay } from '../essays/render.ts';
import { builtDataWhileBuilding } from './built-files.ts';
import { essayCaseNamesFile, essayRecordFiles } from '../built-files.ts';
import { caseNamesLibrary, citationsWhileBuilding, essayCaseNames, recordLibrary, renderWithCitations, withEssayData, type CaseNames, type EssayRecord } from './essay-citations.ts';
import { essayDateTime } from '../essays/dates.ts';
import type { LineChange } from '../essays/merge.ts';
import { syncEssaysFromGitOnce } from './essay-git-sync.ts';
import { casesByTopicMarkdown, taggedCases } from '../essays/case-topics.ts';
import { frontMatterField, splitFrontMatter } from '../essays/syntax.ts';
import { fillBoxes } from '../essays/record-boxes.ts';
import { workerEnvironment } from './environment.ts';
import { sessionCookie } from '#lib/server/accounts.ts';
import { signedInHintCookie } from '#lib/signed-in-hint.ts';
import { handCredits, readerNames, sectionCredits } from './essay-credits.ts';
import { essayReviewRequests } from './essay-review-requests.ts';
import { creditLine, finishedReviewers, withReaderCredits, type ReaderCredits } from '../essays/credits.ts';
import {
	boxPages,
	essayPath,
	essayRow,
	identifierFromPath,
	allListedPublications,
	listEssays,
	publications,
	readVersionText,
	type EssayPart,
	type PublicationRow
} from './essays.ts';

let boxPageList: Record<string, string> | undefined;

/** Every record's box facts, case page, opinions and box parts, while the site is built (essay-citations.ts). */
const recordsWhileBuilding = () => builtDataWhileBuilding<Record<string, EssayRecord>>(essayRecordFiles.name);

/**
 * What essays are drawn with. Citations and records are at hand here only
 * while the site is built: in the Worker, draw with renderWithCitations()
 * or withEssayData(), which read the ones a text needs (essay-citations.ts).
 */
export const essayLibrary: EssayLibrary = {
	citation: (key) => citationsWhileBuilding()?.[key],
	term: (id) => essayTerms[id],
	boxPage: (anchor) => (boxPageList ??= boxPages(essaysInGit))[anchor],
	...recordLibrary((key) => recordsWhileBuilding()?.[key]),
	caseNames: () => caseNamesLibrary(builtDataWhileBuilding<CaseNames>(essayCaseNamesFile)).caseNames?.() ?? {}
};

/** An essay's text with the boxes it leaves empty filled from their records (record-boxes.ts), while the site is built. */
export function withRecordBoxes(text: string, library: EssayLibrary = essayLibrary): string {
	return fillBoxes(
		text,
		(kind, key) => library.box?.(kind, key),
		(kind, key) => library.boxReading?.(kind, key)
	).text;
}

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

/** How many essay files are read from the bucket at once: a Worker keeps at most six connections open at a time. */
const readsAtOnce = 6;

/** Reads each file from the bucket, a few at a time, and gives the texts in the order of `files`. */
async function readTexts(bucket: R2Bucket, files: { identifier: string; object_key: string }[]): Promise<[string, string][]> {
	const texts: [string, string][] = [];
	for (let start = 0; start < files.length; start += readsAtOnce) {
		const group = files.slice(start, start + readsAtOnce);
		const read = await Promise.all(group.map((file) => readVersionText(bucket, file)));
		group.forEach((file, index) => texts.push([file.identifier, read[index]]));
	}
	return texts;
}

/** The file of the newest saved version of every essay, in the order listEssays gives them, in one query. */
async function newestSavedFiles(database: D1Database): Promise<{ identifier: string; object_key: string }[]> {
	const { results } = await database
		.prepare(
			`SELECT e.identifier, v.object_key
			 FROM essays e
			 JOIN essay_versions v ON v.essay_identifier = e.identifier
				AND v.number = (SELECT MAX(number) FROM essay_versions WHERE essay_identifier = e.identifier)
			 ORDER BY e.part, e.identifier`
		)
		.all<{ identifier: string; object_key: string }>();
	return results;
}

export async function currentTexts(which: EssayTexts): Promise<Record<string, string>> {
	const texts: Record<string, string> = { ...essaysInGit };
	const { database, bucket } = storageForPages();
	let files: { identifier: string; object_key: string }[];
	if (which === 'published') {
		const newest = new Map<string, PublicationRow>();
		for (const row of await allListedPublications(database)) newest.set(row.essay_identifier, row);
		files = [...newest].flatMap(([identifier, row]) => (row.object_key ? [{ identifier, object_key: row.object_key }] : []));
	} else {
		files = await newestSavedFiles(database);
	}
	// Added in the same order as before, since the order of the texts is the order of the generated index.
	for (const [identifier, text] of await readTexts(bucket, files)) texts[identifier] = text;
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
	if (generatedKind(text) !== 'cases-by-topic') return renderWithCitations(text, essayLibrary, options);
	const texts = Object.fromEntries(Object.entries(await currentTexts(which)).filter(([, other]) => !generatedKind(other)));
	const tagged = (await Promise.all(Object.values(texts).map((other) => withEssayData(essayLibrary, (library) => taggedCases(withRecordBoxes(other, library)))))).flat();
	const names = await essayCaseNames();
	const index = casesByTopicMarkdown(tagged, (key) => names[key]);
	const pages = boxPages(texts);
	return renderWithCitations(`${text.trimEnd()}\n\n${index}\n`, { ...essayLibrary, boxPage: (anchor) => pages[anchor] }, options);
}

/**
 * Renders a version, reusing an earlier rendering of the same file in the
 * same build. A generated page is rendered afresh each time, since the
 * essays it is built from change without it.
 */
export async function renderedVersion(bucket: R2Bucket, row: { object_key: string; sha256: string }, which: EssayTexts = 'published'): Promise<RenderedEssay> {
	// The cache is checked before the text is read from the bucket. Only pages that are not generated are ever kept in it, so a page found there needs no text.
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = `https://essay-cache.invalid/${encodeURIComponent(siteBuild)}/${row.sha256}`;
	if (cache) {
		const cached = await cache.match(cacheKey).catch(() => undefined);
		if (cached) return (await cached.json()) as RenderedEssay;
	}
	const text = await readVersionText(bucket, row);
	if (generatedKind(text)) return renderWithGenerated(text, which);
	const rendered = await renderWithCitations(text, essayLibrary);
	if (cache) {
		await cache
			.put(cacheKey, new Response(JSON.stringify(rendered), { headers: { 'Cache-Control': 'max-age=31536000' } }))
			.catch(() => undefined);
	}
	return rendered;
}

/**
 * The published HTML with "Written by", "Edited by", "Researched by" and
 * "Reviewed by" under each heading (docs/editing.md, "Credits"): from the
 * edit history up to the published version, the finished section reviews
 * and the credits added by hand, naming only people who chose to be
 * credited on the website. A failure here leaves the essay as it is,
 * without credits.
 */
async function withCredits(database: D1Database, bucket: R2Bucket, identifier: string, versionNumber: number, html: string): Promise<string> {
	try {
		const [sections, hand, requests] = await Promise.all([
			sectionCredits(database, bucket, identifier, versionNumber),
			handCredits(database, identifier),
			essayReviewRequests(database, identifier)
		]);
		const lines = new Map(
			sections.map((section) => [
				section.slug,
				creditLine(
					section,
					hand.filter((credit) => credit.sectionSlug === section.slug),
					finishedReviewers(requests, section.slug)
				)
			])
		);
		const people = [...new Set([...lines.values()].flatMap((line) => line.flatMap((credit) => credit.people.map((person) => person.person))))];
		if (people.length === 0) return html;
		const names = await readerNames(database, people);
		const credits: ReaderCredits = {};
		for (const [slug, line] of lines) {
			const shown = line
				.map((credit) => ({ role: credit.role, people: credit.people.flatMap((person) => (names.has(person.person) ? [names.get(person.person)!] : [])) }))
				.filter((credit) => credit.people.length > 0);
			if (shown.length) credits[slug] = shown;
		}
		return withReaderCredits(html, credits);
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

/**
 * Lets browsers and shared caches keep a public essay page for a minute. The page is the same for every reader: what people with access see on it (the draft, comments, the editor) is fetched by the page itself from the workspace (EssayArticle.svelte). A request from someone who is or may be signed in gets no caching header, as before, so an author who has just published sees the new publication at once. Called only once the page has loaded, so an error page is never kept.
 */
export function cacheForReaders(event: { cookies: Pick<Cookies, 'get'>; setHeaders: (headers: Record<string, string>) => void }): void {
	if (event.cookies.get(sessionCookie) !== undefined || event.cookies.get(signedInHintCookie) !== undefined) return;
	event.setHeaders({ 'cache-control': 'public, max-age=60' });
}

export async function essayPage(part: EssayPart, slug: string, publicationNumber?: number) {
	const identifier = identifierFromPath(part, slug);
	const { database, bucket } = storageForPages();
	// Text merged in git since the build is saved as a draft version; readers see it once published.
	// It stays here rather than in the scheduled run: an essay new in git has no row until the sync saves it, so without it readers would get "No essay has this address" instead of "Not published yet" until the next run. After the first view in each Worker copy this is a promise already settled.
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
	const html = await withCredits(database, bucket, identifier, row.version_number, rendered.html);
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
