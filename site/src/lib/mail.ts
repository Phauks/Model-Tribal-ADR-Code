/**
 * Names, labels and small pure functions for the project inbox, shared by
 * the server and the workspace pages (site/MAIL.md).
 */

/** The four folders every inbox has. Folders the lead author makes are stored as 'folder' plus the folder's identifier. */
export const folders = ['inbox', 'archive', 'spam', 'trash'] as const;
export type Folder = (typeof folders)[number];
export type ThreadFolder = Folder | 'folder';

/** Folders can sit inside folders, this many deep. */
export const folderDepthLimit = 3;

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

/** Tag colors map to design tokens in the pages' styles, never to raw colors. */
export const tagColors = ['teal', 'orange', 'gray', 'gold', 'green', 'purple'] as const;
export type TagColor = (typeof tagColors)[number];

// ---------------------------------------------------------------------------
// Auto-sort rules (src/lib/server/mail/rules.ts runs them)
// ---------------------------------------------------------------------------

/** What a rule can look at in an arriving message. "kind" says whether it takes words or a yes or no. */
export const ruleFields = [
	{ key: 'from', label: 'Sender', kind: 'text' },
	{ key: 'to', label: 'Sent to (To or Cc)', kind: 'text' },
	{ key: 'subject', label: 'Subject', kind: 'text' },
	{ key: 'body', label: 'Message text', kind: 'text' },
	{ key: 'anywhere', label: 'Subject or text', kind: 'text' },
	{ key: 'attachment', label: 'Has an attachment', kind: 'yes-no' },
	{ key: 'nation', label: 'Sender is in the address book with a nation', kind: 'yes-no' },
	{ key: 'automatic', label: 'Is an automatic reply, such as out of office', kind: 'yes-no' }
] as const;
export type RuleField = (typeof ruleFields)[number]['key'];

export const ruleOperators = [
	{ key: 'contains', label: 'contains' },
	{ key: 'not-contains', label: 'does not contain' },
	{ key: 'is', label: 'is exactly' },
	{ key: 'starts-with', label: 'starts with' },
	{ key: 'ends-with', label: 'ends with' }
] as const;
export type RuleOperator = (typeof ruleOperators)[number]['key'];

export const ruleActionKinds = [
	{ key: 'move', label: 'Move to' },
	{ key: 'tag', label: 'Add the tag' },
	{ key: 'assign', label: 'Assign to' },
	{ key: 'read', label: 'Mark as read' }
] as const;
export type RuleActionKind = (typeof ruleActionKinds)[number]['key'];

export interface RuleCondition {
	field: RuleField;
	operator: RuleOperator;
	/** The words to look for; "yes" or "no" for a yes-or-no field. */
	value: string;
}

export interface RuleAction {
	action: RuleActionKind;
	/** A folder ('archive', 'trash' or a made folder's identifier), a tag, or a person; empty for "read". */
	value: string;
}

/** What a rule is checked against: one arriving message, flattened. */
export interface RuleFacts {
	/** The sender's address, and the name and "Name <address>" when there is a name, so "ends with @example.org" works. */
	from: string[];
	/** Each To and Cc address, and the project address it came to, the same way. */
	to: string[];
	subject: string;
	body: string;
	attachment: boolean;
	nation: boolean;
	automatic: boolean;
}

function textMatches(haystack: string, operator: RuleOperator, needle: string): boolean {
	const text = haystack.toLowerCase();
	const word = needle.trim().toLowerCase();
	switch (operator) {
		case 'contains':
			return text.includes(word);
		case 'not-contains':
			return !text.includes(word);
		case 'is':
			return text.trim() === word;
		case 'starts-with':
			return text.trimStart().startsWith(word);
		case 'ends-with':
			return text.trimEnd().endsWith(word);
	}
}

/** Whether one condition holds for a message. Words are matched without regard to capital letters. */
export function conditionHolds(condition: RuleCondition, facts: RuleFacts): boolean {
	switch (condition.field) {
		case 'attachment':
		case 'nation':
		case 'automatic':
			return facts[condition.field] === (condition.value === 'yes');
		case 'from':
		case 'to':
			// "does not contain" must hold for every address; the others for any one.
			return condition.operator === 'not-contains'
				? facts[condition.field].every((address) => textMatches(address, condition.operator, condition.value))
				: facts[condition.field].some((address) => textMatches(address, condition.operator, condition.value));
		case 'anywhere':
			return condition.operator === 'not-contains'
				? textMatches(facts.subject, condition.operator, condition.value) && textMatches(facts.body, condition.operator, condition.value)
				: textMatches(facts.subject, condition.operator, condition.value) || textMatches(facts.body, condition.operator, condition.value);
		case 'subject':
		case 'body':
			return textMatches(facts[condition.field], condition.operator, condition.value);
	}
}

/** Whether a rule's conditions hold: all of them, or any one. A rule with no conditions never matches. */
export function ruleMatches(rule: { matchAll: boolean; conditions: RuleCondition[] }, facts: RuleFacts): boolean {
	if (rule.conditions.length === 0) return false;
	return rule.matchAll ? rule.conditions.every((item) => conditionHolds(item, facts)) : rule.conditions.some((item) => conditionHolds(item, facts));
}

/** A condition in words, for the rules list: "Sender ends with “@navajo-nsn.gov”". */
export function describeCondition(condition: RuleCondition): string {
	const field = ruleFields.find((item) => item.key === condition.field);
	if (!field) return '';
	if (field.kind === 'yes-no') return condition.value === 'yes' ? field.label : `${field.label}: no`;
	const operator = ruleOperators.find((item) => item.key === condition.operator)?.label ?? condition.operator;
	return `${field.label} ${operator} “${condition.value}”`;
}

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
