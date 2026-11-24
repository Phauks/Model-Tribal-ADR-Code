/**
 * A nation's public government office contacts as contact cards (vCard 3.0, RFC 2426), for an
 * address book (site/DESIGN.md, section 6, "Download"). Trevor asked for them on Nov. 23, 2026.
 * They hold only what the nation's page shows: offices' addresses, phones, faxes, general emails
 * and websites, never a named person (the project keeps leaders' details private).
 *
 * Version 3.0 rather than 4.0, because phones and desktop address books read it most widely.
 */
import type { ContactCards, ContactRow } from './contact-card.ts';
import { escapeContentText, foldContentLine } from './content-lines.ts';

/** Escapes a text value: backslash, comma, semicolon and line breaks. */
export const vcardText = escapeContentText;

/** Folds a line longer than 75 octets onto continuation lines, which start with a space. */
export const foldLine = foldContentLine;

/** "100 Parkway, Window Rock, AZ 86515" as the address parts: street, town, state, postal code. */
export function addressParts(value: string): { street: string; town: string; region: string; code: string } {
	const match = /^(.*?),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$/.exec(value.trim());
	if (!match) return { street: value.trim(), town: '', region: '', code: '' };
	return { street: match[1].trim(), town: match[2].trim(), region: match[3], code: match[4] };
}

function value(row: ContactRow): string {
	return row.lines.join(', ');
}

function lines(row: ContactRow): string[] {
	const text = value(row);
	switch (row.kind) {
		case 'physical-address':
		case 'mailing-address': {
			const parts = addressParts(text);
			const type = row.kind === 'physical-address' ? 'WORK' : 'WORK,POSTAL';
			return [`ADR;TYPE=${type}:;;${[parts.street, parts.town, parts.region, parts.code, 'USA'].map(vcardText).join(';')}`];
		}
		case 'phone':
			return [`TEL;TYPE=WORK,VOICE:${vcardText(text)}`];
		case 'fax':
			return [`TEL;TYPE=WORK,FAX:${vcardText(text)}`];
		case 'email':
			return [`EMAIL;TYPE=INTERNET,WORK:${vcardText(text)}`];
		case 'website':
		case 'contact-page':
			return row.link ? [`URL:${row.link}`] : [];
		default:
			return [`NOTE:${vcardText(`${row.label}: ${text}`)}`];
	}
}

/** One card for each office, with the nation's websites on each; a nation with no office gets one card. */
export function nationVcards(nation: string, cards: ContactCards, page: string): string {
	const websites = cards.websites.flatMap(lines);
	const offices = cards.offices.length > 0 ? cards.offices : [{ name: '', rows: [] }];
	return offices
		.map((office) => {
			const name = office.name ? `${nation}, ${office.name}` : nation;
			const card = [
				'BEGIN:VCARD',
				'VERSION:3.0',
				`FN:${vcardText(name)}`,
				`N:${vcardText(name)};;;;`,
				`ORG:${vcardText(nation)}${office.name ? `;${vcardText(office.name)}` : ''}`,
				// Address books on Apple devices show the card as an organization, not a person.
				'X-ABShowAs:COMPANY',
				...office.rows.flatMap(lines),
				...websites,
				`NOTE:${vcardText(`Public office contacts from the Model Tribal ADR Code website, ${page}. Check the nation's own website for changes.`)}`,
				'END:VCARD'
			];
			return card.map(foldLine).join('\r\n');
		})
		.join('\r\n')
		.concat('\r\n');
}
