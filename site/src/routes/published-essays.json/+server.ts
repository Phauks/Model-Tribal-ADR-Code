/**
 * The list of every published essay version, with the SHA-256 of each file,
 * for the scheduled workflow that keeps a copy in git
 * (.github/workflows/copy-published-essays.yml, docs/editing.md, "Git copy").
 * Publications held back from readers are left out.
 */
import { json } from '@sveltejs/kit';
import { allListedPublications } from '#lib/server/essays.ts';
import { essayPath } from '#lib/server/essays.ts';
import { storageForPages } from '#lib/server/essay-pages.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = async () => {
	const { database } = storageForPages();
	const rows = await allListedPublications(database);
	return json(
		{
			publications: rows.map((row) => ({
				essay: row.essay_identifier,
				part: row.part,
				publication: row.number,
				version: row.version_number,
				title: row.title,
				publishedAt: row.published_at,
				sha256: row.sha256,
				bytes: row.bytes,
				page: essayPath(row.essay_identifier, row.part),
				markdown: `/published-essays/${row.essay_identifier}/${row.number}.md`
			}))
		},
		{ headers: { 'Cache-Control': 'public, max-age=60' } }
	);
};
