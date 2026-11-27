/**
 * News: posts the project's staff write and publish on the website, edited
 * like the essays (docs/editing.md, "News"; Trevor asked on Nov. 26, 2026:
 * "add a news section to the website, where we can create posts for ppl").
 * A post is an essay in the part "news", so it keeps every saved version,
 * its citations and References list, comments and page history. What a post
 * adds is shown here: the day it was first published, who wrote it, its
 * one-line summary (the front matter's `description`), and the posts before
 * and after it.
 *
 * The list, the post pages and the Atom feed (src/routes/news, through
 * src/lib/server/news-pages.ts) read the same rows, so they never disagree.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { essayDate } from '../essays/dates.ts';
import { frontMatterField, splitFrontMatter } from '../essays/syntax.ts';
import { readerNames } from './essay-credits.ts';
import { essayPath, readVersionText } from './essays.ts';

/** One published post, as the News list, the feed and a post's neighbours show it. */
export interface NewsPost {
	identifier: string;
	title: string;
	link: string;
	/** The front matter's `description`, or nothing. */
	summary: string;
	/** When the post was first published, as an ISO 8601 date and time. */
	postedAt: string;
	/** "Nov. 27, 2026", in Pacific time like every essay date. */
	postedText: string;
	/** When the newest listed publication was made. */
	updatedAt: string;
	/** The newest listed publication's version, to render it for the feed. */
	newest: { object_key: string; sha256: string };
	/** Who started the post, when they chose to be credited on the website. */
	author: { name: string; link: string | null } | null;
}

interface PostRow {
	identifier: string;
	created_by: string | null;
	posted_at: string;
	updated_at: string;
	title: string;
	object_key: string;
	sha256: string;
}

/** Summaries by version hash: a saved version never changes, so each copy of the Worker reads each one once. */
const summaries = new Map<string, string>();

async function summaryOf(bucket: R2Bucket, row: { object_key: string; sha256: string }): Promise<string> {
	const known = summaries.get(row.sha256);
	if (known !== undefined) return known;
	let summary = '';
	try {
		summary = frontMatterField(splitFrontMatter(await readVersionText(bucket, row)).frontMatter, 'description')?.trim() ?? '';
	} catch (problem) {
		console.error(`Could not read the summary of ${row.object_key}`, problem);
		return '';
	}
	summaries.set(row.sha256, summary);
	return summary;
}

/** Every published post, newest first by the day it was first published. */
export async function newsPosts(database: D1Database, bucket: R2Bucket): Promise<NewsPost[]> {
	const { results } = await database
		.prepare(
			`SELECT e.identifier, e.created_by, MIN(p.published_at) AS posted_at, MAX(p.published_at) AS updated_at,
				v.title, v.object_key, v.sha256
			 FROM essays e
			 JOIN essay_publications p ON p.essay_identifier = e.identifier AND p.listed = 1
			 JOIN essay_publications newest ON newest.essay_identifier = e.identifier
				AND newest.number = (SELECT MAX(number) FROM essay_publications WHERE essay_identifier = e.identifier AND listed = 1)
			 JOIN essay_versions v ON v.essay_identifier = e.identifier AND v.number = newest.version_number
			 WHERE e.part = 'news'
			 GROUP BY e.identifier
			 ORDER BY posted_at DESC, e.identifier`
		)
		.all<PostRow>();
	const authors = [...new Set(results.flatMap((row) => (row.created_by ? [row.created_by] : [])))];
	const [names, texts] = await Promise.all([
		authors.length ? readerNames(database, authors) : Promise.resolve(new Map<string, { name: string; link: string | null }>()),
		Promise.all(results.map((row) => summaryOf(bucket, row)))
	]);
	return results.map((row, index) => ({
		identifier: row.identifier,
		title: row.title || row.identifier,
		link: essayPath(row.identifier, 'news'),
		summary: texts[index],
		postedAt: row.posted_at,
		postedText: essayDate(row.posted_at),
		updatedAt: row.updated_at,
		newest: { object_key: row.object_key, sha256: row.sha256 },
		author: (row.created_by && names.get(row.created_by)) || null
	}));
}

/** What a post shows besides the essay page: its day, its author, and the posts on either side. */
export interface PostDetails {
	postedText: string;
	/** Set when the newest publication was made on a later day than the first. */
	updatedText?: string;
	author: { name: string; link: string | null } | null;
	older: { title: string; link: string } | null;
	newer: { title: string; link: string } | null;
}
