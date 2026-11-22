/**
 * The list of copies of public documents this site serves itself
 * (src/lib/public-copies.ts), with the address each was published at, the
 * date the copy was made and its SHA-256, so anyone can check a copy against
 * the original.
 */
import { copyPath, fileSize } from '#lib/public-copies.ts';
import { formatCaptureDate } from '#lib/server/markdown.ts';
import { publicCopies } from '#lib/server/content.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	copies: publicCopies().map((copy) => ({
		key: copy.key,
		title: copy.title,
		path: copyPath(copy),
		original: copy.links.at(-1) ?? copy.links[0],
		captured: copy.captured,
		capturedText: copy.captured ? formatCaptureDate(copy.captured) : '',
		size: fileSize(copy.bytes),
		bytes: copy.bytes,
		sha256: copy.sha256,
		rights: copy.rights
	}))
});
