/**
 * The scanning providers, chosen by the SCAN_PROVIDER setting of the scanner
 * Worker (site/scanner/wrangler.jsonc; site/SCANNING.md, "Swapping the
 * provider"). Each one answers with the same facts (scan-port.ts), so the
 * rest of the site never knows which one looked.
 *
 * - "container": the project's own engine, ClamAV and structural checks in a
 *   Cloudflare Container (site/scanner/engine). The default.
 * - "http": any service that takes the file as the body of a POST and
 *   answers with the same JSON, such as the same engine run somewhere else.
 *   Its address is SCAN_HTTP_ADDRESS and its key, if it needs one, the
 *   secret SCAN_HTTP_TOKEN, sent as a bearer token.
 * - "off": no scanning. Every file stays held as "waiting for a scanner",
 *   never cleared.
 *
 * The container provider is adapted, with Trevor Goldsmith's permission as
 * its owner, from his Magna Carta repository
 * (apps/api-worker/src/files/container-scan-adapter.ts).
 */
import { readRawScanResult, ScanFaultError, type ScanProvider } from './scan-port.ts';

export const providerNames = ['container', 'http', 'off'] as const;

/** Anything with a fetch method: a Container's Durable Object stub, a service binding, or globalThis. */
export interface Fetcher {
	fetch(request: Request): Promise<Response>;
}

/**
 * The longest one scan may take before it counts as stuck and is tried
 * again. Above the engine's own limit (ClamAV stops at five minutes), so a
 * slow but honest scan of a large video is not cut off.
 */
export const scanRequestTimeoutMilliseconds = 8 * 60 * 1000;

/** Sends the body to an engine that speaks the project's JSON and reads the answer. */
async function postForFacts(
	fetcher: Fetcher,
	address: string,
	body: ReadableStream<Uint8Array>,
	facts: { sizeBytes: number; mediaType: string | null },
	headers: Record<string, string>,
	timeoutMilliseconds: number
) {
	const url = new URL(address);
	url.searchParams.set('size', String(facts.sizeBytes));
	if (facts.mediaType) url.searchParams.set('contentType', facts.mediaType);
	let response: Response;
	try {
		response = await fetcher.fetch(
			new Request(url, {
				method: 'POST',
				body,
				headers,
				// A streamed body needs the half-duplex hint in the Workers runtime.
				duplex: 'half',
				signal: AbortSignal.timeout(timeoutMilliseconds)
			} as RequestInit & { duplex: 'half' })
		);
	} catch (problem) {
		throw new ScanFaultError(`The scanner could not be reached: ${problem instanceof Error ? problem.message : String(problem)}`);
	}
	if (response.status === 413) {
		await response.body?.cancel();
		throw new TooLargeForProviderError();
	}
	if (response.status !== 200) {
		await response.body?.cancel();
		throw new ScanFaultError(`The scanner answered with status ${response.status}.`);
	}
	let json: unknown;
	try {
		json = await response.json();
	} catch {
		throw new ScanFaultError('The scanner sent an answer that is not JSON.');
	}
	return readRawScanResult(json);
}

/** The provider refused the file as larger than it scans. The file stays held. */
export class TooLargeForProviderError extends Error {
	override readonly name = 'TooLargeForProviderError';
}

/** The project's own engine in a Cloudflare Container. */
export function containerProvider(
	container: Fetcher,
	options: { wake?: () => Promise<void>; timeoutMilliseconds?: number } = {}
): ScanProvider {
	return {
		name: 'container',
		async scan(body, facts) {
			try {
				// The engine sleeps when idle and takes a minute or so to load ClamAV's signatures.
				await options.wake?.();
			} catch (problem) {
				await body.cancel();
				throw new ScanFaultError(`The scan engine did not start: ${problem instanceof Error ? problem.message : String(problem)}`);
			}
			return postForFacts(container, 'http://engine/scan', body, facts, {}, options.timeoutMilliseconds ?? scanRequestTimeoutMilliseconds);
		}
	};
}

/** Any engine at an address that speaks the same JSON. */
export function httpProvider(settings: { address: string; token?: string; fetcher?: Fetcher; timeoutMilliseconds?: number }): ScanProvider {
	const fetcher = settings.fetcher ?? { fetch: (request: Request) => fetch(request) };
	const headers: Record<string, string> = settings.token ? { authorization: `Bearer ${settings.token}` } : {};
	return {
		name: 'http',
		scan: (body, facts) => postForFacts(fetcher, settings.address, body, facts, headers, settings.timeoutMilliseconds ?? scanRequestTimeoutMilliseconds)
	};
}

/** No engine: an honest "not scanned", which keeps every file held. */
export const noScanning: ScanProvider = {
	name: 'off',
	async scan(body) {
		await body.cancel();
		return {
			engineVersion: null,
			clam: { state: 'unavailable' },
			heuristic: { kind: 'none' },
			matches: [],
			timings: { clamdMs: 0, yaraMs: 0 }
		};
	}
};

export interface ProviderSettings {
	SCAN_PROVIDER?: string;
	SCAN_HTTP_ADDRESS?: string;
	SCAN_HTTP_TOKEN?: string;
}

/**
 * Picks the provider from the settings. An unknown name, or "http" without
 * an address, is a setup mistake: it falls back to no scanning, which holds
 * files, rather than to anything that could clear them.
 */
export function chooseProvider(settings: ProviderSettings, container: { fetcher: Fetcher; wake?: () => Promise<void> } | null): ScanProvider {
	const name = (settings.SCAN_PROVIDER ?? 'container').trim().toLowerCase();
	if (name === 'container' && container) return containerProvider(container.fetcher, { wake: container.wake });
	if (name === 'http' && settings.SCAN_HTTP_ADDRESS) {
		return httpProvider({ address: settings.SCAN_HTTP_ADDRESS, token: settings.SCAN_HTTP_TOKEN || undefined });
	}
	return noScanning;
}
