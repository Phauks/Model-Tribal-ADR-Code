/**
 * Groups a nation's contact facts into offices for the contact card on its
 * page: each office is named once, and each contact is a labeled row with the
 * link a reader can act on and the marker of its source, which links to the
 * page's Sources section; the record's label is read only for what it says
 * about the office, not for the list the contact came from.
 */
import type { CitationMark } from './citation-marks.ts';
import { emailLink, mapSearchLink, phoneLink, webLink } from './contact-links.ts';

export type ContactKind =
	| 'website'
	| 'physical-address'
	| 'mailing-address'
	| 'phone'
	| 'fax'
	| 'email'
	| 'other';

export interface ContactRow {
	kind: ContactKind;
	/** The markers of the contact's source (src/lib/citation-marks.ts). */
	citations?: CitationMark[];
	/** The field's name, such as "Phone" or "Mailing address". */
	label: string;
	/** The value, split into lines; an address shows its street and its town on separate lines. */
	lines: string[];
	/** Where the value itself links: a web page, a tel: number or a mailto: address. */
	link?: string;
	/** True when the link leaves the site, so it opens in a new tab. */
	external?: boolean;
	/** A Google Maps search for a street address, shown as its own link. */
	mapLink?: string;
	/** A short note under the value, such as "Alternate number". */
	note?: string;
}

export interface ContactOffice {
	name: string;
	rows: ContactRow[];
}

export interface ContactFact {
	kind: string;
	value: string;
	label?: string;
	link_status?: string;
	link_checked?: string;
}

/** The heading over the contact card, also used to list the contacts' sources. */
export const contactsHeading = 'Government contacts';

/** The office a contact belongs to when its label names no other. */
export const defaultOfficeName = 'Tribal government office';

const rowOrder: ContactKind[] = [
	'website',
	'physical-address',
	'mailing-address',
	'phone',
	'fax',
	'email',
	'other'
];

const kindLabels: Record<ContactKind, string> = {
	website: 'Website',
	'physical-address': 'Physical address',
	'mailing-address': 'Mailing address',
	phone: 'Phone',
	fax: 'Fax',
	email: 'Email',
	other: 'Contact'
};

/** Labels that describe the nation's own office, or the list a contact came from, start with one of these words. */
const genericLabelStart =
	/^(tribal|tribe|official|general|band|website|contact|mailing|social|regional|address|nation|pueblo|sumter)\b/i;

/** Agencies that are not the nation's government, such as "Office of Hawaiian Affairs (state agency)". */
const agencyPattern = /([^,]*?\((?:state agency|federal|[^()]*territorial agency)\))/i;

/** A post office box or general delivery address cannot be found on a map. */
const postOfficeBoxPattern =
	/\b(p\.?\s*o\.?\s*box|post office box|box \d+|general delivery|drawer \d+)\b/i;

function contactKind(kind: string): ContactKind {
	if (kind === 'email-general') return 'email';
	return (rowOrder as string[]).includes(kind) ? (kind as ContactKind) : 'other';
}

/** The office a label names, and what is left of the label to show as a note. */
export function officeAndNote(label: string | undefined): {
	office: string;
	note?: string;
} {
	const text = (label ?? '').trim();
	if (text.length === 0) return { office: defaultOfficeName };

	// "Arctic Village council office: Tribal office main phone"
	const prefixed = /^([^:]+\boffice):\s*(.*)$/i.exec(text);
	if (prefixed) return { office: prefixed[1].trim(), note: noteFrom(prefixed[2]) };

	// "Office of Native Hawaiian Relations (federal), Honolulu street address"
	const agency = agencyPattern.exec(text);
	if (agency) {
		const rest = text
			.slice((agency.index ?? 0) + agency[0].length)
			.replace(/^[\s,]+/, '')
			.replace(/\b(main office|main line|contact number|street address|office)\b/gi, '')
			.replace(/\s+/g, ' ')
			.trim();
		return {
			office: agency[1].trim(),
			note: rest.length > 0 ? rest : undefined
		};
	}

	// "Passamaquoddy Tribe at Indian Township (Motahkomikuk)": a name, worth keeping.
	if (!genericLabelStart.test(text) && !/^u\.s\./i.test(text)) {
		return {
			office: defaultOfficeName,
			note: text.replace(/\s+tribal government$/i, '')
		};
	}
	return { office: defaultOfficeName, note: noteFrom(text) };
}

/** Keeps only the part of a generic label that tells the reader something the row does not. */
function noteFrom(label: string): string | undefined {
	const redirect = /\((?:the )?directory address (\S+) redirects here\)/i.exec(label);
	if (redirect)
		return `The address in the federal directory, ${displayWebAddress(redirect[1])}, leads here.`;
	if (/\bshared\b/i.test(label)) return 'Shared with other nations';
	if (/^social media/i.test(label)) return 'Social media page';
	if (/^regional consortium/i.test(label)) return 'Page of a regional consortium';
	if (/\balternate\b/i.test(label)) return 'Alternate number';
	if (/\bstatute\b/i.test(label)) return 'Address given in state law';
	return undefined;
}

/** "https://www.navajo-nsn.gov/" reads as "navajo-nsn.gov". */
export function displayWebAddress(value: string): string {
	return value
		.trim()
		.replace(/^https?:\/\//i, '')
		.replace(/^www\./i, '')
		.replace(/\/$/, '');
}

/** "100 Parkway, Window Rock, AZ 86515" shows as "100 Parkway" over "Window Rock, AZ 86515". */
export function addressLines(value: string): string[] {
	const parts = value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length < 3) return [parts.join(', ')];
	return [parts.slice(0, -2).join(', '), parts.slice(-2).join(', ')];
}

function sameAddress(first: string, second: string): boolean {
	const normalize = (value: string) => value.toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
	return normalize(first) === normalize(second);
}

function row(fact: ContactFact, note: string | undefined): ContactRow {
	const kind = contactKind(fact.kind);
	const label = kindLabels[kind];
	switch (kind) {
		case 'website': {
			// A lapsed domain no longer belongs to the nation, so it is never linked.
			if (fact.link_status === 'lapsed') {
				const checked = fact.link_checked ? ` (checked ${fact.link_checked})` : '';
				return {
					kind,
					label,
					lines: [displayWebAddress(fact.value)],
					note: [note, `No longer the nation's website${checked}`].filter(Boolean).join('. ')
				};
			}
			const link = webLink(fact.value);
			return {
				kind,
				label,
				lines: [link ? displayWebAddress(fact.value) : fact.value],
				link,
				external: link !== undefined,
				note
			};
		}
		case 'physical-address':
		case 'mailing-address':
			return {
				kind,
				label,
				lines: addressLines(fact.value),
				mapLink: postOfficeBoxPattern.test(fact.value) ? undefined : mapSearchLink(fact.value),
				note
			};
		case 'phone':
			return {
				kind,
				label,
				lines: [fact.value],
				link: phoneLink(fact.value),
				note
			};
		case 'email':
			return {
				kind,
				label,
				lines: [fact.value],
				link: emailLink(fact.value),
				note
			};
		default:
			// A fax cannot be dialed from a page, so it is shown as text.
			return {
				kind,
				label: kind === 'other' ? labelFor(fact.kind) : label,
				lines: [fact.value],
				note
			};
	}
}

function labelFor(kind: string): string {
	const words = kind.replace(/[-_]+/g, ' ').trim();
	return words.charAt(0).toLocaleUpperCase('en-US') + words.slice(1);
}

/**
 * Groups contact facts by office, in the order the offices first appear, with
 * rows in a fixed order. cite, when given, returns the markers for a fact's
 * source; it is called only for the rows shown, in the order they are shown.
 */
export function contactOffices<Fact extends ContactFact>(
	facts: Fact[],
	cite?: (fact: Fact) => CitationMark[] | undefined
): ContactOffice[] {
	const offices = new Map<string, { fact: Fact; row: ContactRow }[]>();
	for (const fact of facts) {
		if (typeof fact.value !== 'string' || fact.value.trim().length === 0) continue;
		const { office, note } = officeAndNote(fact.label);
		const entries = offices.get(office) ?? [];
		entries.push({ fact, row: row(fact, note) });
		offices.set(office, entries);
	}

	return [...offices].map(([name, entries]) => {
		const rows = entries
			.map((entry, index) => ({ ...entry, index }))
			.sort(
				(a, b) => rowOrder.indexOf(a.row.kind) - rowOrder.indexOf(b.row.kind) || a.index - b.index
			);
		// A mailing address that repeats the office's physical address says so instead of repeating it.
		const physical = rows.find((entry) => entry.row.kind === 'physical-address');
		for (const entry of rows) {
			if (
				physical &&
				entry.row.kind === 'mailing-address' &&
				sameAddress(entry.fact.value, physical.fact.value)
			) {
				entry.row.lines = ['Same as physical address'];
				entry.row.mapLink = undefined;
			}
		}
		// A website the directory lists that now leads to the nation's own site is shown once, as a note on that site.
		const leadsHere = rows
			.map(
				(entry) =>
					/\((?:the )?directory address (\S+) redirects here\)/i.exec(entry.fact.label ?? '')?.[1]
			)
			.filter((address): address is string => address !== undefined)
			.map(displayWebAddress);
		const shown = rows.filter(
			(entry) =>
				!(entry.row.kind === 'website' && leadsHere.includes(displayWebAddress(entry.fact.value)))
		);
		for (const entry of shown) {
			const citations = cite?.(entry.fact);
			if (citations && citations.length > 0) entry.row.citations = citations;
		}
		return { name, rows: shown.map((entry) => entry.row) };
	});
}
