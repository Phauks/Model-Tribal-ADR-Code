/**
 * Prerendered pages drawn again when something on them is restricted
 * (src/lib/restricted-pages.ts). The Worker sends requests for these pages,
 * and for the data a move within the site asks for, to
 * /restricted-pages/<address> (tools/nation-page-changes-worker.js). The
 * hook (src/hooks.server.ts, restrictedPageAnswer) then answers with the
 * page as built when nothing on it is restricted; otherwise it puts the
 * page's own address back and lets src/routes/restricted-pages draw the
 * page from its built data, filtered.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import type { RequestEvent } from '@sveltejs/kit';
import { unflatten } from 'devalue';
import { filterPageData, restrictedPageView, type RestrictedPageView } from '../restricted-pages.ts';
import { timelineKinds } from '../timeline.ts';
import { workerEnvironment } from './environment.ts';
import { siteRestrictions } from './site-restrictions.ts';

export const restrictedPagePrefix = '/restricted-pages';

type Assets = { fetch(request: Request | string): Promise<Response> };

export interface RestrictedPage {
	view: RestrictedPageView;
	/** The address's parts, as the page's own route names them. */
	params: Record<string, string>;
	data: Record<string, unknown>;
	/** Whether anything on the page is restricted, so it must be drawn again. */
	changed: boolean;
}

const memory = new Map<string, Promise<RestrictedPage | undefined>>();
const kinds = timelineKinds.map(({ kind }) => kind);

function paramsOf(view: RestrictedPageView, match: RegExpExecArray): Record<string, string> {
	switch (view) {
		case 'nation':
		case 'opinions':
			return { id: match[1] };
		case 'copies':
			return { group: match[1] };
		case 'chart-bar':
			return { chart: match[1], bar: match[2] };
		case 'timeline':
			return {};
	}
}

/** The page's data as built: the last node of its __data.json, which SvelteKit writes with devalue. */
async function builtData(path: string, assets: Assets, origin: string): Promise<Record<string, unknown> | undefined> {
	const response = await assets.fetch(new URL(`${path}/__data.json`, origin).toString());
	if (!response.ok) return undefined;
	const file = (await response.json()) as { nodes?: ({ type: string; data?: unknown[] } | null)[] };
	const node = file.nodes?.at(-1);
	if (!node || node.type !== 'data' || !Array.isArray(node.data)) return undefined;
	return unflatten(node.data) as Record<string, unknown>;
}

/**
 * A page as a reader may have it, or undefined for a page that is never
 * drawn again or when nothing is restricted. Kept for each state of the
 * restrictions, so the hook and the page's load read it once.
 */
export async function restrictedPage(path: string, assets: Assets | undefined, database: D1Database | undefined, origin: string): Promise<RestrictedPage | undefined> {
	const found = restrictedPageView(path);
	if (!found || !assets) return undefined;
	const restrictions = await siteRestrictions(database, assets, origin);
	if (!restrictions) return undefined;
	const key = `${restrictions.stamp}|${path}`;
	let answer = memory.get(key);
	if (!answer) {
		answer = builtData(path, assets, origin)
			.then((data) => {
				if (!data) return undefined;
				const filtered = filterPageData(found.view, found.match, data, restrictions, kinds);
				return { view: found.view, params: paramsOf(found.view, found.match), data: filtered, changed: filtered !== data && JSON.stringify(filtered) !== JSON.stringify(data) };
			})
			.catch((problem) => {
				console.error('A restricted page could not be read', path, problem);
				memory.delete(key);
				return undefined;
			});
		// Some pages' data is large (the full timeline's is about 1 MB), so only the last few dozen are kept.
		if (memory.size >= 40) memory.delete(memory.keys().next().value as string);
		memory.set(key, answer);
	}
	return answer;
}

/**
 * For a request the Worker sent to /restricted-pages/<address>: the page as
 * built when nothing on it is restricted, or undefined after putting the
 * page's own address back, so the request goes on to be drawn again with
 * the page's own address in its links and data.
 */
export async function restrictedPageAnswer(event: RequestEvent): Promise<Response | undefined> {
	const path = event.url.pathname.slice(restrictedPagePrefix.length) || '/';
	const environment = workerEnvironment();
	const page = await restrictedPage(path, environment.ASSETS, environment.database, event.url.origin);
	if (!page?.changed) {
		if (!environment.ASSETS) return new Response('Not found', { status: 404 });
		const address = new URL(`${path}${event.isDataRequest ? '/__data.json' : ''}`, event.url);
		return environment.ASSETS.fetch(new Request(address, { headers: event.request.headers }));
	}
	event.url.pathname = path;
	return undefined;
}
