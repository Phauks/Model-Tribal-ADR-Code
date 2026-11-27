/**
 * Outreach to nations from the private address book (site/MAIL.md,
 * "Outreach"): saved templates with fields such as {{nation.name}}, batches
 * that send one message to each recipient, slowly, inside working hours in
 * the recipient's own time zone, through the outreach carrier (an SMTP
 * mailbox such as Zoho Mail, because Cloudflare Email Service may not carry
 * unsolicited mail).
 *
 * Every message carries an unsubscribe link and address (RFC 8058 one-click
 * and mailto), the do-not-email list is checked when a recipient is added and
 * again just before sending, and nothing hidden tracks whether a message was
 * opened. A batch can instead ask, visibly, "let us know you got this".
 */
import { fillTemplate, missingFields, normalizeSubject, outreachText, snippetOf, unknownFields, type MergeValues } from '#lib/mail.ts';
import { freshDays, stalenessOf, type MethodLabel } from '#lib/address-book.ts';
import { actionStatement, currentTime, type MailCarriers, type MailContext } from './context.ts';
import { inboxForArrival } from './inboxes.ts';
import { newMessageIdentifier } from './mime.ts';
import { sendMessage } from './outbound.ts';
import { suppress, suppressedAmong } from './suppressions.ts';
import { makeToken, readToken } from './tokens.ts';
import { inGroupsOf, placeholdersFor } from '#lib/server/database-groups.ts';

// ---------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------

/**
 * The time zone most of each state's people live in (IANA names). A nation in
 * several states gets the first state's zone. Our own simplification: a few
 * states span two zones, and the Navajo Nation keeps daylight saving time
 * while the rest of Arizona does not; a send window of several hours absorbs
 * the difference.
 */
export const stateTimeZones: Record<string, string> = {
	AL: 'America/Chicago', AK: 'America/Anchorage', AZ: 'America/Phoenix', AR: 'America/Chicago', CA: 'America/Los_Angeles',
	CO: 'America/Denver', CT: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York', FL: 'America/New_York',
	GA: 'America/New_York', HI: 'Pacific/Honolulu', ID: 'America/Boise', IL: 'America/Chicago', IN: 'America/Indiana/Indianapolis',
	IA: 'America/Chicago', KS: 'America/Chicago', KY: 'America/New_York', LA: 'America/Chicago', ME: 'America/New_York',
	MD: 'America/New_York', MA: 'America/New_York', MI: 'America/Detroit', MN: 'America/Chicago', MS: 'America/Chicago',
	MO: 'America/Chicago', MT: 'America/Denver', NE: 'America/Chicago', NV: 'America/Los_Angeles', NH: 'America/New_York',
	NJ: 'America/New_York', NM: 'America/Denver', NY: 'America/New_York', NC: 'America/New_York', ND: 'America/Chicago',
	OH: 'America/New_York', OK: 'America/Chicago', OR: 'America/Los_Angeles', PA: 'America/New_York', RI: 'America/New_York',
	SC: 'America/New_York', SD: 'America/Chicago', TN: 'America/Chicago', TX: 'America/Chicago', UT: 'America/Denver',
	VT: 'America/New_York', VA: 'America/New_York', WA: 'America/Los_Angeles', WV: 'America/New_York', WI: 'America/Chicago',
	WY: 'America/Denver', PR: 'America/Puerto_Rico', GU: 'Pacific/Guam', VI: 'America/St_Thomas', AS: 'Pacific/Pago_Pago',
	MP: 'Pacific/Saipan'
};

export const defaultTimeZone = 'America/Denver';

export function timeZoneForStates(states: readonly string[]): string {
	for (const state of states) {
		const zone = stateTimeZones[state.toUpperCase()];
		if (zone) return zone;
	}
	return defaultTimeZone;
}

/** The hour (0 to 23) and whether it is a weekday, at a moment in a time zone. */
export function localHour(at: Date, timeZone: string): { hour: number; weekday: boolean } {
	const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(at);
	const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
	const day = parts.find((part) => part.type === 'weekday')?.value ?? 'Mon';
	return { hour, weekday: day !== 'Sat' && day !== 'Sun' };
}

export function insideWindow(at: Date, timeZone: string, batch: { window_start_hour: number; window_end_hour: number; weekdays_only: number }): boolean {
	const local = localHour(at, timeZone);
	if (batch.weekdays_only && !local.weekday) return false;
	return local.hour >= batch.window_start_hour && local.hour < batch.window_end_hour;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export interface Template {
	identifier: string;
	name: string;
	subject: string;
	body: string;
	version: number;
	archived: boolean;
	updatedAt: string;
}

export async function listTemplates(context: MailContext, includeArchived = false): Promise<Template[]> {
	const { results } = await context.database
		.prepare(
			`SELECT identifier, name, subject, body, version, archived, updated_at AS updatedAt FROM mail_templates
			 ${includeArchived ? '' : 'WHERE archived = 0'} ORDER BY name`
		)
		.all<Omit<Template, 'archived'> & { archived: number }>();
	return results.map((row) => ({ ...row, archived: row.archived === 1 }));
}

export async function templateVersions(context: MailContext, identifier: string) {
	const { results } = await context.database
		.prepare(
			`SELECT v.version, v.name, v.subject, v.body, v.saved_at AS savedAt, p.display_name AS savedBy FROM mail_template_versions v
			 LEFT JOIN people p ON p.identifier = v.saved_by WHERE v.template_identifier = ? ORDER BY v.version DESC`
		)
		.bind(identifier)
		.all<{ version: number; name: string; subject: string; body: string; savedAt: string; savedBy: string | null }>();
	return results;
}

export class OutreachError extends Error {}

/** Saves a template, as a new one or a new version of one; every version is kept. */
export async function saveTemplate(
	context: MailContext,
	personIdentifier: string,
	template: { identifier?: string | null; name: string; subject: string; body: string }
): Promise<string> {
	const unknown = unknownFields(`${template.subject}\n${template.body}`);
	if (unknown.length) throw new OutreachError(`The template uses fields the site does not know: ${unknown.map((key) => `{{${key}}}`).join(', ')}.`);
	const at = currentTime(context).toISOString();
	const database = context.database;
	let identifier = template.identifier ?? null;
	let version = 1;
	if (identifier) {
		const current = await database.prepare('SELECT version FROM mail_templates WHERE identifier = ?').bind(identifier).first<{ version: number }>();
		if (!current) throw new OutreachError('That template is gone.');
		version = current.version + 1;
	} else {
		identifier = crypto.randomUUID();
	}
	await database.batch([
		version === 1
			? database
					.prepare('INSERT INTO mail_templates (identifier, name, subject, body, version, updated_at, updated_by) VALUES (?, ?, ?, ?, 1, ?, ?)')
					.bind(identifier, template.name, template.subject, template.body, at, personIdentifier)
			: database
					.prepare('UPDATE mail_templates SET name = ?, subject = ?, body = ?, version = ?, updated_at = ?, updated_by = ? WHERE identifier = ?')
					.bind(template.name, template.subject, template.body, version, at, personIdentifier, identifier),
		database
			.prepare(
				`INSERT INTO mail_template_versions (template_identifier, version, name, subject, body, saved_at, saved_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(identifier, version, template.name, template.subject, template.body, at, personIdentifier),
		actionStatement(context, { personIdentifier, action: version === 1 ? 'Made a template' : 'Changed a template', note: `${template.name} (version ${version})` })
	]);
	return identifier;
}

export async function archiveTemplate(context: MailContext, personIdentifier: string, identifier: string, archived: boolean): Promise<void> {
	await context.database.batch([
		context.database.prepare('UPDATE mail_templates SET archived = ? WHERE identifier = ?').bind(archived ? 1 : 0, identifier),
		actionStatement(context, { personIdentifier, action: archived ? 'Archived a template' : 'Restored a template', note: identifier })
	]);
}

// ---------------------------------------------------------------------------
// Recipients from the address book
// ---------------------------------------------------------------------------

export interface AddressBookRecipient {
	contactIdentifier: string;
	name: string;
	kind: 'person' | 'organization';
	role: string | null;
	organizationName: string | null;
	nationIdentifier: string | null;
	email: string;
	label: string;
	verifiedOn: string;
	nextElectionOn: string | null;
	tags: string[];
}

export interface MailNation {
	identifier: string;
	name: string;
	states: string[];
	page: string | null;
}

/**
 * One email per contact, as the address book's mailingList does: the
 * preferred email in use, else the first in use; an address shared by two
 * contacts goes out once. Empty while the address book is not in the
 * database yet.
 */
export async function addressBookRecipients(context: MailContext): Promise<AddressBookRecipient[]> {
	try {
		const { results } = await context.database
			.prepare(
				`SELECT c.identifier AS contactIdentifier, c.name, c.kind, c.role, o.name AS organizationName,
				 COALESCE(c.nation_identifier, o.nation_identifier) AS nationIdentifier,
				 m.value AS email, m.label, m.verified_on AS verifiedOn, m.next_election_on AS nextElectionOn, m.preferred,
				 (SELECT group_concat(tag, ' ') FROM contact_tags t WHERE t.contact_identifier = c.identifier) AS tags
				 FROM contacts c JOIN contact_methods m ON m.contact_identifier = c.identifier
				 LEFT JOIN contacts o ON o.identifier = c.organization_identifier
				 WHERE m.method = 'email' AND m.status = 'current'
				 ORDER BY c.name, c.identifier, m.preferred DESC, m.first_recorded_on`
			)
			.all<Omit<AddressBookRecipient, 'tags'> & { tags: string | null; preferred: number }>();
		const seenContacts = new Set<string>();
		const seenEmails = new Set<string>();
		const list: AddressBookRecipient[] = [];
		for (const row of results) {
			if (seenContacts.has(row.contactIdentifier)) continue;
			seenContacts.add(row.contactIdentifier);
			if (seenEmails.has(row.email)) continue;
			seenEmails.add(row.email);
			const { preferred: _preferred, tags, ...rest } = row;
			list.push({ ...rest, tags: tags ? tags.split(' ') : [] });
		}
		return list;
	} catch (problem) {
		if (/no such table/i.test(String(problem))) return [];
		throw problem;
	}
}

/** The merge fields for one recipient. */
export function fieldsFor(
	recipient: Pick<AddressBookRecipient, 'name' | 'kind' | 'role' | 'organizationName'>,
	nation: MailNation | null,
	siteAddress: string | null,
	senderName: string
): MergeValues {
	const greeting =
		recipient.kind === 'organization' ? recipient.name : recipient.role ? `${recipient.role} ${recipient.name.split(/\s+/).pop()}` : recipient.name;
	return {
		'nation.name': nation?.name ?? '',
		'contact.greeting': greeting,
		'contact.name': recipient.name,
		'contact.role': recipient.role ?? '',
		'organization.name': recipient.kind === 'organization' ? recipient.name : (recipient.organizationName ?? ''),
		'nation.page': nation?.page && siteAddress ? `${siteAddress}${nation.page}` : '',
		'sender.name': senderName
	};
}

// ---------------------------------------------------------------------------
// Batches
// ---------------------------------------------------------------------------

export interface BatchSettings {
	name: string;
	templateIdentifier: string;
	perDay: number;
	windowStartHour: number;
	windowEndHour: number;
	weekdaysOnly: boolean;
	followUpDays: number | null;
	askAcknowledgment: boolean;
	/** The subject and body as changed on the New outreach batch page, in place of the template's. */
	subject?: string;
	body?: string;
}

export async function createBatch(context: MailContext, personIdentifier: string, settings: BatchSettings): Promise<string> {
	const template = await context.database
		.prepare('SELECT subject, body, version FROM mail_templates WHERE identifier = ? AND archived = 0')
		.bind(settings.templateIdentifier)
		.first<{ subject: string; body: string; version: number }>();
	if (!template) throw new OutreachError('Choose a template.');
	if (settings.subject !== undefined) template.subject = settings.subject;
	if (settings.body !== undefined) template.body = settings.body;
	if (!template.subject.trim() || !template.body.trim()) throw new OutreachError('Write a subject and a message.');
	const unknown = unknownFields(`${template.subject}\n${template.body}`);
	if (unknown.length) throw new OutreachError(`The message uses fields the site does not know: ${unknown.map((key) => `{{${key}}}`).join(', ')}.`);
	if (settings.windowEndHour <= settings.windowStartHour) throw new OutreachError('The sending hours must end after they start.');
	const identifier = crypto.randomUUID();
	await context.database.batch([
		context.database
			.prepare(
				`INSERT INTO outreach_batches (identifier, name, template_identifier, template_version, subject, body, per_day, window_start_hour,
				 window_end_hour, weekdays_only, follow_up_days, ask_acknowledgment, created_by, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				settings.name,
				settings.templateIdentifier,
				template.version,
				template.subject,
				template.body,
				Math.min(200, Math.max(1, Math.round(settings.perDay))),
				settings.windowStartHour,
				settings.windowEndHour,
				settings.weekdaysOnly ? 1 : 0,
				settings.followUpDays,
				settings.askAcknowledgment ? 1 : 0,
				personIdentifier,
				currentTime(context).toISOString()
			),
		actionStatement(context, { personIdentifier, action: 'Made an outreach batch', batchIdentifier: identifier, note: settings.name })
	]);
	return identifier;
}

export interface NewRecipient {
	contactIdentifier: string | null;
	nationIdentifier: string | null;
	email: string;
	name: string;
	fields: MergeValues;
	timeZone: string;
}

/**
 * Adds recipients to a batch that has not finished. An address on the
 * do-not-email list, or one missing a field the template uses, is added as
 * "left out" with the reason, so the list shows why.
 */
export async function addRecipients(context: MailContext, batchIdentifier: string, recipients: NewRecipient[]): Promise<{ added: number; leftOut: number }> {
	const batch = await context.database
		.prepare(`SELECT subject, body, status FROM outreach_batches WHERE identifier = ?`)
		.bind(batchIdentifier)
		.first<{ subject: string; body: string; status: string }>();
	if (!batch || batch.status === 'done' || batch.status === 'cancelled') throw new OutreachError('This batch can no longer take recipients.');
	const suppressed = await suppressedAmong(context, recipients.map((item) => item.email));
	let added = 0;
	let leftOut = 0;
	const statements = recipients.map((recipient) => {
		const missing = missingFields(`${batch.subject}\n${batch.body}`, recipient.fields);
		const reason = suppressed.has(recipient.email.toLowerCase())
			? 'On the do-not-email list'
			: missing.length
				? `No value for ${missing.map((key) => `{{${key}}}`).join(', ')}`
				: null;
		if (reason) leftOut += 1;
		else added += 1;
		return context.database
			.prepare(
				`INSERT INTO outreach_recipients (identifier, batch_identifier, contact_identifier, nation_identifier, email, name, fields, time_zone, status, skip_reason)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (batch_identifier, email) DO NOTHING`
			)
			.bind(
				crypto.randomUUID(),
				batchIdentifier,
				recipient.contactIdentifier,
				recipient.nationIdentifier,
				recipient.email.toLowerCase(),
				recipient.name,
				JSON.stringify(recipient.fields),
				recipient.timeZone,
				reason ? 'skipped' : 'queued',
				reason
			);
	});
	for (const group of inGroupsOf(statements, 100)) await context.database.batch(group);
	return { added, leftOut };
}

export async function removeRecipient(context: MailContext, batchIdentifier: string, recipientIdentifier: string): Promise<void> {
	await context.database
		.prepare(`DELETE FROM outreach_recipients WHERE identifier = ? AND batch_identifier = ? AND status IN ('queued', 'skipped')`)
		.bind(recipientIdentifier, batchIdentifier)
		.run();
}

// ---------------------------------------------------------------------------
// Who a new batch goes to (the New outreach batch page)
// ---------------------------------------------------------------------------

export interface AudienceFilter {
	tag: string | null;
	label: string | null;
	nationsOnly: boolean;
}

export interface LeftOutGroup {
	reason: string;
	count: number;
	why: string;
	/** Where to look at them, such as the address book. */
	review: string | null;
}

export interface Audience {
	recipients: AddressBookRecipient[];
	leftOut: LeftOutGroup[];
}

function matchesFilter(contact: { tags: string[]; label: string; nationIdentifier: string | null }, filter: AudienceFilter): boolean {
	return (!filter.tag || contact.tags.includes(filter.tag)) && (!filter.label || contact.label === filter.label) && (!filter.nationsOnly || contact.nationIdentifier !== null);
}

const shortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/**
 * Who a new batch would go to from the address book, and who is left out and
 * why (design/email-inbox, mockup 3): addresses on the do-not-email list,
 * contacts whose only address bounced, addresses already in another batch
 * that is not cancelled, and addresses that may be out of date
 * (src/lib/address-book.ts, stalenessOf).
 */
export async function outreachAudience(context: MailContext, filter: AudienceFilter, today: string): Promise<Audience> {
	const everyone = (await addressBookRecipients(context)).filter((contact) => matchesFilter(contact, filter));
	const suppressed = await suppressedAmong(context, everyone.map((contact) => contact.email));
	const inBatches = new Map<string, Set<string>>();
	if (everyone.length) {
		const emails = everyone.map((contact) => contact.email.toLowerCase());
		for (const group of inGroupsOf(emails, 90)) {
			const { results } = await context.database
				.prepare(
					`SELECT r.email, b.name, b.created_at AS createdAt FROM outreach_recipients r JOIN outreach_batches b ON b.identifier = r.batch_identifier
					 WHERE b.status <> 'cancelled' AND r.status IN ('queued', 'sent', 'replied') AND r.email IN (${placeholdersFor(group)})`
				)
				.bind(...group)
				.all<{ email: string; name: string; createdAt: string }>();
			for (const row of results) {
				const label = `${row.name}, ${shortDay.format(new Date(row.createdAt))}`;
				inBatches.set(row.email, (inBatches.get(row.email) ?? new Set()).add(label));
			}
		}
	}
	const recipients: AddressBookRecipient[] = [];
	const asked: AddressBookRecipient[] = [];
	const already: AddressBookRecipient[] = [];
	const stale: AddressBookRecipient[] = [];
	for (const contact of everyone) {
		const email = contact.email.toLowerCase();
		if (suppressed.has(email)) asked.push(contact);
		else if (inBatches.has(email)) already.push(contact);
		else if (
			stalenessOf({ label: contact.label as MethodLabel, verifiedOn: contact.verifiedOn, nextElectionOn: contact.nextElectionOn, status: 'current' }, today).stale
		)
			stale.push(contact);
		else recipients.push(contact);
	}

	// Contacts with no address in use because theirs bounced.
	let bounced = 0;
	try {
		const { results } = await context.database
			.prepare(
				`SELECT c.identifier, COALESCE(c.nation_identifier, o.nation_identifier) AS nationIdentifier, m.label,
				 (SELECT group_concat(tag, ' ') FROM contact_tags t WHERE t.contact_identifier = c.identifier) AS tags
				 FROM contacts c JOIN contact_methods m ON m.contact_identifier = c.identifier
				 LEFT JOIN contacts o ON o.identifier = c.organization_identifier
				 WHERE m.method = 'email' AND m.status = 'bounced'
				 AND NOT EXISTS (SELECT 1 FROM contact_methods n WHERE n.contact_identifier = c.identifier AND n.method = 'email' AND n.status = 'current')`
			)
			.all<{ identifier: string; nationIdentifier: string | null; label: string; tags: string | null }>();
		const counted = new Set<string>();
		for (const row of results) {
			if (counted.has(row.identifier)) continue;
			if (!matchesFilter({ tags: row.tags ? row.tags.split(' ') : [], label: row.label, nationIdentifier: row.nationIdentifier }, filter)) continue;
			counted.add(row.identifier);
			bounced += 1;
		}
	} catch (problem) {
		if (!/no such table/i.test(String(problem))) throw problem;
	}

	const batchNames = [...new Set(already.flatMap((contact) => [...(inBatches.get(contact.email.toLowerCase()) ?? [])]))];
	const leftOut: LeftOutGroup[] = [
		{ reason: 'Asked not to be emailed', count: asked.length, why: 'Unsubscribed or asked in a reply. Never emailed again.', review: null },
		{ reason: 'Address bounced', count: bounced, why: 'Marked bounced in the address book', review: null },
		{ reason: 'Already in another batch', count: already.length, why: batchNames.slice(0, 3).join('; ') + (batchNames.length > 3 ? '; and others' : ''), review: null },
		{
			reason: 'Address may be out of date',
			count: stale.length,
			why: `Leader email older than ${freshDays.leader} days, or an election since.`,
			review: '/workspace/address-book'
		}
	];
	return { recipients, leftOut: leftOut.filter((group) => group.count > 0) };
}

/**
 * Sends one message, as a recipient would get it, to the person preparing the
 * batch ("Send a test to me"), through the outreach mailbox. Like a batch, it
 * goes only once outreach is set up (outreachReadiness); on a copy without the
 * outreach settings, such as one running on a computer, nothing is sent.
 */
export async function sendOutreachTest(
	context: MailContext,
	carriers: MailCarriers,
	test: { to: string; subject: string; text: string }
): Promise<void> {
	const problems = outreachReadiness(context, carriers);
	if (problems.length) throw new OutreachError(`Not ready to send: ${problems.join(' ')}`);
	const outreach = context.settings.outreach!;
	await carriers.outreach!.send({
		from: { email: outreach.from, name: context.settings.senderName },
		to: [{ email: test.to }],
		replyTo: outreach.replyTo ? { email: outreach.replyTo } : null,
		subject: `Test: ${test.subject}`,
		text: test.text,
		messageId: newMessageIdentifier(outreach.from.split('@')[1] ?? context.settings.domain ?? 'example.org'),
		date: currentTime(context)
	});
}

/** What must be set up before a batch can start, in words; empty when ready. */
export function outreachReadiness(context: MailContext, carriers: MailCarriers): string[] {
	const problems: string[] = [];
	if (!context.settings.domain) problems.push('Email is not switched on (MAIL_DOMAIN is empty).');
	if (!context.settings.outreach || !carriers.outreach) problems.push('The outreach mail service is not set up (the OUTREACH_ settings).');
	if (!context.settings.signingKey) problems.push('MAIL_SIGNING_KEY is not set, so unsubscribe links cannot be made.');
	if (!context.settings.siteAddress) problems.push('SITE_ADDRESS is not set, so links in messages cannot be made.');
	return problems;
}

export async function setBatchStatus(
	context: MailContext,
	personIdentifier: string,
	batchIdentifier: string,
	status: 'running' | 'paused' | 'cancelled'
): Promise<void> {
	const at = currentTime(context).toISOString();
	const allowed: Record<typeof status, string[]> = { running: ['draft', 'paused'], paused: ['running'], cancelled: ['draft', 'running', 'paused'] };
	const statements = [
		context.database
			.prepare(
				`UPDATE outreach_batches SET status = ?1, started_at = CASE WHEN ?1 = 'running' THEN COALESCE(started_at, ?2) ELSE started_at END,
				 finished_at = CASE WHEN ?1 = 'cancelled' THEN ?2 ELSE finished_at END
				 WHERE identifier = ?3 AND status IN (${allowed[status].map((item) => `'${item}'`).join(', ')})`
			)
			.bind(status, at, batchIdentifier),
		actionStatement(context, {
			personIdentifier,
			action: { running: 'Started an outreach batch', paused: 'Paused an outreach batch', cancelled: 'Cancelled an outreach batch' }[status],
			batchIdentifier
		})
	];
	if (status === 'cancelled') {
		statements.push(
			context.database
				.prepare(`UPDATE outreach_recipients SET status = 'skipped', skip_reason = 'The batch was cancelled' WHERE batch_identifier = ? AND status = 'queued'`)
				.bind(batchIdentifier)
		);
	}
	await context.database.batch(statements);
}

export interface BatchSummary {
	identifier: string;
	name: string;
	status: string;
	/** Where the batch shows on the Outreach page: sending, scheduled (running, but its start is still ahead), draft, paused, done or cancelled. */
	stage: BatchStage;
	perDay: number;
	windowStartHour: number;
	windowEndHour: number;
	weekdaysOnly: boolean;
	followUpDays: number | null;
	askAcknowledgment: boolean;
	subject: string;
	body: string;
	templateIdentifier: string | null;
	templateName: string | null;
	templateVersion: number | null;
	startsAt: string | null;
	replyAddress: string | null;
	audience: AudienceFilter | null;
	createdAt: string;
	updatedAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	counts: Record<string, number>;
}

export type BatchStage = 'sending' | 'scheduled' | 'draft' | 'paused' | 'done' | 'cancelled';

export async function listBatches(context: MailContext): Promise<BatchSummary[]> {
	const { results } = await context.database
		.prepare(`SELECT b.*, t.name AS template_name FROM outreach_batches b LEFT JOIN mail_templates t ON t.identifier = b.template_identifier ORDER BY COALESCE(b.updated_at, b.created_at) DESC LIMIT 200`)
		.all<BatchRow>();
	const { results: counts } = await context.database
		.prepare('SELECT batch_identifier AS batch, status, COUNT(*) AS count FROM outreach_recipients GROUP BY batch_identifier, status')
		.all<{ batch: string; status: string; count: number }>();
	const now = currentTime(context).toISOString();
	return results.map((row) => summaryOf(row, counts.filter((item) => item.batch === row.identifier), now));
}

interface BatchRow {
	identifier: string;
	name: string;
	status: string;
	per_day: number;
	window_start_hour: number;
	window_end_hour: number;
	weekdays_only: number;
	follow_up_days: number | null;
	ask_acknowledgment: number;
	subject: string;
	body: string;
	template_version: number | null;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
	created_by: string | null;
	template_identifier: string | null;
	template_name?: string | null;
	starts_at: string | null;
	reply_address: string | null;
	audience: string | null;
	updated_at: string | null;
}

/** Where a batch shows on the Outreach page, at a time given as an ISO string. */
export function stageOf(row: { status: string; starts_at: string | null }, now: string): BatchStage {
	if (row.status === 'running') return row.starts_at && row.starts_at > now ? 'scheduled' : 'sending';
	if (row.status === 'done') return 'done';
	return row.status as BatchStage;
}

function audienceOf(value: string | null): AudienceFilter | null {
	if (!value) return null;
	try {
		const parsed = JSON.parse(value) as Partial<AudienceFilter>;
		return { tag: typeof parsed.tag === 'string' ? parsed.tag : null, label: typeof parsed.label === 'string' ? parsed.label : null, nationsOnly: parsed.nationsOnly !== false };
	} catch {
		return null;
	}
}

function summaryOf(row: BatchRow, counts: { status: string; count: number }[], now: string): BatchSummary {
	return {
		identifier: row.identifier,
		name: row.name,
		status: row.status,
		stage: stageOf(row, now),
		perDay: row.per_day,
		windowStartHour: row.window_start_hour,
		windowEndHour: row.window_end_hour,
		weekdaysOnly: row.weekdays_only === 1,
		followUpDays: row.follow_up_days,
		askAcknowledgment: row.ask_acknowledgment === 1,
		subject: row.subject,
		body: row.body,
		templateIdentifier: row.template_identifier,
		templateName: row.template_name ?? null,
		templateVersion: row.template_version,
		startsAt: row.starts_at,
		replyAddress: row.reply_address,
		audience: audienceOf(row.audience),
		createdAt: row.created_at,
		updatedAt: row.updated_at ?? row.created_at,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		counts: Object.fromEntries(counts.map((item) => [item.status, item.count]))
	};
}

export async function getBatch(context: MailContext, identifier: string) {
	const row = await context.database
		.prepare('SELECT b.*, t.name AS template_name FROM outreach_batches b LEFT JOIN mail_templates t ON t.identifier = b.template_identifier WHERE b.identifier = ?')
		.bind(identifier)
		.first<BatchRow>();
	if (!row) return null;
	const { results: recipients } = await context.database
		.prepare(
			`SELECT r.identifier, r.email, r.name, r.nation_identifier AS nationIdentifier, r.time_zone AS timeZone, r.status, r.skip_reason AS skipReason,
			 r.sent_at AS sentAt, r.replied_at AS repliedAt, r.thread_identifier AS threadIdentifier, r.fields,
			 m.delivery_status AS deliveryStatus, m.acknowledged_at AS acknowledgedAt, m.error
			 FROM outreach_recipients r LEFT JOIN mail_messages m ON m.identifier = r.message_identifier
			 WHERE r.batch_identifier = ? ORDER BY COALESCE(r.replied_at, r.sent_at) IS NULL, COALESCE(r.replied_at, r.sent_at) DESC, r.status = 'skipped', r.rowid`
		)
		.bind(identifier)
		.all<{
			identifier: string;
			email: string;
			name: string;
			nationIdentifier: string | null;
			timeZone: string;
			status: string;
			skipReason: string | null;
			sentAt: string | null;
			repliedAt: string | null;
			threadIdentifier: string | null;
			fields: string;
			deliveryStatus: string | null;
			acknowledgedAt: string | null;
			error: string | null;
		}>();
	const counts = new Map<string, number>();
	for (const recipient of recipients) counts.set(recipient.status, (counts.get(recipient.status) ?? 0) + 1);
	return {
		batch: summaryOf(row, [...counts].map(([status, count]) => ({ status, count })), currentTime(context).toISOString()),
		recipients: recipients.map(({ fields, ...rest }) => ({ ...rest, fields: JSON.parse(fields) as MergeValues }))
	};
}

/** The message one recipient will get, as text, with the footer (now in #lib/mail.ts, so the page's preview uses it too). */
export { outreachText };

/**
 * Sends the next few messages of every running batch: no more than the
 * batch's daily number in any 24 hours, two a batch each run (every five
 * minutes, so at most 24 an hour), and only inside the sending hours in each
 * recipient's time zone. Run by the mail tick.
 */
export async function runOutreach(context: MailContext, carriers: MailCarriers, perRun = 2): Promise<{ sent: number; failed: number }> {
	const result = { sent: 0, failed: 0 };
	if (outreachReadiness(context, carriers).length) return result;
	const settings = context.settings;
	const outreach = settings.outreach!;
	const at = currentTime(context);
	const stamp = at.toISOString();
	const dayAgo = new Date(at.getTime() - 86_400_000).toISOString();
	// A scheduled batch waits for its start.
	const { results: batches } = await context.database
		.prepare(`SELECT * FROM outreach_batches WHERE status = 'running' AND (starts_at IS NULL OR starts_at <= ?)`)
		.bind(stamp)
		.all<BatchRow>();
	for (const batch of batches) {
		// Outreach conversations are kept in the inbox its replies come to.
		const replyTo = batch.reply_address ?? outreach.replyTo;
		const outreachInbox = await inboxForArrival(context, replyTo);
		const sentToday = await context.database
			.prepare(`SELECT COUNT(*) AS count FROM outreach_recipients WHERE batch_identifier = ? AND sent_at >= ?`)
			.bind(batch.identifier, dayAgo)
			.first<{ count: number }>();
		let room = Math.min(perRun, batch.per_day - (sentToday?.count ?? 0));
		const { results: waiting } = await context.database
			.prepare(`SELECT * FROM outreach_recipients WHERE batch_identifier = ? AND status = 'queued' ORDER BY rowid LIMIT 500`)
			.bind(batch.identifier)
			.all<{ identifier: string; email: string; name: string; nation_identifier: string | null; fields: string; time_zone: string }>();
		if (waiting.length === 0) {
			await context.database
				.prepare(`UPDATE outreach_batches SET status = 'done', finished_at = ? WHERE identifier = ? AND status = 'running'`)
				.bind(stamp, batch.identifier)
				.run();
			continue;
		}
		const suppressed = await suppressedAmong(context, waiting.map((item) => item.email));
		for (const recipient of waiting) {
			if (room <= 0) break;
			if (suppressed.has(recipient.email)) {
				await context.database
					.prepare(`UPDATE outreach_recipients SET status = 'unsubscribed', skip_reason = 'On the do-not-email list' WHERE identifier = ?`)
					.bind(recipient.identifier)
					.run();
				continue;
			}
			if (!insideWindow(at, recipient.time_zone, batch)) continue;
			room -= 1;
			const fields = JSON.parse(recipient.fields) as MergeValues;
			const messageIdentifier = crypto.randomUUID();
			const threadIdentifier = crypto.randomUUID();
			const unsubscribe = await makeToken(settings.signingKey!, 'unsubscribe', recipient.identifier);
			const acknowledge = batch.ask_acknowledgment ? await makeToken(settings.signingKey!, 'acknowledge', messageIdentifier) : null;
			const unsubscribeLink = `${settings.siteAddress}/mail/unsubscribe/${unsubscribe}`;
			const unsubscribeAddress = `unsubscribe+${unsubscribe}@${settings.domain}`;
			const subject = fillTemplate(batch.subject, fields).trim();
			const text = outreachText(batch.body, fields, {
				unsubscribeLink,
				unsubscribeAddress,
				acknowledgeLink: acknowledge ? `${settings.siteAddress}/mail/got-it/${acknowledge}` : null
			});
			const followUp = batch.follow_up_days ? new Date(at.getTime() + batch.follow_up_days * 86_400_000).toISOString() : null;
			await context.database.batch([
				context.database
					.prepare(
						`INSERT INTO mail_threads (identifier, subject, normalized_subject, folder, unread, project_address, counterpart_address, counterpart_name,
						 nation_identifier, message_count, last_message_at, remind_at, remind_set_at, created_at, updated_at, inbox_identifier)
						 VALUES (?1, ?2, ?3, 'archive', 0, ?4, ?5, ?6, ?7, 0, ?8, ?9, CASE WHEN ?9 IS NULL THEN NULL ELSE ?8 END, ?8, ?8, ?10)`
					)
					.bind(
						threadIdentifier,
						subject,
						normalizeSubject(subject),
						replyTo ?? outreach.from,
						recipient.email,
						recipient.name,
						recipient.nation_identifier,
						stamp,
						followUp,
						outreachInbox?.identifier ?? null
					),
				context.database
					.prepare(
						`INSERT INTO mail_messages (identifier, thread_identifier, direction, status, from_address, to_list, subject, text_body, snippet, sent_by,
						 scheduled_for, carrier, outreach_recipient_identifier, created_at)
						 VALUES (?, ?, 'out', 'scheduled', ?, ?, ?, ?, ?, ?, ?, 'smtp', ?, ?)`
					)
					.bind(
						messageIdentifier,
						threadIdentifier,
						outreach.from.toLowerCase(),
						JSON.stringify([{ email: recipient.email, name: recipient.name }]),
						subject,
						text,
						snippetOf(text),
						batch.created_by,
						stamp,
						recipient.identifier,
						stamp
					),
				context.database
					.prepare(`UPDATE outreach_recipients SET message_identifier = ?, thread_identifier = ? WHERE identifier = ?`)
					.bind(messageIdentifier, threadIdentifier, recipient.identifier)
			]);
			const outcome = await sendMessage(context, carriers, messageIdentifier, {
				fromName: settings.senderName,
				replyTo,
				headers: {
					'List-Unsubscribe': `<${unsubscribeLink}/one-click>, <mailto:${unsubscribeAddress}?subject=unsubscribe>`,
					'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
				}
			});
			await context.database
				.prepare(`UPDATE outreach_recipients SET status = ?, sent_at = ?, skip_reason = ? WHERE identifier = ?`)
				.bind(outcome.sent ? 'sent' : 'failed', outcome.sent ? stamp : null, outcome.error ?? null, recipient.identifier)
				.run();
			if (outcome.sent) result.sent += 1;
			else result.failed += 1;
		}
	}
	return result;
}

/** Puts a failed recipient back in the queue, removing the unsent message's conversation. */
export async function retryRecipient(context: MailContext, batchIdentifier: string, recipientIdentifier: string): Promise<void> {
	const row = await context.database
		.prepare(`SELECT thread_identifier AS thread FROM outreach_recipients WHERE identifier = ? AND batch_identifier = ? AND status = 'failed'`)
		.bind(recipientIdentifier, batchIdentifier)
		.first<{ thread: string | null }>();
	if (!row) return;
	await context.database.batch([
		context.database
			.prepare(`UPDATE outreach_recipients SET status = 'queued', skip_reason = NULL, message_identifier = NULL, thread_identifier = NULL WHERE identifier = ?`)
			.bind(recipientIdentifier),
		...(row.thread
			? [
					context.database.prepare('DELETE FROM mail_search WHERE thread_identifier = ?').bind(row.thread),
					context.database.prepare('DELETE FROM mail_threads WHERE identifier = ?').bind(row.thread)
				]
			: [])
	]);
}

/**
 * Puts the address an unsubscribe token names on the do-not-email list.
 * Returns the address, or null for a token that is not valid.
 */
export async function unsubscribeWithToken(context: MailContext, token: string, source: string): Promise<string | null> {
	if (!context.settings.signingKey) return null;
	const recipient = await readToken(context.settings.signingKey, 'unsubscribe', token);
	if (!recipient) return null;
	const row = await context.database.prepare('SELECT email FROM outreach_recipients WHERE identifier = ?').bind(recipient).first<{ email: string }>();
	if (!row) return null;
	await suppress(context, row.email, 'unsubscribed', { source });
	return row.email;
}

// ---------------------------------------------------------------------------
// The Outreach page's views, drafts and schedule (site/MAIL.md, "Outreach")
// ---------------------------------------------------------------------------

/** The numbers beside the Outreach page's views, counted as the inbox counts its own: what is under way or waits for someone. */
export async function outreachCounts(context: MailContext): Promise<{ all: number; sending: number; scheduled: number; drafts: number; replies: number; followUp: number; doNotEmail: number }> {
	const now = currentTime(context).toISOString();
	const batches = await context.database
		.prepare(
			`SELECT COUNT(*) AS all_count,
			 SUM(status = 'running' AND (starts_at IS NULL OR starts_at <= ?1)) AS sending,
			 SUM(status = 'running' AND starts_at > ?1) AS scheduled,
			 SUM(status = 'draft') AS drafts
			 FROM outreach_batches WHERE status <> 'cancelled'`
		)
		.bind(now)
		.first<{ all_count: number; sending: number | null; scheduled: number | null; drafts: number | null }>();
	const replies = await context.database
		.prepare(`SELECT COUNT(DISTINCT t.identifier) AS count FROM outreach_recipients r JOIN mail_threads t ON t.identifier = r.thread_identifier WHERE r.status = 'replied' AND t.unread = 1`)
		.first<{ count: number }>();
	const followUp = await context.database.prepare(`SELECT COUNT(*) AS count FROM (${followUpDueQuery})`).bind(now).first<{ count: number }>();
	const doNotEmail = await context.database.prepare('SELECT COUNT(*) AS count FROM mail_suppressions').first<{ count: number }>();
	return {
		all: batches?.all_count ?? 0,
		sending: batches?.sending ?? 0,
		scheduled: batches?.scheduled ?? 0,
		drafts: batches?.drafts ?? 0,
		replies: replies?.count ?? 0,
		followUp: followUp?.count ?? 0,
		doNotEmail: doNotEmail?.count ?? 0
	};
}

/** Sent letters with no reply whose batch's follow-up time has passed. ?1 is now, as an ISO string. */
const followUpDueQuery = `SELECT r.identifier FROM outreach_recipients r JOIN outreach_batches b ON b.identifier = r.batch_identifier
	WHERE r.status = 'sent' AND b.follow_up_days IS NOT NULL AND r.sent_at IS NOT NULL
	AND datetime(r.sent_at, '+' || b.follow_up_days || ' days') <= datetime(?1)`;

export interface OutreachConversation {
	threadIdentifier: string;
	batchIdentifier: string;
	batchName: string;
	name: string;
	email: string;
	nationIdentifier: string | null;
	subject: string;
	snippet: string | null;
	unread: boolean;
	/** When they replied, or when the letter went. */
	at: string;
}

/** The conversations of outreach letters that were answered ("replies"), or that wait for a follow-up ("follow"), newest first. */
export async function outreachConversations(context: MailContext, kind: 'replies' | 'follow', search: string | null = null): Promise<OutreachConversation[]> {
	const now = currentTime(context).toISOString();
	const words = search ? `%${search.replace(/[%_\\]/g, (character) => `\\${character}`)}%` : null;
	const where =
		kind === 'replies'
			? `r.status = 'replied'`
			: `r.identifier IN (${followUpDueQuery})`;
	const { results } = await context.database
		.prepare(
			`SELECT t.identifier AS threadIdentifier, b.identifier AS batchIdentifier, b.name AS batchName, r.name, r.email, r.nation_identifier AS nationIdentifier,
			 t.subject, (SELECT snippet FROM mail_messages m WHERE m.thread_identifier = t.identifier ORDER BY m.created_at DESC LIMIT 1) AS snippet,
			 t.unread, COALESCE(r.replied_at, r.sent_at, t.last_message_at) AS at
			 FROM outreach_recipients r JOIN outreach_batches b ON b.identifier = r.batch_identifier JOIN mail_threads t ON t.identifier = r.thread_identifier
			 WHERE ${where} ${words ? `AND (t.subject LIKE ?2 ESCAPE '\\' OR r.name LIKE ?2 ESCAPE '\\' OR r.email LIKE ?2 ESCAPE '\\' OR b.name LIKE ?2 ESCAPE '\\')` : ''}
			 ORDER BY at DESC LIMIT 200`
		)
		.bind(...[now, ...(words ? [words] : [])])
		.all<Omit<OutreachConversation, 'unread'> & { unread: number }>();
	return results.map((row) => ({ ...row, unread: row.unread === 1 }));
}

export interface BatchDraft {
	/** The draft being continued, or null for a new one. */
	identifier: string | null;
	name: string;
	templateIdentifier: string | null;
	subject: string;
	body: string;
	perDay: number;
	windowStartHour: number;
	windowEndHour: number;
	weekdaysOnly: boolean;
	followUpDays: number | null;
	askAcknowledgment: boolean;
	startsAt: string | null;
	replyAddress: string | null;
	audience: AudienceFilter;
}

const clampWhole = (value: number, low: number, high: number, fallback: number) =>
	Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : fallback;

/**
 * Saves a batch being written on the New batch page, as the inbox saves a
 * message being written: a new draft the first time, the same one after.
 * Only a batch that has not started can be saved this way. Returns its
 * identifier and when it was saved.
 */
export async function saveBatchDraft(context: MailContext, personIdentifier: string, draft: BatchDraft): Promise<{ identifier: string; updatedAt: string }> {
	const at = currentTime(context).toISOString();
	const start = clampWhole(draft.windowStartHour, 0, 23, 9);
	const end = Math.max(start + 1, clampWhole(draft.windowEndHour, 1, 24, 15));
	let template: { identifier: string; version: number } | null = null;
	if (draft.templateIdentifier) {
		template = await context.database
			.prepare('SELECT identifier, version FROM mail_templates WHERE identifier = ?')
			.bind(draft.templateIdentifier)
			.first<{ identifier: string; version: number }>();
	}
	const values = [
		draft.name.slice(0, 120),
		template?.identifier ?? null,
		template?.version ?? null,
		draft.subject.slice(0, 300),
		draft.body.slice(0, 20_000),
		clampWhole(draft.perDay, 1, 200, 40),
		start,
		Math.min(24, end),
		draft.weekdaysOnly ? 1 : 0,
		draft.followUpDays === null ? null : clampWhole(draft.followUpDays, 1, 90, 10),
		draft.askAcknowledgment ? 1 : 0,
		draft.startsAt,
		draft.replyAddress,
		JSON.stringify(draft.audience),
		at
	];
	if (draft.identifier) {
		const changed = await context.database
			.prepare(
				`UPDATE outreach_batches SET name = ?1, template_identifier = ?2, template_version = ?3, subject = ?4, body = ?5, per_day = ?6, window_start_hour = ?7,
				 window_end_hour = ?8, weekdays_only = ?9, follow_up_days = ?10, ask_acknowledgment = ?11, starts_at = ?12, reply_address = ?13, audience = ?14, updated_at = ?15
				 WHERE identifier = ?16 AND status = 'draft'`
			)
			.bind(...values, draft.identifier)
			.run();
		if (changed.meta.changes) return { identifier: draft.identifier, updatedAt: at };
	}
	const identifier = crypto.randomUUID();
	await context.database
		.prepare(
			`INSERT INTO outreach_batches (name, template_identifier, template_version, subject, body, per_day, window_start_hour, window_end_hour, weekdays_only,
			 follow_up_days, ask_acknowledgment, starts_at, reply_address, audience, updated_at, identifier, status, created_by, created_at)
			 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 'draft', ?17, ?15)`
		)
		.bind(...values, identifier, personIdentifier)
		.run();
	return { identifier, updatedAt: at };
}

/** Throws away a batch that never started, with any recipients it had. */
export async function discardBatchDraft(context: MailContext, personIdentifier: string, identifier: string): Promise<boolean> {
	const row = await context.database.prepare(`SELECT name FROM outreach_batches WHERE identifier = ? AND status = 'draft'`).bind(identifier).first<{ name: string }>();
	if (!row) return false;
	await context.database.batch([
		context.database.prepare(`DELETE FROM outreach_batches WHERE identifier = ? AND status = 'draft'`).bind(identifier),
		actionStatement(context, { personIdentifier, action: 'Discarded an outreach batch', batchIdentifier: identifier, note: row.name })
	]);
	return true;
}

/**
 * Starts a draft or paused batch, at once or at a time given as an ISO
 * string, or moves a scheduled batch's start to now ("Start now").
 */
export async function startBatch(context: MailContext, personIdentifier: string, identifier: string, startsAt: string | null): Promise<void> {
	const at = currentTime(context).toISOString();
	const later = startsAt && startsAt > at ? startsAt : null;
	const batch = await context.database.prepare('SELECT subject, body FROM outreach_batches WHERE identifier = ?').bind(identifier).first<{ subject: string; body: string }>();
	if (!batch) throw new OutreachError('No such batch.');
	if (!batch.subject.trim() || !batch.body.trim()) throw new OutreachError('Write a subject and a message first.');
	const unknown = unknownFields(`${batch.subject}\n${batch.body}`);
	if (unknown.length) throw new OutreachError(`The message uses fields the site does not know: ${unknown.map((key) => `{{${key}}}`).join(', ')}.`);
	const result = await context.database
		.prepare(
			`UPDATE outreach_batches SET status = 'running', starts_at = ?1, started_at = COALESCE(started_at, ?2), updated_at = ?2
			 WHERE identifier = ?3 AND status IN ('draft', 'paused', 'running')`
		)
		.bind(later, at, identifier)
		.run();
	if (!result.meta.changes) throw new OutreachError('This batch can no longer be started.');
	await actionStatement(context, { personIdentifier, action: later ? 'Scheduled an outreach batch' : 'Started an outreach batch', batchIdentifier: identifier }).run();
}

/** A new draft with the same message, pace and audience as another batch, and no recipients yet. */
export async function copyBatch(context: MailContext, personIdentifier: string, identifier: string): Promise<string> {
	const found = await getBatch(context, identifier);
	if (!found) throw new OutreachError('No such batch.');
	const batch = found.batch;
	const copy = await saveBatchDraft(context, personIdentifier, {
		identifier: null,
		name: `${batch.name} (copy)`,
		templateIdentifier: batch.templateIdentifier,
		subject: batch.subject,
		body: batch.body,
		perDay: batch.perDay,
		windowStartHour: batch.windowStartHour,
		windowEndHour: batch.windowEndHour,
		weekdaysOnly: batch.weekdaysOnly,
		followUpDays: batch.followUpDays,
		askAcknowledgment: batch.askAcknowledgment,
		startsAt: null,
		replyAddress: batch.replyAddress,
		audience: batch.audience ?? { tag: null, label: null, nationsOnly: true }
	});
	return copy.identifier;
}

/**
 * About when a sending batch's next letter goes: the next five-minute run
 * inside the sending hours of the first waiting recipient's time zone. It is
 * a guide for the list, not a promise: the daily limit can hold it back.
 */
export function nextSendAt(batch: { windowStartHour: number; windowEndHour: number; weekdaysOnly: boolean; startsAt: string | null }, timeZone: string, now: Date): Date | null {
	const window = { window_start_hour: batch.windowStartHour, window_end_hour: batch.windowEndHour, weekdays_only: batch.weekdaysOnly ? 1 : 0 };
	let at = new Date(Math.max(now.getTime(), batch.startsAt ? new Date(batch.startsAt).getTime() : 0));
	at = new Date(Math.ceil(at.getTime() / 300_000) * 300_000);
	for (let step = 0; step < 8 * 24 * 12; step += 1) {
		if (insideWindow(at, timeZone, window)) return at;
		at = new Date(at.getTime() + 300_000);
	}
	return null;
}

/** Gives a batch a new name. */
export async function renameBatch(context: MailContext, personIdentifier: string, identifier: string, name: string): Promise<void> {
	await context.database.batch([
		context.database.prepare('UPDATE outreach_batches SET name = ?, updated_at = ? WHERE identifier = ?').bind(name.slice(0, 120), currentTime(context).toISOString(), identifier),
		actionStatement(context, { personIdentifier, action: 'Renamed an outreach batch', batchIdentifier: identifier, note: name.slice(0, 120) })
	]);
}
