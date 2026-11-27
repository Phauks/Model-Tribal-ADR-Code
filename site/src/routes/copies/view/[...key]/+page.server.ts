/**
 * A copy of a document shown inside the site (src/lib/public-copies.ts,
 * copyPagePath): the masthead and the left sidebar stay, the Library section
 * open, and the document is shown on the site's item layout, below its title
 * and citation, in the same Text card as every law's and case's page
 * (src/lib/components/DocumentText.svelte; Trevor chose design B on Nov. 27,
 * 2026): its format, size and date, the buttons to open, download and ask to
 * remove it, the text itself, then where it was published, its SHA-256 and
 * a link to verify it.
 *
 * Rendered by the Worker on request, since there are thousands of copies. The
 * title and other details come from a small prebuilt file
 * (src/routes/copies/details/[shard].json); the build-time list
 * (src/lib/server/copy-list.ts) decides what is shown, as it decides what
 * /copies/<key> serves. A copy of a nation's law or court opinion the nation
 * chose to cite only shows its heading, citation and a link to where the
 * original is kept, without the file; one the nation chose to hide answers
 * without naming it (src/lib/nation-restrictions.ts).
 */
import { error, redirect } from '@sveltejs/kit';
import { fileName } from '#lib/checksums.ts';
import { documentFile, publisherName } from '#lib/document-text.ts';
import { copyPagePath, copyPath } from '#lib/public-copies.ts';
import { copyDetailsOf } from '#lib/server/copy-details.ts';
import { hiddenCopyMessage } from '#lib/nation-restrictions.ts';
import { movedCopy, servedCopy } from '#lib/server/copy-list.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { copyLevel } from '#lib/server/nation-restrictions.ts';
import { readableDate } from '#lib/readable-date.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = async ({ params, url, fetch, setHeaders }) => {
	// A saved web page of a document the site also keeps as a PDF or a text opens that copy (copyMoves).
	const moved = await movedCopy(params.key);
	if (moved) {
		setHeaders({ 'cache-control': 'public, max-age=86400' });
		redirect(302, copyPagePath({ key: moved }));
	}
	const copy = await servedCopy(params.key);
	if (!copy) error(404, 'This site keeps no copy at this address.');
	const level = await copyLevel(workerEnvironment().database, copy);
	if (level === 'hide') {
		setHeaders({ 'cache-control': 'no-store' });
		error(404, hiddenCopyMessage);
	}
	const details = await copyDetailsOf(copy, url, fetch);
	const title = details?.opinion?.name ?? details?.title ?? fileName(copyPath(copy));
	const original = copy.links.at(-1) ?? copy.links[0] ?? '';
	// A day, as for the file itself: a copy taken off the list stops being shown soon. A nation's
	// law or opinion for five minutes, and not at all while restricted, since a nation's choice shows within minutes.
	setHeaders({ 'cache-control': level !== 'show' ? 'no-store' : copy.restrict ? 'public, max-age=300' : 'public, max-age=86400' });
	return {
		key: copy.key,
		citeOnly: level === 'cite',
		title,
		details: details ?? null,
		decidedText: details?.opinion?.decided ? readableDate(details.opinion.decided) : '',
		// The same card as a law's or case's page; a redacted opinion (research/tribal-court-opinions/redacted.csv) says so and has no link to the original.
		file: documentFile(
			{ ...copy, ...(details?.captured ? { captured: details.captured } : {}), ...(details?.opinion?.namesReplaced ? { namesReplaced: true } : {}) },
			{ title }
		),
		original: original && URL.canParse(original) && !details?.opinion?.namesReplaced ? { link: original, name: details?.opinion ? 'the Caselaw Access Project' : (publisherName(original) ?? original) } : undefined
	};
};
