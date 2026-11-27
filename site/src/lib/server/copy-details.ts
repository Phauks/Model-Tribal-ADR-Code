/**
 * A copy's title, date, nations and citation, from the small prebuilt file
 * that holds them (src/routes/copies/details/[shard].json), for the pages
 * the Worker draws on request: the copy's reading page and its reading
 * version's downloads.
 */
import { copyDetailsPath, copyDetailsShard, type CopyDetails } from '../public-copies.ts';
import { workerEnvironment } from './environment.ts';
import { reportHere } from './report-here.ts';

export async function copyDetailsOf(copy: { key: string; sha256: string }, url: URL, fetcher: typeof fetch): Promise<CopyDetails | undefined> {
	const address = new URL(copyDetailsPath(copyDetailsShard(copy)), url).toString();
	try {
		// In the Worker the prebuilt file is read from the site's own files; while developing, from the route that builds it.
		const assets = workerEnvironment().ASSETS;
		const response = assets ? await assets.fetch(address) : await fetcher(address);
		if (!response.ok) return undefined;
		const details = (await response.json()) as Record<string, CopyDetails>;
		return details[copy.key];
	} catch (problem) {
		// The page still shows the copy, under its file name; the missing details are reported.
		reportHere(problem, { code: 'copies.details', place: 'copy-details', path: url.pathname });
		return undefined;
	}
}
