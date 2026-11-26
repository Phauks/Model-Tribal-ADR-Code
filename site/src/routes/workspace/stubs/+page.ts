// The list is a file made when the site is built (/stubs.json), so the page
// reads it in the browser; the workspace's own layout still checks who is
// signed in.
import type { StubListing } from '#lib/stubs.ts';
import type { PageLoad } from './$types';

export const ssr = false;

export const load: PageLoad = async ({ fetch }) => {
	const response = await fetch('/stubs.json');
	return { stubs: response.ok ? ((await response.json()) as StubListing[]) : [] };
};
