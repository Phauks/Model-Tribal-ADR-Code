/**
 * The sitemap's pages as this build lists them (src/lib/server/sitemap-build.ts):
 * one file per part, and parts.json naming them. Read by the Worker only
 * (src/routes/sitemaps/[part].xml); a reader asking for one is told it is not
 * there (tools/nation-page-changes-worker.js), since a page a nation hid since
 * the build may still be in it.
 */
import { error, json } from '@sveltejs/kit';
import { builtSitemap } from '#lib/server/sitemap-files.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => [{ part: 'parts' }, ...builtSitemap().parts.map((part) => ({ part: part.name }))];

export const GET: RequestHandler = ({ params }) => {
	const { parts, index } = builtSitemap();
	if (params.part === 'parts') return json(index);
	const part = parts.find((candidate) => candidate.name === params.part);
	if (!part) error(404, 'Not found');
	return json(part);
};
