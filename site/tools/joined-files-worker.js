// Copied beside the built Worker by tools/split-large-files.mjs. Plain JavaScript whose only import is the Workers runtime's own module, so Wrangler bundles it as it is and the tests can load it (tests/joined-files.test.ts).
//
// Cloudflare refuses a static file over 25 MiB, and some built files grow past that with every data pull: the list of every copy (/copies/list.csv), the list of United States documents to save offline (/copies/offline/federal.json) and the finder's index of every page (/offline-catalog/index.json). So the build splits each built file over the limit into parts under /page-data/private/parts/ and lists them in /page-data/private/parts.json (tools/split-large-files.mjs). Readers cannot ask for the parts (tools/nation-page-changes-worker.js, privateData).
//
// This wraps the Worker so that a split file answers at its own address with the parts joined as they stream out, the same bytes as the file the build made, and so that the ASSETS binding answers the same way for the code that reads the file through it (the filtered list of copies in src/routes/restricted-files, the zip of United States documents). The site reads its bindings from the env of "cloudflare:workers" (src/lib/server/environment.ts), not from the handler's env, so the handlers run inside withEnv with the joining ASSETS in place. It sits inside tools/nation-page-changes-worker.js, so a file the Worker filters reaches it only as /restricted-files/<address>, which reads the joined file through ASSETS and filters it as before.

import { withEnv } from 'cloudflare:workers';

export const partsListAddress = '/page-data/private/parts.json';

/**
 * @typedef {{ bytes: number, sha256: string, parts: string[] }} SplitFile
 * @typedef {{ fetch: (input: Request | string | URL, init?: RequestInit) => Promise<Response>, [key: string]: unknown }} Assets
 * @typedef {{ fetch: (request: Request, env: any, context: unknown) => Promise<Response>, [key: string]: unknown }} Worker
 */

/** @type {WeakMap<object, Promise<Record<string, SplitFile>>>} */
const partsLists = new WeakMap();

/**
 * The split files of this build, by address, read once in each copy of the
 * Worker. A build with nothing split, or none of its own, has none.
 * @param {Assets} assets
 * @returns {Promise<Record<string, SplitFile>>}
 */
function splitFiles(assets) {
	let read = partsLists.get(assets);
	if (!read) {
		read = assets.fetch(new Request(new URL(partsListAddress, 'https://assets.invalid'))).then(async (response) => {
			if (response.status === 404) {
				await response.body?.cancel();
				return {};
			}
			if (!response.ok) throw new Error(`Reading ${partsListAddress} failed: ${response.status}`);
			return /** @type {Record<string, SplitFile>} */ (await response.json());
		});
		read.catch(() => partsLists.delete(assets));
		partsLists.set(assets, read);
	}
	return read;
}

/**
 * The split file a request names: the file's own address, or for a page the
 * address without ".html", as Cloudflare answers built pages.
 * @param {Assets} assets
 * @param {Request} request
 * @returns {Promise<SplitFile | undefined>}
 */
async function splitFileFor(assets, request) {
	if (request.method !== 'GET' && request.method !== 'HEAD') return undefined;
	const files = await splitFiles(assets);
	const { pathname } = new URL(request.url);
	return files[pathname] ?? (pathname.endsWith('/') ? files[`${pathname}index.html`] : (files[`${pathname}.html`] ?? files[`${pathname}/index.html`]));
}

/**
 * Whether the request's "If-None-Match" names this tag.
 * @param {Request} request
 * @param {string} tag
 */
function notModified(request, tag) {
	const asked = request.headers.get('if-none-match');
	if (!asked) return false;
	const bare = (/** @type {string} */ value) => value.trim().replace(/^W\//, '');
	return asked.split(',').some((value) => value.trim() === '*' || bare(value) === bare(tag));
}

/**
 * A split file as one answer: the first part's headers with the whole
 * file's size and tag, and the parts' bodies one after another.
 * @param {Assets} assets
 * @param {SplitFile} file
 * @param {Request} request
 */
async function joinedResponse(assets, file, request) {
	const partAddress = (/** @type {string} */ part) => new Request(new URL(part, request.url));
	const first = await assets.fetch(partAddress(file.parts[0]));
	if (first.status !== 200) return first;
	const headers = new Headers(first.headers);
	const tag = `"${file.sha256}"`;
	headers.set('etag', tag);
	headers.set('content-length', String(file.bytes));
	if (request.method === 'HEAD' || notModified(request, tag)) {
		await first.body?.cancel();
		if (request.method !== 'HEAD') headers.delete('content-length');
		return new Response(null, { status: request.method === 'HEAD' ? 200 : 304, headers });
	}
	let index = 0;
	/** @type {ReadableStreamDefaultReader<Uint8Array> | undefined} */
	let reader = first.body?.getReader();
	const body = new ReadableStream({
		async pull(controller) {
			while (reader) {
				const { done, value } = await reader.read();
				if (!done) {
					controller.enqueue(value);
					return;
				}
				index += 1;
				if (index >= file.parts.length) {
					reader = undefined;
					break;
				}
				const next = await assets.fetch(partAddress(file.parts[index]));
				// A missing part would leave the file short: the reader gets an error, not a file that looks whole.
				if (next.status !== 200 || !next.body) throw new Error(`Part ${index + 1} of a split file answered ${next.status}`);
				reader = next.body.getReader();
			}
			controller.close();
		},
		async cancel(reason) {
			await reader?.cancel(reason);
		}
	});
	return new Response(body, { status: 200, headers });
}

/**
 * The ASSETS binding, answering a split file's address with its parts joined.
 * @param {Assets} assets
 * @returns {Assets}
 */
export function joinedAssets(assets) {
	return {
		...assets,
		async fetch(input, init) {
			const request = new Request(input, init);
			const file = await splitFileFor(assets, request);
			return file ? joinedResponse(assets, file, request) : assets.fetch(input, init);
		}
	};
}

/** @type {WeakMap<object, object>} */
const environments = new WeakMap();

/**
 * The Worker's bindings with ASSETS answering split files, the same object for the same bindings.
 * @param {any} env
 * @returns {any}
 */
function joinedEnvironment(env) {
	if (!env?.ASSETS) return env;
	const kept = environments.get(env);
	if (kept) return kept;
	const joined = { ...env, ASSETS: joinedAssets(env.ASSETS) };
	environments.set(env, joined);
	return joined;
}

/**
 * @param {Worker} worker
 * @returns {Worker}
 */
export function withJoinedFiles(worker) {
	/** @type {Worker} */
	const wrapped = { ...worker };
	// The scheduled and email handlers see the same files.
	for (const name of ['scheduled', 'email', 'queue']) {
		const handler = worker[name];
		if (typeof handler === 'function') {
			wrapped[name] = (/** @type {unknown} */ event, /** @type {any} */ env, /** @type {unknown} */ context) => {
				const joined = joinedEnvironment(env);
				return withEnv(joined, () => handler.call(worker, event, joined, context));
			};
		}
	}
	/** @param {Request} request @param {any} env @param {unknown} context */
	wrapped.fetch = async (request, env, context) => {
		if (!env?.ASSETS) return worker.fetch(request, env, context);
		const file = await splitFileFor(env.ASSETS, request);
		if (file) return joinedResponse(env.ASSETS, file, request);
		const joined = joinedEnvironment(env);
		return withEnv(joined, () => worker.fetch(request, joined, context));
	};
	return wrapped;
}
