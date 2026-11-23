/**
 * Keeping the address book and the nation pages in step (lead author's choice,
 * Nov. 23, 2026: "Weekly check + differences list").
 *
 * The nation profiles in content/tribes stay the published record, with their
 * citations. The address book is the private working list. This file compares
 * the two for office emails and phones only; leaders' own addresses never go
 * on a page, so they are never compared. A difference is fixed by a pull
 * request to the profile, or by bringing the page's address into the book.
 */
import type { ContactMethod, ContactMethodKind, MethodStatus, SourceKind } from './address-book.ts';

/** One office email or phone shown on a nation page, as the profile cites it. */
export interface PublicContact {
	method: ContactMethodKind;
	value: string;
	source: string;
	sourceTitle: string;
	sourceLink: string | null;
	asOf: string | null;
	/** The nation's name in the federal or Alaska directory, when the page's copy came from one. */
	directoryName: string | null;
	sourceKind: SourceKind;
}

/** An office an official list names as the nation's leader, as the nation page shows it (decision record 0052). */
export interface PublicRepresentative {
	office: string;
	listedBy: string;
	link: string;
	/** The name the list uses for the nation, to look it up there. */
	listedAs: string | null;
}

/** A nation page's office emails and phones, and the offices official lists name, listed when the site is built. */
export interface PublicNationContacts {
	identifier: string;
	name: string;
	contacts: PublicContact[];
	representatives: PublicRepresentative[];
}

export type DifferenceKind = 'page-only' | 'book-only' | 'page-shows-old';

export const differenceKindNames: Record<DifferenceKind, string> = {
	'page-only': 'On the nation page, not in the address book',
	'book-only': 'In the address book, not on the nation page',
	'page-shows-old': 'On the nation page, but the address book marks it out of use'
};

export interface Difference {
	kind: DifferenceKind;
	nationIdentifier: string;
	nationName: string;
	method: ContactMethodKind;
	value: string;
	/** Where the page's copy came from, or the address book's source. */
	sourceTitle: string;
	sourceLink: string | null;
	/** For page-shows-old: what the address book says about it. */
	status?: MethodStatus;
	note?: string | null;
}

/** A form of the value that two copies of the same address or number share. */
export function matchKey(method: ContactMethodKind, value: string): string {
	if (method === 'email')
		return value
			.trim()
			.toLowerCase()
			.replace(/^mailto:/, '');
	// The last ten digits, so "+1 (775) 555-0100" and "775.555.0100" match; an extension is dropped.
	const digits = value.replace(/\s*(x|ext\.?)\s*\d+$/i, '').replace(/\D/g, '');
	return digits.slice(-10);
}

/** The address book's office emails and phones for one nation, with the nation they belong to. */
export interface BookOfficeMethod extends Pick<
	ContactMethod,
	'method' | 'value' | 'status' | 'note' | 'sourceLabel' | 'sourceLink'
> {
	nationIdentifier: string;
}

/**
 * Every office email and phone that the nation pages and the address book
 * disagree on, by nation. Only "general office" entries in the book count;
 * an address the book holds under another label (such as a leader's) is
 * neither missing from the page nor out of place on it.
 */
export function differences(pages: PublicNationContacts[], book: BookOfficeMethod[]): Difference[] {
	const found: Difference[] = [];
	const bookByNation = new Map<string, BookOfficeMethod[]>();
	for (const entry of book) {
		const list = bookByNation.get(entry.nationIdentifier) ?? [];
		list.push(entry);
		bookByNation.set(entry.nationIdentifier, list);
	}
	for (const page of pages) {
		const entries = bookByNation.get(page.identifier) ?? [];
		const shown = new Set(
			page.contacts.map((contact) => `${contact.method} ${matchKey(contact.method, contact.value)}`)
		);
		for (const contact of page.contacts) {
			const matches = entries.filter(
				(entry) =>
					entry.method === contact.method &&
					matchKey(entry.method, entry.value) === matchKey(contact.method, contact.value)
			);
			const base = {
				nationIdentifier: page.identifier,
				nationName: page.name,
				method: contact.method,
				value: contact.value,
				sourceTitle: contact.sourceTitle,
				sourceLink: contact.sourceLink
			};
			if (matches.length === 0) found.push({ kind: 'page-only', ...base });
			else if (!matches.some((entry) => entry.status === 'current')) {
				found.push({ kind: 'page-shows-old', ...base, status: matches[0].status, note: matches[0].note });
			}
		}
		for (const entry of entries) {
			if (entry.status !== 'current' || shown.has(`${entry.method} ${matchKey(entry.method, entry.value)}`)) continue;
			found.push({
				kind: 'book-only',
				nationIdentifier: page.identifier,
				nationName: page.name,
				method: entry.method,
				value: entry.value,
				sourceTitle: entry.sourceLabel,
				sourceLink: entry.sourceLink
			});
		}
	}
	return found.sort(
		(a, b) =>
			a.kind.localeCompare(b.kind) ||
			a.nationName.localeCompare(b.nationName, 'en-US') ||
			a.value.localeCompare(b.value)
	);
}

export const federalDirectorySource = 'bia-tribal-leaders-directory-2026';
export const alaskaDirectorySource = 'alaska-dcra-federally-recognized-tribes-contacts';

function registrable(address: string | null | undefined): string {
	try {
		return new URL(address ?? '').hostname
			.toLowerCase()
			.replace(/^www\./, '')
			.split('.')
			.slice(-2)
			.join('.');
	} catch {
		return '';
	}
}

/**
 * What kind of source a profile fact came from, as the address book records
 * it: the federal or Alaska directory by source key, the nation's own website
 * when the source page is on one of the nation's sites, a state government
 * page by its address, and otherwise "other".
 */
export function sourceKindOf(source: string, sourceLink: string | null, nationSites: string[]): SourceKind {
	if (source === federalDirectorySource) return 'federal-directory';
	if (source === alaskaDirectorySource) return 'alaska-directory';
	const domain = registrable(sourceLink);
	if (domain && nationSites.some((site) => registrable(site) === domain)) return 'nation-website';
	try {
		const host = new URL(sourceLink ?? '').hostname.toLowerCase();
		if (/\.gov$|\.state\.[a-z]{2}\.us$/.test(host)) return 'state-directory';
	} catch {
		// No usable link.
	}
	return 'other';
}

/** The nation's name in a directory, from a profile fact's locator. */
export function directoryNameOf(sourceKind: SourceKind, locator: string | null | undefined): string | null {
	if (!locator) return null;
	if (sourceKind === 'alaska-directory') return /record "([^"]+)"/.exec(locator)?.[1] ?? locator;
	return sourceKind === 'federal-directory' ? locator : null;
}
