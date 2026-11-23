import { pageKindLabels, readFilters, sizeChangeText, type ChangeView } from '#lib/page-history.ts';
import { storageForPages } from '#lib/server/essay-pages.ts';
import { listChanges } from '#lib/server/page-history.ts';
import { builtPages, recordThisBuildOnce } from '#lib/server/page-history-run.ts';
import type { RequestHandler } from './$types';

// Recent changes as an Atom feed (RFC 4287), with the same filters as the
// page, for feed readers.
export const prerender = false;

function escape(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function entryTitle(change: ChangeView): string {
	const page = change.title ?? 'A page no longer on this site';
	const what = change.change === 'new' ? 'New page' : change.change === 'removed' ? 'Page removed' : change.change === 'published' ? 'Published' : 'Changed';
	return `${what}: ${page} (${pageKindLabels[change.kind]})`;
}

function entrySummary(change: ChangeView): string {
	const parts = [
		change.whoHidden ? 'Name hidden' : change.who,
		change.sizeChange !== undefined ? `${sizeChangeText(change.sizeChange)} bytes` : undefined,
		change.parts?.length ? `Changed: ${change.parts.join(', ')}` : undefined,
		change.summaryHidden ? 'Summary hidden' : change.summary,
		change.hiddenReason
	];
	return parts.filter(Boolean).join('. ');
}

export const GET: RequestHandler = async ({ url }) => {
	const { database, bucket } = storageForPages();
	await recordThisBuildOnce(database, bucket);
	const filters = readFilters(url.searchParams);
	const { changes } = await listChanges(database, { ...filters, limit: Math.min(filters.limit, 100) }, await builtPages());
	const origin = url.origin;
	const self = `${origin}/changes/feed.xml${url.search}`;
	const updated = changes[0]?.madeAt ?? new Date().toISOString();
	const entries = changes
		.map(
			(change) => `  <entry>
    <id>${escape(`${origin}/changes/${change.id}`)}</id>
    <title>${escape(entryTitle(change))}</title>
    <link rel="alternate" href="${escape(`${origin}/changes/${change.id}`)}"/>
    <updated>${escape(change.madeAt)}</updated>
    <author><name>${escape(change.whoHidden ? 'Name hidden' : (change.who ?? ''))}</name></author>
    <summary>${escape(entrySummary(change))}</summary>
  </entry>`
		)
		.join('\n');
	const body = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escape(self)}</id>
  <title>Recent changes · Model Tribal ADR Code</title>
  <link rel="self" href="${escape(self)}"/>
  <link rel="alternate" href="${escape(`${origin}/changes${url.search}`)}"/>
  <updated>${escape(updated)}</updated>
${entries}
</feed>
`;
	return new Response(body, {
		headers: { 'content-type': 'application/atom+xml; charset=utf-8', 'cache-control': 'public, max-age=300' }
	});
};
