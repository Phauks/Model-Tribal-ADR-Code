/**
 * The project's private address book (migrations/0012_address_book.sql): people
 * and organizations, linked to a Native nation where they belong to one, with
 * their emails and phones. This file holds the labels and the rule for when an
 * email or phone is out of date; the database work is in
 * src/lib/server/address-book.ts. Only the lead author sees any of it.
 */

export const contactKinds = ['person', 'organization'] as const;
export type ContactKind = (typeof contactKinds)[number];

export const contactKindLabels: Record<ContactKind, string> = {
	person: 'Person',
	organization: 'Organization'
};

export const contactMethods = ['email', 'phone'] as const;
export type ContactMethodKind = (typeof contactMethods)[number];

export const methodLabels = ['general-office', 'leader', 'state-listed', 'work', 'personal', 'other'] as const;
export type MethodLabel = (typeof methodLabels)[number];

export const methodLabelNames: Record<MethodLabel, string> = {
	'general-office': 'General office',
	leader: 'Leader',
	'state-listed': 'Listed by a state',
	work: 'Work',
	personal: 'Personal',
	other: 'Other'
};

export const sourceKinds = [
	'nation-website',
	'federal-directory',
	'alaska-directory',
	'state-directory',
	'told-us',
	'other'
] as const;
export type SourceKind = (typeof sourceKinds)[number];

export const sourceKindNames: Record<SourceKind, string> = {
	'nation-website': "Nation's website",
	'federal-directory': 'Federal Tribal Leaders Directory',
	'alaska-directory': "State of Alaska's tribal contacts",
	'state-directory': 'State government page',
	'told-us': 'Told us directly',
	other: 'Other'
};

export const methodStatuses = ['current', 'bounced', 'replaced', 'retired'] as const;
export type MethodStatus = (typeof methodStatuses)[number];

export const methodStatusNames: Record<MethodStatus, string> = {
	current: 'In use',
	bounced: 'Mail came back',
	replaced: 'Replaced at source',
	retired: 'Retired'
};

export interface Contact {
	identifier: string;
	kind: ContactKind;
	name: string;
	organizationIdentifier: string | null;
	nationIdentifier: string | null;
	role: string | null;
	notes: string | null;
	createdAt: string;
	updatedAt: string;
	updatedBy: string | null;
}

export interface ContactMethod {
	identifier: string;
	contactIdentifier: string;
	method: ContactMethodKind;
	value: string;
	label: MethodLabel;
	sourceKind: SourceKind;
	sourceLabel: string;
	sourceLink: string | null;
	directoryName: string | null;
	firstRecordedOn: string;
	verifiedOn: string;
	nextElectionOn: string | null;
	status: MethodStatus;
	preferred: boolean;
	note: string | null;
	updatedAt: string;
	updatedBy: string | null;
}

/**
 * How many days an email or phone stays trusted after it was last seen at its
 * source. Leaders change with elections and appointments, so their addresses
 * are checked twice a year; an office address changes less often.
 */
export const freshDays: Record<MethodLabel, number> = {
	'general-office': 365,
	leader: 180,
	'state-listed': 180,
	work: 365,
	personal: 365,
	other: 365
};

export interface Staleness {
	stale: boolean;
	reasons: string[];
}

function daysBetween(earlier: string, later: string): number {
	return Math.floor((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86_400_000);
}

export function shortDate(value: string): string {
	return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
		dateStyle: 'medium',
		timeZone: 'UTC'
	});
}

/**
 * Whether an email or phone in use needs checking again, and why: it was last
 * seen at its source longer ago than its label allows, or the nation's
 * election has passed since then. Ones not in use are never stale.
 */
export function stalenessOf(
	method: Pick<ContactMethod, 'label' | 'verifiedOn' | 'nextElectionOn' | 'status'>,
	today: string
): Staleness {
	const reasons: string[] = [];
	if (method.status !== 'current') return { stale: false, reasons };
	const age = daysBetween(method.verifiedOn, today);
	if (age > freshDays[method.label]) {
		reasons.push(`Last checked ${age} days ago; this kind is checked every ${freshDays[method.label]} days.`);
	}
	if (method.nextElectionOn && method.nextElectionOn <= today && method.verifiedOn < method.nextElectionOn) {
		reasons.push(`The nation's election on ${shortDate(method.nextElectionOn)} came after the last check.`);
	}
	return { stale: reasons.length > 0, reasons };
}

/** Today's date in UTC, as YYYY-MM-DD. */
export function today(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

/** A cleaned email address, or null when the text is not one. */
export function cleanEmail(text: string): string | null {
	const value = text
		.normalize('NFC')
		.trim()
		.toLowerCase()
		.replace(/^mailto:/, '');
	return /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value) ? value : null;
}

/** A phone number with at least seven digits, as written, or null. */
export function cleanPhone(text: string): string | null {
	const value = text.normalize('NFC').trim().replace(/\s+/g, ' ');
	return value.length <= 40 && (value.match(/\d/g) ?? []).length >= 7 && /^[\d\s()+.\-x]+$/i.test(value) ? value : null;
}

/** A tag in the shape the database accepts: lower case letters, digits and hyphens. */
export function cleanTag(text: string): string | null {
	const value = text
		.normalize('NFC')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return value && value.length <= 60 ? value : null;
}

/**
 * One CSV field (RFC 4180): quoted when it holds a comma, quote or line break.
 * A field that a spreadsheet would read as a formula gets a leading apostrophe.
 */
export function csvText(value: string | null): string {
	let text = value ?? '';
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
