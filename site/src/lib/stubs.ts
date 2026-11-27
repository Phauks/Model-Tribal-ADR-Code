/**
 * Stubs, as Wikipedia has them (Trevor, Nov. 24, 2026: "Allow creation of
 * 'Stub' pages, like wikipedia"; design /mnt/project-files/design/stub-pages/).
 * A stub is a page with useful facts but no write-up yet: a court's page,
 * made from the opinions and cases that name it, or a case's or law's page
 * whose record has no box (no summary, holding or quotes), or a person's
 * page that holds only the treaties the person signed. The page shows a
 * "Stub" badge beside its title, whose panel asks readers to help expand it.
 * It once had a second note at its end, as Wikipedia has its stub template;
 * Trevor dropped it on Nov. 27, 2026 ("we don't need to state stub twice on
 * a page"). The badge goes away on its own once the page has a write-up.
 */

export type StubKind = 'court' | 'case' | 'law' | 'person';

export interface Stub {
	kind: StubKind;
	/** What the request form names, such as "cases/kennerly-v-district-court-of-montana-1971". */
	record: string;
}

/** The badge's panel: what makes the page a stub. */
export const stubPanelText: Record<StubKind, string> = {
	court: 'Made from the places this site mentions it. No one has written this page yet.',
	case: 'This page has no summary, holding or quotes yet.',
	law: 'This page has no summary or quotes yet.',
	person: 'This page has only the treaties the person signed.'
};

/** The request form, filled in to offer a write-up ("write-up") or a source ("sources") for the page. */
export function stubRequestLink(stub: Stub, field: 'write-up' | 'sources'): string {
	const query = new URLSearchParams({ kind: 'contribute', record: stub.record, field });
	return `/requests?${query.toString().replaceAll('%2F', '/')}`;
}

/** A row of Workspace › Stubs (src/lib/server/stub-list.ts). */
export interface StubListing {
	kind: StubKind;
	name: string;
	link: string;
	/** "Made from references" or "Short page". */
	made: 'references' | 'short';
	/** What names the page: opinions and cases for a court, other pages on the site for each. */
	mentions: number;
	mentionsText: string;
	/** The request form's record (src/lib/stubs.ts, stubRequestLink). */
	record: string;
}
