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
import { essayBoxFacts, essayCitations, essayTerms } from 'virtual:essay-library';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { renderEssay, type EssayHeading, type EssayLibrary, type RenderedEssay } from '../essays/render.ts';
import { essayDateTime } from '../essays/dates.ts';
import { syncEssaysFromGitOnce } from './essay-git-sync.ts';
import { workerEnvironment } from './environment.ts';
import {
	essayPath,
	essayRow,
	identifierFromPath,
	listEssays,
	publications,
	readVersionText,
	type EssayPart,
	type PublicationRow
} from './essays.ts';

export const essayLibrary: EssayLibrary = {
	citation: (key) => essayCitations[key],
	term: (id) => essayTerms[id],
	facts: (box, key) => (box === 'law' ? essayBoxFacts.laws[key] : essayBoxFacts.cases[key]) ?? []
};

export function storageForPages(): { database: D1Database; bucket: R2Bucket } {
	const environment = workerEnvironment();
	if (!environment.database || !environment.sourceDocuments) error(503, 'Essays cannot be read right now.');
	return { database: environment.database, bucket: environment.sourceDocuments };
}

/** Renders a version, reusing an earlier rendering of the same file in the same build. */
export async function renderedVersion(bucket: R2Bucket, row: { object_key: string; sha256: string }): Promise<RenderedEssay> {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const cacheKey = `https://essay-cache.invalid/${encodeURIComponent(siteBuild)}/${row.sha256}`;
	if (cache) {
		const cached = await cache.match(cacheKey).catch(() => undefined);
		if (cached) return (await cached.json()) as RenderedEssay;
	}
	const rendered = renderEssay(await readVersionText(bucket, row), essayLibrary);
	if (cache) {
		await cache
			.put(cacheKey, new Response(JSON.stringify(rendered), { headers: { 'Cache-Control': 'max-age=31536000' } }))
			.catch(() => undefined);
	}
	return rendered;
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
	if (listed.length === 0) error(404, 'This essay is not published yet.');
	const path = essayPath(identifier, part);
	const row = publicationNumber === undefined ? listed[0] : listed.find((candidate) => candidate.number === publicationNumber);
	if (!row?.object_key || !row.sha256) error(404, 'No publication of this essay has this number.');
	const rendered = await renderedVersion(bucket, { object_key: row.object_key, sha256: row.sha256 });
	return {
		identifier,
		part,
		path,
		title: rendered.title,
		html: rendered.html,
		sources: rendered.sources,
		headings: rendered.headings,
		publication: summary(row, path, row === listed[0]),
		isNewest: row === listed[0],
		newest: summary(listed[0], path, true),
		publicationCount: listed.length,
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
