/**
 * A copy of a document shown inside the site (src/lib/public-copies.ts,
 * copyPagePath): the masthead and the left sidebar stay, the Library section
 * open, and the document opens in a frame below its title, the date the copy
 * was made, where it was published and its SHA-256, with links to download
 * it, open the file alone, verify it and ask for it to be taken down.
 *
 * Rendered by the Worker on request, since there are thousands of copies. The
 * title and other details come from a small prebuilt file
 * (src/routes/copies/details/[shard].json); the build-time list
 * (virtual:public-copies) decides what is shown, as it decides what
 * /copies/<key> serves. A copy of a nation's law or court opinion the nation
 * chose to cite only shows its heading, citation and a link to where the
 * original is kept, without the file; one the nation chose to hide answers
 * without naming it (src/lib/nation-restrictions.ts).
 */
import { error } from '@sveltejs/kit';
import { publicCopies } from 'virtual:public-copies';
import { fileName, verifyLink } from '#lib/checksums.ts';
import {
	copyDetailsPath,
	copyDetailsShard,
	copyPath,
	fileSize,
	mediaLabel,
	nameRequestPath,
	removalRequestPath,
	type CopyDetails
} from '#lib/public-copies.ts';
import { hiddenCopyMessage } from '#lib/nation-restrictions.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { copyLevel } from '#lib/server/nation-restrictions.ts';
import { readableDate } from '#lib/readable-date.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

const byKey = new Map(publicCopies.map((copy) => [copy.key, copy]));

async function detailsOf(key: string, shard: string, url: URL, fetcher: typeof fetch): Promise<CopyDetails | undefined> {
	const address = new URL(copyDetailsPath(shard), url).toString();
	try {
		// In the Worker the prebuilt file is read from the site's own files; while developing, from the route that builds it.
		const assets = workerEnvironment().ASSETS;
		const response = assets ? await assets.fetch(address) : await fetcher(address);
		if (!response.ok) return undefined;
		const details = (await response.json()) as Record<string, CopyDetails>;
		return details[key];
	} catch {
		return undefined;
	}
}

export const load: PageServerLoad = async ({ params, url, fetch, setHeaders }) => {
	const copy = byKey.get(params.key);
	if (!copy) error(404, 'This site keeps no copy at this address.');
	const level = await copyLevel(workerEnvironment().database, copy);
	if (level === 'hide') {
		setHeaders({ 'cache-control': 'no-store' });
		error(404, hiddenCopyMessage);
	}
	const details = await detailsOf(copy.key, copyDetailsShard(copy), url, fetch);
	const file = copyPath(copy);
	const name = fileName(file);
	// A day, as for the file itself: a copy taken off the list stops being shown soon. A nation's
	// law or opinion for five minutes, and not at all while restricted, since a nation's choice shows within minutes.
	setHeaders({ 'cache-control': level !== 'show' ? 'no-store' : copy.restrict ? 'public, max-age=300' : 'public, max-age=86400' });
	return {
		key: copy.key,
		citeOnly: level === 'cite',
		title: details?.opinion?.name ?? details?.title ?? name,
		details: details ?? null,
		kind: details?.kind ?? mediaLabel(copy.mediaType),
		isPdf: copy.mediaType === 'application/pdf',
		file,
		fileName: name,
		size: fileSize(copy.bytes),
		capturedText: details?.captured ? readableDate(details.captured) : '',
		decidedText: details?.opinion?.decided ? readableDate(details.opinion.decided) : '',
		sha256: copy.sha256,
		original: copy.links.at(-1) ?? copy.links[0] ?? '',
		verify: verifyLink(copy.sha256, name),
		removal: removalRequestPath(copy),
		// A redacted opinion (research/tribal-court-opinions/redacted.csv): it says so, and has no link to the original.
		namesReplaced: details?.opinion?.namesReplaced === true,
		nameRequest: nameRequestPath(copy)
	};
};
