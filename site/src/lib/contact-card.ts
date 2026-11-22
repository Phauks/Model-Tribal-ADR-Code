/**
 * Groups a nation's contact facts for the contact cards on its page: the
 * websites in a card of their own, then one card for each office, named once,
 * where each contact is a labeled row with the link a reader can act on and
 * the marker of its source, which links to the page's Sources section. The
 * record's label is read only for what it says about the office, not for the
 * list the contact came from.
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
	/** Where the value itself links: a web page, a Google Maps search, a tel: number or a mailto: address. */
	link?: string;
	/** True when the link leaves the site, so it opens in a new tab. */
	external?: boolean;
	/** Words read after the link by screen readers, such as "opens in Google Maps in a new tab". */
	linkHint?: string;
	/** A short note under the value, such as "Alternate number". */
	note?: string;
}

export interface ContactOffice {
	name: string;
	rows: ContactRow[];
}

/** What the page shows: the websites apart from the offices, since a website is not part of an office's address. */
export interface ContactCards {
	websites: ContactRow[];
	offices: ContactOffice[];
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
export const defaultOfficeName = 'Tribal Government Office';

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
	if (prefixed) return { office: titleCase(prefixed[1].trim()), note: noteFrom(prefixed[2]) };

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

const minorWords = new Set([
	'a',
	'an',
	'and',
	'at',
	'by',
	'for',
	'in',
	'of',
	'on',
	'or',
	'the',
	'to'
]);

/** "Arctic Village council office" reads as "Arctic Village Council Office", like the default office's name. */
export function titleCase(name: string): string {
	return name
		.split(' ')
		.map((word, index) =>
			index > 0 && minorWords.has(word.toLocaleLowerCase('en-US'))
				? word.toLocaleLowerCase('en-US')
				: word.charAt(0).toLocaleUpperCase('en-US') + word.slice(1)
		)
		.join(' ');
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
				linkHint: link ? 'opens in a new tab' : undefined,
				note
			};
		}
		case 'physical-address':
		case 'mailing-address': {
			// The address itself opens a Google Maps search; a post office box gets no link.
			const link = postOfficeBoxPattern.test(fact.value) ? undefined : mapSearchLink(fact.value);
			return {
				kind,
				label,
				lines: addressLines(fact.value),
				link,
				external: link !== undefined,
				linkHint: link ? 'opens in Google Maps in a new tab' : undefined,
				note
			};
		}
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
 * rows in a fixed order, and moves every website into a group of its own.
 * cite, when given, returns the markers for a fact's source; it is called
 * only for the rows shown, in the order they are shown: websites first.
 */
export function contactCards<Fact extends ContactFact>(
	facts: Fact[],
	cite?: (fact: Fact) => CitationMark[] | undefined
): ContactCards {
	const offices = new Map<string, { fact: Fact; row: ContactRow }[]>();
	for (const fact of facts) {
		if (typeof fact.value !== 'string' || fact.value.trim().length === 0) continue;
		const { office, note: labelNote } = officeAndNote(fact.label);
		// A note that only repeats part of the value, such as "Honolulu" under a Honolulu address, is left out.
		const note =
			labelNote &&
			fact.value.toLocaleLowerCase('en-US').includes(labelNote.toLocaleLowerCase('en-US'))
				? undefined
				: labelNote;
		const entries = offices.get(office) ?? [];
		entries.push({ fact, row: row(fact, note) });
		offices.set(office, entries);
	}

	const grouped = [...offices].map(([name, entries]) => {
		const rows = entries
			.map((entry, index) => ({ ...entry, index }))
			.sort(
				(a, b) => rowOrder.indexOf(a.row.kind) - rowOrder.indexOf(b.row.kind) || a.index - b.index
			);
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
		return { name, entries: shown };
	});

	// A website belongs to no office's address; one listed for another office names that office.
	const websiteEntries = grouped.flatMap((office) =>
		office.entries
			.filter((entry) => entry.row.kind === 'website')
			.map((entry) =>
				office.name === defaultOfficeName
					? entry
					: {
							...entry,
							row: { ...entry.row, note: [office.name, entry.row.note].filter(Boolean).join('. ') }
						}
			)
	);
	const officeEntries = grouped
		.map((office) => ({
			name: office.name,
			entries: office.entries.filter((entry) => entry.row.kind !== 'website')
		}))
		.filter((office) => office.entries.length > 0);

	// Source markers are numbered in the order the rows appear on the page.
	const withCitations = (entry: { fact: Fact; row: ContactRow }): ContactRow => {
		const citations = cite?.(entry.fact);
		return citations && citations.length > 0 ? { ...entry.row, citations } : entry.row;
	};
	const websites = websiteEntries.map(withCitations);
	const officeCards = officeEntries.map((office) => ({
		name: office.name,
		rows: office.entries.map(withCitations)
	}));
	return { websites, offices: officeCards };
}
