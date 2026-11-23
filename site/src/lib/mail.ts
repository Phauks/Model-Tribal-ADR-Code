/**
 * Names, labels and small pure functions for the project inbox, shared by
 * the server and the workspace pages (site/MAIL.md).
 */

export const folders = ['inbox', 'archive', 'spam', 'trash'] as const;
export type Folder = (typeof folders)[number];

/** The views the inbox's left column offers. Folders, then views over their columns. */
export const inboxViews = [
	{ key: 'inbox', label: 'Inbox' },
	{ key: 'mine', label: 'Assigned to me' },
	{ key: 'follow-up', label: 'Follow up due' },
	{ key: 'snoozed', label: 'Snoozed' },
	{ key: 'scheduled', label: 'Scheduled' },
	{ key: 'sent', label: 'Sent' },
	{ key: 'archive', label: 'Archive' },
	{ key: 'spam', label: 'Spam' },
	{ key: 'trash', label: 'Deleted' }
] as const;
export type InboxView = (typeof inboxViews)[number]['key'];

export function isInboxView(value: string | null): value is InboxView {
	return inboxViews.some((view) => view.key === value);
}

/** Label colors map to design tokens in the pages' styles, never to raw colors. */
export const labelColors = ['teal', 'orange', 'gray', 'gold', 'green', 'purple'] as const;
export type LabelColor = (typeof labelColors)[number];

export const deliveryLabels: Record<string, string> = {
	delivered: 'Delivered to their mail server',
	deferred: 'Delayed; the sending service is retrying',
	bounced: 'Bounced',
	failed: 'Could not be sent',
	rejected: 'Not sent: the address is on the do-not-email list',
	complained: 'Marked as spam by the recipient'
};

export const messageStatusLabels: Record<string, string> = {
	received: 'Received',
	draft: 'Draft',
	scheduled: 'Scheduled',
	sending: 'Sending',
	sent: 'Sent',
	failed: 'Failed',
	cancelled: 'Cancelled'
};

export const batchStatusLabels: Record<string, string> = {
	draft: 'Not started',
	running: 'Sending',
	paused: 'Paused',
	done: 'Finished',
	cancelled: 'Cancelled'
};

export const recipientStatusLabels: Record<string, string> = {
	queued: 'Waiting',
	sent: 'Sent',
	skipped: 'Left out',
	failed: 'Failed',
	replied: 'Replied',
	unsubscribed: 'Asked not to be emailed',
	bounced: 'Bounced'
};

export interface MailAddress {
	email: string;
	name?: string | null;
}

/** An email address in lower case without spaces, or null if it does not look like one. */
export function cleanAddress(value: string): string | null {
	const trimmed = value.trim().replace(/^.*<([^>]+)>.*$/, '$1').trim().toLowerCase();
	return /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/.test(trimmed) ? trimmed : null;
}

/** Addresses typed into a To or Cc box, separated by commas, semicolons or new lines. */
export function parseAddressList(value: string): { addresses: MailAddress[]; invalid: string[] } {
	const addresses: MailAddress[] = [];
	const invalid: string[] = [];
	for (const part of value.split(/[,;\n]+/)) {
		const text = part.trim();
		if (!text) continue;
		const email = cleanAddress(text);
		if (!email) {
			invalid.push(text);
			continue;
		}
		const name = text.includes('<') ? text.slice(0, text.indexOf('<')).trim().replace(/^"|"$/g, '') : '';
		if (!addresses.some((address) => address.email === email)) addresses.push({ email, name: name || null });
	}
	return { addresses, invalid };
}

/** An address as a header shows it: "Name <email>", or the email alone. */
export function formatAddress(address: MailAddress): string {
	return address.name ? `${address.name} <${address.email}>` : address.email;
}

/** A subject without any number of "Re:", "Fwd:" and similar prefixes, in lower case, for threading. */
export function normalizeSubject(subject: string): string {
	let current = subject.trim();
	for (;;) {
		const next = current.replace(/^(re|fw|fwd|aw|sv|antw)\s*(\[\d+\])?\s*:\s*/i, '').replace(/^\[[^\]]{1,40}\]\s*/, '');
		if (next === current) break;
		current = next;
	}
	return current.replace(/\s+/g, ' ').toLowerCase();
}

/** The subject for a reply: "Re: " once, never "Re: Re: ". */
export function replySubject(subject: string): string {
	return /^re\s*:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
}

/** The first words of a message, for the list's preview line. */
export function snippetOf(text: string, length = 160): string {
	const flat = text
		.split('\n')
		.filter((line) => !line.trimStart().startsWith('>'))
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
	return flat.length > length ? `${flat.slice(0, length - 1).trimEnd()}…` : flat;
}

/** A Message-ID or a list of them, without angle brackets. */
export function messageIds(header: string | null | undefined): string[] {
	if (!header) return [];
	const found = header.match(/<[^<>\s]+>/g);
	if (found) return found.map((id) => id.slice(1, -1));
	return header
		.split(/\s+/)
		.map((id) => id.trim())
		.filter((id) => id.includes('@'));
}

// ---------------------------------------------------------------------------
// Times typed in a time zone
// ---------------------------------------------------------------------------

/** The offset of a time zone from UTC at a moment, in minutes (UTC minus 7 hours is -420). */
export function zoneOffsetMinutes(at: Date, timeZone: string): number {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hourCycle: 'h23',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	}).formatToParts(at);
	const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
	const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
	return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * The moment a date and time typed into a datetime-local box ("2026-11-24T09:30")
 * means in a time zone, as an ISO string in UTC, or null when it is not one.
 */
export function zonedTimeToUtc(local: string, timeZone: string): string | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local.trim());
	if (!match) return null;
	const [year, month, day, hour, minute] = match.slice(1).map(Number);
	const wall = Date.UTC(year, month - 1, day, hour, minute);
	let guess = wall;
	try {
		// Twice, so a time near a daylight saving change settles on the right offset.
		for (let step = 0; step < 2; step += 1) guess = wall - zoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
	} catch {
		return null;
	}
	return new Date(guess).toISOString();
}

// ---------------------------------------------------------------------------
// Templates and merge fields
// ---------------------------------------------------------------------------

/** The fields a template may use, with what each holds. */
export const mergeFields = [
	{ key: 'nation.name', label: 'The nation’s name as the site shows it' },
	{ key: 'contact.greeting', label: 'Who the letter is addressed to, such as “Tribal Secretary’s Office” or “Chairman Begay”' },
	{ key: 'contact.name', label: 'The contact’s name in the address book' },
	{ key: 'contact.role', label: 'The contact’s title, such as Chairman' },
	{ key: 'organization.name', label: 'The office or organization the contact belongs to' },
	{ key: 'nation.page', label: 'The address of the nation’s page on the site' },
	{ key: 'sender.name', label: 'Your name as the sender' }
] as const;
export type MergeFieldKey = (typeof mergeFields)[number]['key'];
export type MergeValues = Partial<Record<MergeFieldKey, string>>;

const fieldPattern = /\{\{\s*([a-z]+\.[a-z]+)\s*\}\}/g;

/** Fields a template uses that the site does not know. */
export function unknownFields(template: string): string[] {
	const known = new Set<string>(mergeFields.map((field) => field.key));
	return [...new Set([...template.matchAll(fieldPattern)].map((match) => match[1]))].filter((key) => !known.has(key));
}

/** Fields a template uses that have no value for this recipient. */
export function missingFields(template: string, values: MergeValues): string[] {
	return [...new Set([...template.matchAll(fieldPattern)].map((match) => match[1]))].filter(
		(key) => !values[key as MergeFieldKey]?.trim()
	);
}

/** The template with each field filled in. Fields without a value are left empty. */
export function fillTemplate(template: string, values: MergeValues): string {
	return template.replace(fieldPattern, (_whole, key: string) => values[key as MergeFieldKey]?.trim() ?? '');
}

// ---------------------------------------------------------------------------
// Plain text to simple HTML, for the HTML part of messages written here
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}

/**
 * Simple HTML for a message written as plain text: paragraphs at blank
 * lines, line breaks kept, and web addresses made into links. Nothing else,
 * so the HTML part never says more than the text part.
 */
export function textToHtml(text: string): string {
	const paragraphs = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
	const body = paragraphs
		.map((paragraph) => {
			const html = escapeHtml(paragraph).replace(
				/https:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g,
				(link) => `<a href="${link}">${link}</a>`
			);
			return `<p>${html.replace(/\n/g, '<br>')}</p>`;
		})
		.join('\n');
	return `<!doctype html><html><body style="font-family: sans-serif; font-size: 16px; line-height: 1.5">\n${body}\n</body></html>`;
}

/** Quoted text for a reply: "On <date>, <name> wrote:" and each line marked with ">". */
export function quoteForReply(text: string, from: string, date: string): string {
	const when = new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
	const quoted = text
		.trimEnd()
		.split('\n')
		.map((line) => `> ${line}`)
		.join('\n');
	return `\n\nOn ${when} UTC, ${from} wrote:\n${quoted}\n`;
}

// ---------------------------------------------------------------------------
// Replies that ask not to be written to again
// ---------------------------------------------------------------------------

/**
 * Whether a reply's own words (not the quoted message) ask the project to
 * stop writing: "stop", "unsubscribe", "remove me" and the like as the
 * whole of the first line. The inbox flags it for a person to confirm; it
 * never decides alone.
 */
export function asksToStop(text: string): boolean {
	const firstLine =
		text
			.split('\n')
			.map((line) => line.trim())
			.find((line) => line !== '') ?? '';
	return /^(stop|unsubscribe|remove me|remove|please remove me|do not (e-?mail|contact) (me|us)( again)?|please stop)[.!]?$/i.test(
		firstLine
	);
}
