/**
 * Opens Request a Change (src/lib/components/RequestChange.svelte) already
 * filled in, from an error page or an error box's Report button (site/ERRORS.md;
 * mockup 12 in project files design/error-framework/, approved by Trevor on
 * Nov. 27, 2026). Without scripts the same button is a link to the request
 * page with the same answers in its address.
 */
import type { RequestKind } from './requests.ts';

export interface ReportPreset {
	kind: RequestKind;
	/** The web page the request is about: the whole address, without its query. */
	material: string;
	/** What to say in Details to start with, which the reader can change. */
	details?: string;
}

export const reportRequestEvent = 'tlp:request-change';

/** Opens the masthead's Request a Change dialog with these answers. */
export function openReport(preset: ReportPreset): void {
	dispatchEvent(new CustomEvent<ReportPreset>(reportRequestEvent, { detail: preset }));
}

/** The request page with the same answers, for a reader without scripts. */
export function reportLink(preset: ReportPreset): string {
	const query = new URLSearchParams({ kind: preset.kind, address: preset.material });
	if (preset.details) query.set('details', preset.details);
	return `/requests?${query}`;
}

/** An address as a report names it: the site and path, without the query, where sign-in links carry codes. */
export function reportedAddress(url: Pick<URL, 'origin' | 'pathname'>): string {
	return `${url.origin}${url.pathname}`;
}

/** Report's answers for a part of a page that failed, such as "The map failed to load." */
export function partReport(url: Pick<URL, 'origin' | 'pathname'>, what: string): ReportPreset {
	return { kind: 'broken-page', material: reportedAddress(url), details: what };
}
