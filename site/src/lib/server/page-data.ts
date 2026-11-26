/**
 * The large families of item pages (cases, laws, biographies, and the
 * Supreme Court's Justices, Presidents and Courts) are drawn by the Worker
 * when a reader opens one, not built ahead of time (Trevor, Nov. 24, 2026:
 * "kind of crazy to build it all before they see it"). Building every page's
 * HTML and its __data.json took most of the build, and each build changed
 * every page file (the build's version is written into each), so Cloudflare
 * uploaded all of them again on every deploy.
 *
 * The page's data is still worked out when the site is built, from the
 * records in content/, which only the build can read: the route
 * src/routes/page-data/[family]/[key].json writes it as a static file. Those
 * files change only when the records behind them do. When a reader opens the
 * page, its load reads that file from the static files (the ASSETS binding),
 * keeps it in memory for the next reader of the same page, and the Worker
 * draws the page with the same component as before.
 */
import { error } from '@sveltejs/kit';
import { parse } from 'devalue';
import { pageDataPath, type PageDataFamily } from '../page-data.ts';
import { workerEnvironment } from './environment.ts';

const remembered = new Map<string, Promise<Record<string, unknown> | undefined>>();
/** Pages kept in memory in one copy of the Worker. Most are tens of kilobytes. */
const rememberedAtMost = 200;

const notFound: Record<PageDataFamily, string> = {
	cases: 'No case has this address.',
	laws: 'No law has this address.',
	biographies: 'This site has no page for that person.',
	justices: 'This site has no page for that Justice.',
	presidents: 'This site has no page for that President.',
	courts: 'This site has no page for that Court.'
};

async function read(path: string, origin: string): Promise<Record<string, unknown> | undefined> {
	const assets = workerEnvironment().ASSETS;
	if (!assets) error(503, 'This page cannot be read right now.');
	const response = await assets.fetch(new URL(path, origin).toString());
	if (response.status === 404) return undefined;
	if (!response.ok) throw new Error(`Reading ${path} failed: ${response.status}`);
	return parse(await response.text()) as Record<string, unknown>;
}

/** A page's data as built, for its load in the Worker; a 404 when the site has no such page. */
export async function builtPageData<Data>(family: PageDataFamily, key: string, url: URL): Promise<Data> {
	const path = pageDataPath(family, key);
	let answer = remembered.get(path);
	if (!answer) {
		answer = read(path, url.origin).catch((problem: unknown) => {
			remembered.delete(path);
			throw problem;
		});
		if (remembered.size >= rememberedAtMost) remembered.delete(remembered.keys().next().value as string);
		remembered.set(path, answer);
	}
	const data = await answer;
	if (!data) error(404, notFound[family]);
	return data as Data;
}
