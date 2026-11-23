// Verify a file used to be a page of its own; Trevor asked on Nov. 23, 2026 that it be part of the
// Downloads page. Links already handed out, in ZIP files and elsewhere, still work: this sends the
// reader to the Downloads page's "Checking a file" section, keeping the hash the link carried.
import { redirect } from '@sveltejs/kit';
import { verifyPage, verifySection } from '#lib/checksums.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

export const GET: RequestHandler = ({ url }) => {
	redirect(308, `${verifyPage}${url.search}#${verifySection}`);
};
