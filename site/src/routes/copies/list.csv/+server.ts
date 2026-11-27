/**
 * Every copy this site serves, as a CSV file: its address here, the address it
 * was published at, the date it was made, its size and SHA-256, so anyone can
 * check a copy against the original (src/lib/server/copy-lists.ts).
 */
import { allCopyRows } from '#lib/server/copy-lists.ts';
import { csvDocument, csvResponse } from '#lib/csv.ts';

export const prerender = true;

export function GET(): Response {
	const header = ['title', 'nations', 'copy', 'published_at', 'captured', 'bytes', 'sha256'];
	const lines = allCopyRows().map((copy) => [copy.title, copy.nations.map((nation) => nation.name).join('; '), copy.path, copy.original, copy.captured, copy.bytes, copy.sha256]);
	// This file has always ended its lines with a line feed alone and quoted only fields that hold one, so it keeps those rules.
	return csvResponse(csvDocument([header, ...lines], { quoteCarriageReturns: false, lineEnding: '\n' }));
}
