/**
 * The details a copy's page shows (src/routes/copies/view/[...key]): title,
 * date the copy was made, nations, the list it is in and, for a tribal court
 * opinion, its citation. Built with the site, one small file for each pair of
 * leading SHA-256 characters (src/lib/public-copies.ts, copyDetailsShard), so
 * the Worker reads one file on request instead of carrying every title.
 */
import { error, json } from '@sveltejs/kit';
import { copyDetailShardNames, copyDetails } from '#lib/server/copy-lists.ts';
import type { EntryGenerator, RequestHandler } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => copyDetailShardNames().map((shard) => ({ shard }));

export const GET: RequestHandler = ({ params }) => {
	const details = copyDetails(params.shard);
	if (!details) error(404, 'No copies are listed under that name.');
	return json(details);
};
