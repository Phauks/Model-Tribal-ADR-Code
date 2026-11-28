/**
 * Request a Change (src/lib/components/RequestChange.svelte) is the site's
 * one way to ask for a change (Trevor, Nov. 28, 2026: "we should only have
 * one flow for changes"). The separate request page at /requests is gone;
 * every link that used to open it, such as "Ask to remove it" on a copy or
 * "Expand this page" on a stub, now opens the masthead's dialog already
 * filled in, over the page the reader is on.
 *
 * Such a link is the page's own address with a fragment, #request=remove&record=...,
 * so it works in any page, in rendered Markdown and in a saved copy's frame.
 * The dialog opens on the click, or on arrival when a reader follows one
 * from elsewhere, and then takes the fragment out of the address. An old
 * /requests address redirects to the record's page with the same fragment
 * (src/routes/requests/+page.server.ts).
 *
 * An error page or an error box's Report button opens it the same way
 * (site/ERRORS.md; mockup 12 in project files design/error-framework/,
 * approved by Trevor on Nov. 27, 2026).
 */
import { isRequestKind, type RequestKind } from './requests.ts';

/** What Request a Change starts with. Every part is optional: an empty preset opens the dialog as the flag does. */
export interface RequestPreset {
	kind?: RequestKind;
	/** The record the request is about, such as "tribes/navajo-nation" or "copies/<key>". */
	record?: string;
	/** The part of the record, such as "recognition" or "write-up". */
	field?: string;
	/** The web page the request is about: the whole address, without its query. */
	material?: string;
	/** What to say in Details to start with, which the reader can change. */
	details?: string;
	/** Written to a claimed nation's team from its page's badge. */
	toTeam?: boolean;
}

/** What an error page or an error box's Report fills in. */
export interface ReportPreset extends RequestPreset {
	kind: RequestKind;
	material: string;
}

export const reportRequestEvent = 'tlp:request-change';

/** The fragment that opens Request a Change: #request=<kind>, or #request alone. */
const fragmentName = 'request';

/** Opens the masthead's Request a Change dialog with these answers. */
export function openReport(preset: RequestPreset): void {
	dispatchEvent(new CustomEvent<RequestPreset>(reportRequestEvent, { detail: preset }));
}

/** The query-style text of a preset, with slashes left readable. */
function presetQuery(preset: RequestPreset): string {
	const query = new URLSearchParams();
	query.set(fragmentName, preset.kind ?? '');
	if (preset.record) query.set('record', preset.record.slice(0, 200));
	if (preset.field) query.set('field', preset.field.slice(0, 200));
	if (preset.material) query.set('address', preset.material.slice(0, 500));
	if (preset.details) query.set('details', preset.details.slice(0, 2000));
	if (preset.toTeam) query.set('to', 'team');
	return query.toString().replaceAll('%2F', '/');
}

/**
 * A link that opens Request a Change filled in, on the page that holds the
 * link: "#request=remove&record=copies/...". Give page to open it on another
 * page, such as a copy's own page from inside its frame.
 */
export function requestLink(preset: RequestPreset = {}, page = ''): string {
	return `${page}#${presetQuery(preset)}`;
}

/** The same answers as an error page's Report button, as a link. */
export function reportLink(preset: ReportPreset): string {
	return requestLink(preset);
}

/** Reads the preset in a #request=... fragment, or undefined when the fragment is something else. */
export function presetFromFragment(hash: string): RequestPreset | undefined {
	const text = hash.startsWith('#') ? hash.slice(1) : hash;
	if (text !== fragmentName && !text.startsWith(`${fragmentName}=`) && !text.startsWith(`${fragmentName}&`)) return undefined;
	return presetFromQuery(new URLSearchParams(text), fragmentName);
}

/** Reads a preset from a query, as the old /requests?kind=... address had it. */
export function presetFromQuery(query: URLSearchParams, kindName = 'kind'): RequestPreset {
	const kind = query.get(kindName);
	const text = (name: string, length: number) => (query.get(name) ?? '').slice(0, length) || undefined;
	const preset: RequestPreset = {
		...(isRequestKind(kind) ? { kind } : {}),
		record: text('record', 200),
		field: text('field', 200),
		material: text('address', 500),
		details: text('details', 2000),
		...(query.get('to') === 'team' && kind === 'question' ? { toTeam: true } : {})
	};
	return Object.fromEntries(Object.entries(preset).filter(([, value]) => value !== undefined)) as RequestPreset;
}

/**
 * The page a record is shown on, for an old /requests address: a nation's
 * page for tribes/<id>, a copy's page for copies/<key>, and the same address
 * for cases, courts, laws, biographies, stories and glossary terms. Undefined
 * for a record with no page of its own, such as an uploaded file.
 */
export function pageOfRecord(record: string): string | undefined {
	if (!/^[\w./-]+$/.test(record) || record.includes('..')) return undefined;
	if (record.startsWith('tribes/')) return `/nations/${record.slice('tribes/'.length)}`;
	if (record.startsWith('copies/')) return `/copies/view/${record.slice('copies/'.length)}`;
	if (/^(cases|courts|laws|biographies|stories|glossary)(\/|$)/.test(record)) return `/${record}`;
	if (record === 'events') return '/events';
	return undefined;
}

/** The page and #request=... fragment an old /requests address now opens. */
export function oldRequestTarget(url: URL): string {
	const preset = presetFromQuery(url.searchParams);
	let page = preset.record ? pageOfRecord(preset.record) : undefined;
	if (!page && preset.material) {
		const named = URL.canParse(preset.material, url.origin) ? new URL(preset.material, url.origin) : undefined;
		if (named && named.origin === url.origin && named.pathname !== '/requests') page = named.pathname;
	}
	return requestLink(preset, page ?? '/');
}

/** An address as a report names it: the site and path, without the query, where sign-in links carry codes. */
export function reportedAddress(url: Pick<URL, 'origin' | 'pathname'>): string {
	return `${url.origin}${url.pathname}`;
}

/** Report's answers for a part of a page that failed, such as "The map failed to load." */
export function partReport(url: Pick<URL, 'origin' | 'pathname'>, what: string): ReportPreset {
	return { kind: 'broken-page', material: reportedAddress(url), details: what };
}
