/**
 * The project's private address book (migrations/0012_address_book.sql),
 * read and changed on the workspace's Address book page by the lead author
 * only, and read by other server code that sends mail (mailingList).
 *
 * Every change is saved together with a row in contact_changes that keeps the
 * row as it was, in one D1 batch, so a change is never saved without its
 * record.
 *
 * A refresh reads the two directories the nation contacts were drawn from,
 * the Bureau of Indian Affairs Tribal Leaders Directory and the State of
 * Alaska's list of federally recognized tribes. For each email read from one
 * of them it checks whether the directory still lists it: if so it counts as
 * verified that day; if not it is marked replaced, and the directory's new
 * address is added to the same contact. Emails read on a nation's own website
 * cannot be checked this way; the page lets the lead author mark them
 * verified by hand.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import {
	cleanEmail,
	cleanPhone,
	cleanTag,
	type Contact,
	type ContactKind,
	type ContactMethod,
	type ContactMethodKind,
	type MethodLabel,
	type MethodStatus,
	type SourceKind
} from '#lib/address-book.ts';
import { differences, type BookOfficeMethod, type PublicNationContacts } from '#lib/address-book-sync.ts';
import { newIdentifier, now } from './identifiers.ts';
import { inGroupsOf } from '#lib/server/database-groups.ts';

export const federalDirectoryLink =
	'https://services1.arcgis.com/UxqqIfhng71wUT9x/arcgis/rest/services/TribalLeadership_Directory/FeatureServer/0';
export const alaskaDirectoryLink =
	'https://maps.commerce.alaska.gov/server/rest/services/Contacts/CDO_Contacts_Federally_Recognized_Tribes/MapServer/0';

interface ContactRecord {
	identifier: string;
	kind: ContactKind;
	name: string;
	organization_identifier: string | null;
	nation_identifier: string | null;
	role: string | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
	updated_by: string | null;
}

interface MethodRecord {
	identifier: string;
	contact_identifier: string;
	method: ContactMethodKind;
	value: string;
	label: MethodLabel;
	source_kind: SourceKind;
	source_label: string;
	source_link: string | null;
	directory_name: string | null;
	first_recorded_on: string;
	verified_on: string;
	next_election_on: string | null;
	status: MethodStatus;
	preferred: number;
	note: string | null;
	updated_at: string;
	updated_by: string | null;
}

function contactFrom(record: ContactRecord): Contact {
	return {
		identifier: record.identifier,
		kind: record.kind,
		name: record.name,
		organizationIdentifier: record.organization_identifier,
		nationIdentifier: record.nation_identifier,
		role: record.role,
		notes: record.notes,
		createdAt: record.created_at,
		updatedAt: record.updated_at,
		updatedBy: record.updated_by
	};
}

function methodFrom(record: MethodRecord): ContactMethod {
	return {
		identifier: record.identifier,
		contactIdentifier: record.contact_identifier,
		method: record.method,
		value: record.value,
		label: record.label,
		sourceKind: record.source_kind,
		sourceLabel: record.source_label,
		sourceLink: record.source_link,
		directoryName: record.directory_name,
		firstRecordedOn: record.first_recorded_on,
		verifiedOn: record.verified_on,
		nextElectionOn: record.next_election_on,
		status: record.status,
		preferred: record.preferred === 1,
		note: record.note,
		updatedAt: record.updated_at,
		updatedBy: record.updated_by
	};
}

export interface ContactEntry extends Contact {
	methods: ContactMethod[];
	tags: string[];
}

/** Every contact with its emails, phones and tags, by name. */
export async function listContacts(database: D1Database): Promise<ContactEntry[]> {
	const [contacts, methods, tags] = await Promise.all([
		database.prepare('SELECT * FROM contacts ORDER BY name COLLATE NOCASE, identifier').all<ContactRecord>(),
		database.prepare('SELECT * FROM contact_methods ORDER BY preferred DESC, method, value').all<MethodRecord>(),
		database
			.prepare('SELECT contact_identifier, tag FROM contact_tags ORDER BY tag')
			.all<{ contact_identifier: string; tag: string }>()
	]);
	const byContact = new Map<string, ContactEntry>();
	for (const record of contacts.results)
		byContact.set(record.identifier, {
			...contactFrom(record),
			methods: [],
			tags: []
		});
	for (const record of methods.results) byContact.get(record.contact_identifier)?.methods.push(methodFrom(record));
	for (const record of tags.results) byContact.get(record.contact_identifier)?.tags.push(record.tag);
	return [...byContact.values()];
}

/** Every contact's name, kind, role and organization, by name, without emails, phones or tags: what a contact's page needs to name the others. */
export async function contactNames(
	database: D1Database
): Promise<Pick<Contact, 'identifier' | 'kind' | 'name' | 'role' | 'organizationIdentifier'>[]> {
	const { results } = await database
		.prepare(
			`SELECT identifier, kind, name, role, organization_identifier AS organizationIdentifier
			 FROM contacts ORDER BY name COLLATE NOCASE, identifier`
		)
		.all<Pick<Contact, 'identifier' | 'kind' | 'name' | 'role' | 'organizationIdentifier'>>();
	return results;
}

export async function contactEntry(database: D1Database, identifier: string): Promise<ContactEntry | null> {
	const record = await database
		.prepare('SELECT * FROM contacts WHERE identifier = ?')
		.bind(identifier)
		.first<ContactRecord>();
	if (!record) return null;
	const [methods, tags] = await Promise.all([
		database
			.prepare(
				'SELECT * FROM contact_methods WHERE contact_identifier = ? ORDER BY method, preferred DESC, status, value'
			)
			.bind(identifier)
			.all<MethodRecord>(),
		database
			.prepare('SELECT tag FROM contact_tags WHERE contact_identifier = ? ORDER BY tag')
			.bind(identifier)
			.all<{ tag: string }>()
	]);
	return {
		...contactFrom(record),
		methods: methods.results.map(methodFrom),
		tags: tags.results.map((row) => row.tag)
	};
}

export async function contactMethod(database: D1Database, identifier: string): Promise<ContactMethod | null> {
	const record = await database
		.prepare('SELECT * FROM contact_methods WHERE identifier = ?')
		.bind(identifier)
		.first<MethodRecord>();
	return record ? methodFrom(record) : null;
}

export interface ContactChange {
	identifier: string;
	methodIdentifier: string | null;
	change: string;
	before: string | null;
	personName: string | null;
	createdAt: string;
}

export async function contactChanges(database: D1Database, contactIdentifier: string): Promise<ContactChange[]> {
	const { results } = await database
		.prepare(
			`SELECT changes.identifier, changes.method_identifier, changes.change, changes.before, people.display_name AS name, changes.created_at
			 FROM contact_changes AS changes
			 LEFT JOIN people ON people.identifier = changes.person_identifier
			 WHERE changes.contact_identifier = ?
			 ORDER BY changes.created_at DESC, changes.rowid DESC`
		)
		.bind(contactIdentifier)
		.all<{
			identifier: string;
			method_identifier: string | null;
			change: string;
			before: string | null;
			name: string | null;
			created_at: string;
		}>();
	return results.map((row) => ({
		identifier: row.identifier,
		methodIdentifier: row.method_identifier,
		change: row.change,
		before: row.before,
		personName: row.name,
		createdAt: row.created_at
	}));
}

function changeStatement(
	database: D1Database,
	contactIdentifier: string,
	methodIdentifier: string | null,
	change: string,
	before: object | null,
	personIdentifier: string | null
): D1PreparedStatement {
	return database
		.prepare(
			`INSERT INTO contact_changes (identifier, contact_identifier, method_identifier, change, before, person_identifier, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(
			newIdentifier(),
			contactIdentifier,
			methodIdentifier,
			change,
			before ? JSON.stringify(before) : null,
			personIdentifier,
			now()
		);
}

export type Result = { ok: true; identifier: string } | { ok: false; problem: string };

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface NewContact {
	kind: ContactKind;
	name: string;
	organizationIdentifier?: string | null;
	nationIdentifier?: string | null;
	role?: string | null;
	notes?: string | null;
	tags?: string[];
}

const nationIdentifierShape = /^[a-z0-9][a-z0-9-]{0,200}$/;

function checkContact(input: Partial<NewContact>): string | null {
	if (input.name !== undefined && (input.name.trim() === '' || input.name.length > 300))
		return 'Give a name of up to 300 characters.';
	if (input.nationIdentifier && !nationIdentifierShape.test(input.nationIdentifier)) return 'That is not a nation id.';
	return null;
}

export async function addContact(
	database: D1Database,
	input: NewContact,
	personIdentifier: string | null
): Promise<Result> {
	const problem = checkContact(input);
	if (problem) return { ok: false, problem };
	if (input.organizationIdentifier) {
		const organization = await database
			.prepare("SELECT identifier FROM contacts WHERE identifier = ? AND kind = 'organization'")
			.bind(input.organizationIdentifier)
			.first();
		if (!organization)
			return {
				ok: false,
				problem: 'Choose an organization from the address book.'
			};
	}
	const identifier = newIdentifier();
	const time = now();
	const statements = [
		database
			.prepare(
				`INSERT INTO contacts (identifier, kind, name, organization_identifier, nation_identifier, role, notes, created_at, updated_at, updated_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				input.kind,
				input.name.trim(),
				input.organizationIdentifier ?? null,
				input.nationIdentifier || null,
				input.role?.trim() || null,
				input.notes?.trim() || null,
				time,
				time,
				personIdentifier
			),
		changeStatement(database, identifier, null, 'Added', null, personIdentifier),
		...tagStatements(database, identifier, input.tags ?? [])
	];
	await database.batch(statements);
	return { ok: true, identifier };
}

function tagStatements(database: D1Database, contactIdentifier: string, tags: string[]): D1PreparedStatement[] {
	const clean = [...new Set(tags.map(cleanTag).filter((tag): tag is string => tag !== null))];
	return clean.map((tag) =>
		database
			.prepare('INSERT OR IGNORE INTO contact_tags (contact_identifier, tag) VALUES (?, ?)')
			.bind(contactIdentifier, tag)
	);
}

export interface ContactEdit {
	name?: string;
	organizationIdentifier?: string | null;
	nationIdentifier?: string | null;
	role?: string | null;
	notes?: string | null;
	tags?: string[];
}

export async function editContact(
	database: D1Database,
	identifier: string,
	edit: ContactEdit,
	personIdentifier: string | null
): Promise<Result> {
	const before = await contactEntry(database, identifier);
	if (!before) return { ok: false, problem: 'That contact is not in the address book.' };
	const problem = checkContact(edit);
	if (problem) return { ok: false, problem };
	if (edit.organizationIdentifier === identifier) return { ok: false, problem: 'A contact cannot belong to itself.' };
	const statements: D1PreparedStatement[] = [
		database
			.prepare(
				`UPDATE contacts SET name = ?, organization_identifier = ?, nation_identifier = ?, role = ?, notes = ?, updated_at = ?, updated_by = ?
				 WHERE identifier = ?`
			)
			.bind(
				edit.name?.trim() ?? before.name,
				edit.organizationIdentifier !== undefined ? edit.organizationIdentifier : before.organizationIdentifier,
				edit.nationIdentifier !== undefined ? edit.nationIdentifier || null : before.nationIdentifier,
				edit.role !== undefined ? edit.role?.trim() || null : before.role,
				edit.notes !== undefined ? edit.notes?.trim() || null : before.notes,
				now(),
				personIdentifier,
				identifier
			),
		changeStatement(database, identifier, null, 'Edited', { ...before, methods: undefined }, personIdentifier)
	];
	if (edit.tags) {
		statements.push(database.prepare('DELETE FROM contact_tags WHERE contact_identifier = ?').bind(identifier));
		statements.push(...tagStatements(database, identifier, edit.tags));
	}
	await database.batch(statements);
	return { ok: true, identifier };
}

// ---------------------------------------------------------------------------
// Emails and phones
// ---------------------------------------------------------------------------

export interface NewContactMethod {
	method: ContactMethodKind;
	value: string;
	label: MethodLabel;
	sourceKind: SourceKind;
	sourceLabel: string;
	sourceLink?: string | null;
	directoryName?: string | null;
	firstRecordedOn?: string;
	verifiedOn: string;
	nextElectionOn?: string | null;
	status?: MethodStatus;
	preferred?: boolean;
	note?: string | null;
}

function cleanValue(method: ContactMethodKind, value: string): string | null {
	return method === 'email' ? cleanEmail(value) : cleanPhone(value);
}

function clearPreferred(
	database: D1Database,
	contactIdentifier: string,
	method: ContactMethodKind
): D1PreparedStatement {
	return database
		.prepare('UPDATE contact_methods SET preferred = 0 WHERE contact_identifier = ? AND method = ? AND preferred = 1')
		.bind(contactIdentifier, method);
}

function insertMethod(
	database: D1Database,
	contactIdentifier: string,
	input: NewContactMethod & { value: string },
	personIdentifier: string | null,
	change: string
): { identifier: string; statements: D1PreparedStatement[] } {
	const identifier = newIdentifier();
	const statements: D1PreparedStatement[] = [];
	if (input.preferred) statements.push(clearPreferred(database, contactIdentifier, input.method));
	statements.push(
		database
			.prepare(
				`INSERT INTO contact_methods (identifier, contact_identifier, method, value, label, source_kind, source_label, source_link,
					directory_name, first_recorded_on, verified_on, next_election_on, status, preferred, note, updated_at, updated_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				contactIdentifier,
				input.method,
				input.value,
				input.label,
				input.sourceKind,
				input.sourceLabel,
				input.sourceLink ?? null,
				input.directoryName ?? null,
				input.firstRecordedOn ?? input.verifiedOn,
				input.verifiedOn,
				input.nextElectionOn ?? null,
				input.status ?? 'current',
				input.preferred ? 1 : 0,
				input.note ?? null,
				now(),
				personIdentifier
			),
		changeStatement(database, contactIdentifier, identifier, change, null, personIdentifier)
	);
	return { identifier, statements };
}

export async function addContactMethod(
	database: D1Database,
	contactIdentifier: string,
	input: NewContactMethod,
	personIdentifier: string | null
): Promise<Result> {
	const value = cleanValue(input.method, input.value);
	if (!value)
		return {
			ok: false,
			problem: input.method === 'email' ? 'That is not an email address.' : 'That is not a phone number.'
		};
	if (input.sourceLabel.trim() === '') return { ok: false, problem: 'Say where this was found.' };
	const contact = await database
		.prepare('SELECT identifier FROM contacts WHERE identifier = ?')
		.bind(contactIdentifier)
		.first();
	if (!contact) return { ok: false, problem: 'That contact is not in the address book.' };
	const clash = await database
		.prepare('SELECT identifier FROM contact_methods WHERE contact_identifier = ? AND method = ? AND value = ?')
		.bind(contactIdentifier, input.method, value)
		.first();
	if (clash) return { ok: false, problem: 'This contact already has that.' };
	const { identifier, statements } = insertMethod(
		database,
		contactIdentifier,
		{ ...input, value },
		personIdentifier,
		'Added'
	);
	await database.batch(statements);
	return { ok: true, identifier };
}

export interface MethodEdit {
	value?: string;
	label?: MethodLabel;
	sourceKind?: SourceKind;
	sourceLabel?: string;
	sourceLink?: string | null;
	verifiedOn?: string;
	nextElectionOn?: string | null;
	status?: MethodStatus;
	preferred?: boolean;
	note?: string | null;
}

const methodColumns: Record<keyof MethodEdit, string> = {
	value: 'value',
	label: 'label',
	sourceKind: 'source_kind',
	sourceLabel: 'source_label',
	sourceLink: 'source_link',
	verifiedOn: 'verified_on',
	nextElectionOn: 'next_election_on',
	status: 'status',
	preferred: 'preferred',
	note: 'note'
};

function methodEditStatements(
	database: D1Database,
	before: ContactMethod,
	edit: MethodEdit,
	change: string,
	personIdentifier: string | null
): D1PreparedStatement[] {
	const names = (Object.keys(edit) as (keyof MethodEdit)[]).filter((name) => edit[name] !== undefined);
	const values = names.map((name) => (name === 'preferred' ? (edit.preferred ? 1 : 0) : (edit[name] ?? null)));
	const statements: D1PreparedStatement[] = [];
	if (edit.preferred) statements.push(clearPreferred(database, before.contactIdentifier, before.method));
	const assignments = [...names.map((name) => `${methodColumns[name]} = ?`), 'updated_at = ?', 'updated_by = ?'].join(
		', '
	);
	statements.push(
		database
			.prepare(`UPDATE contact_methods SET ${assignments} WHERE identifier = ?`)
			.bind(...values, now(), personIdentifier, before.identifier),
		changeStatement(database, before.contactIdentifier, before.identifier, change, before, personIdentifier)
	);
	return statements;
}

/**
 * Changes an email or phone and records what it was. Used by the Address
 * book page, and by mail code to mark a hard bounce (status 'bounced').
 * Retiring an address is not an unsubscribe: the inbox keeps those itself.
 */
export async function editContactMethod(
	database: D1Database,
	identifier: string,
	edit: MethodEdit,
	change: string,
	personIdentifier: string | null
): Promise<Result> {
	const before = await contactMethod(database, identifier);
	if (!before)
		return {
			ok: false,
			problem: 'That email or phone is not in the address book.'
		};
	if (edit.value !== undefined) {
		const value = cleanValue(before.method, edit.value);
		if (!value)
			return {
				ok: false,
				problem: before.method === 'email' ? 'That is not an email address.' : 'That is not a phone number.'
			};
		if (value !== before.value) {
			const clash = await database
				.prepare('SELECT identifier FROM contact_methods WHERE contact_identifier = ? AND method = ? AND value = ?')
				.bind(before.contactIdentifier, before.method, value)
				.first();
			if (clash) return { ok: false, problem: 'This contact already has that.' };
		}
		edit = { ...edit, value };
	}
	if (edit.sourceLabel !== undefined && edit.sourceLabel.trim() === '')
		return { ok: false, problem: 'Say where this was found.' };
	await database.batch(methodEditStatements(database, before, edit, change, personIdentifier));
	return { ok: true, identifier };
}

// ---------------------------------------------------------------------------
// Refresh from the directories
// ---------------------------------------------------------------------------

/** One nation's entry in a directory: the emails it lists and who they reach. */
export interface DirectoryEntry {
	name: string;
	emails: string[];
	holderName: string | null;
	holderTitle: string | null;
	nextElectionOn: string | null;
}

type Fetcher = (input: string) => Promise<Response>;

export function splitEmails(text: string | null | undefined): string[] {
	return [
		...new Set(
			(text ?? '')
				.split(/[;,\s]+/)
				.map((part) => cleanEmail(part))
				.filter((part): part is string => part !== null)
		)
	];
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** The federal Tribal Leaders Directory, by the nation's name in it. */
export async function readFederalDirectory(fetcher: Fetcher): Promise<Map<string, DirectoryEntry>> {
	const query = new URLSearchParams({
		where: '1=1',
		outFields: 'tribefullname,salutation,firstname,lastname,suffix,jobtitle,email,nextelection',
		returnGeometry: 'false',
		resultRecordCount: '2000',
		f: 'json'
	});
	const response = await fetcher(`${federalDirectoryLink}/query?${query}`);
	if (!response.ok) throw new Error(`The federal directory answered ${response.status}.`);
	const body = (await response.json()) as {
		features?: { attributes: Record<string, string | null> }[];
	};
	if (!body.features) throw new Error('The federal directory sent no rows.');
	const entries = new Map<string, DirectoryEntry>();
	for (const { attributes } of body.features) {
		const name = attributes.tribefullname?.trim();
		if (!name || entries.has(name)) continue;
		const holder = [attributes.salutation, attributes.firstname, attributes.lastname, attributes.suffix]
			.filter(Boolean)
			.join(' ');
		const election = attributes.nextelection?.trim() ?? '';
		entries.set(name, {
			name,
			emails: splitEmails(attributes.email),
			holderName: holder || null,
			holderTitle: attributes.jobtitle?.trim() || null,
			nextElectionOn: isoDate.test(election) ? election : null
		});
	}
	return entries;
}

/** The State of Alaska's list of federally recognized tribes, by the tribe's name in it. */
export async function readAlaskaDirectory(fetcher: Fetcher): Promise<Map<string, DirectoryEntry>> {
	const query = new URLSearchParams({
		where: '1=1',
		outFields: 'EntityName,Email',
		returnGeometry: 'false',
		f: 'json'
	});
	const response = await fetcher(`${alaskaDirectoryLink}/query?${query}`);
	if (!response.ok) throw new Error(`The Alaska directory answered ${response.status}.`);
	const body = (await response.json()) as {
		features?: { attributes: Record<string, string | null> }[];
	};
	if (!body.features) throw new Error('The Alaska directory sent no rows.');
	const entries = new Map<string, DirectoryEntry>();
	for (const { attributes } of body.features) {
		const name = attributes.EntityName?.trim();
		if (!name || entries.has(name)) continue;
		entries.set(name, {
			name,
			emails: splitEmails(attributes.Email),
			holderName: null,
			holderTitle: null,
			nextElectionOn: null
		});
	}
	return entries;
}

export interface RefreshSummary {
	checked: number;
	verified: number;
	replaced: number;
	added: number;
	notListed: number;
}

/**
 * Checks every email in use that came from a directory against that directory
 * today: one it still lists is verified; one it no longer lists is marked
 * replaced, and the directory's new emails for that entry are added to the
 * same contact. A person contact whose leader changed keeps its name; the
 * note on the new email names the new holder, for the lead author to sort out.
 */
export async function refreshFromDirectories(
	database: D1Database,
	fetcher: Fetcher,
	personIdentifier: string | null,
	day: string
): Promise<RefreshSummary> {
	const { results } = await database
		.prepare(
			`SELECT * FROM contact_methods
			 WHERE method = 'email' AND status = 'current' AND directory_name IS NOT NULL
			   AND source_kind IN ('federal-directory', 'alaska-directory')`
		)
		.all<MethodRecord>();
	const rows = results.map(methodFrom);
	const summary: RefreshSummary = {
		checked: rows.length,
		verified: 0,
		replaced: 0,
		added: 0,
		notListed: 0
	};
	if (rows.length === 0) return summary;
	const directories: Partial<Record<SourceKind, Map<string, DirectoryEntry>>> = {};
	if (rows.some((row) => row.sourceKind === 'federal-directory'))
		directories['federal-directory'] = await readFederalDirectory(fetcher);
	if (rows.some((row) => row.sourceKind === 'alaska-directory'))
		directories['alaska-directory'] = await readAlaskaDirectory(fetcher);

	const { results: everyEmail } = await database
		.prepare("SELECT contact_identifier, value FROM contact_methods WHERE method = 'email'")
		.all<{ contact_identifier: string; value: string }>();
	const known = new Set(everyEmail.map((row) => `${row.contact_identifier} ${row.value}`));
	const statements: D1PreparedStatement[] = [];
	for (const row of rows) {
		const entry = directories[row.sourceKind]?.get(row.directoryName ?? '');
		if (!entry) {
			summary.notListed += 1;
			continue;
		}
		if (entry.emails.includes(row.value)) {
			const edit: MethodEdit = { verifiedOn: day };
			if (row.sourceKind === 'federal-directory' && entry.nextElectionOn !== row.nextElectionOn)
				edit.nextElectionOn = entry.nextElectionOn;
			statements.push(...methodEditStatements(database, row, edit, 'Verified at source', personIdentifier));
			summary.verified += 1;
			continue;
		}
		statements.push(
			...methodEditStatements(
				database,
				row,
				{
					status: 'replaced',
					preferred: false,
					note: [row.note, `Not listed in the directory on ${day}.`].filter(Boolean).join(' ')
				},
				'Replaced at source',
				personIdentifier
			)
		);
		summary.replaced += 1;
		for (const email of entry.emails) {
			if (known.has(`${row.contactIdentifier} ${email}`)) continue;
			known.add(`${row.contactIdentifier} ${email}`);
			const holder = [entry.holderTitle, entry.holderName].filter(Boolean).join(': ');
			statements.push(
				...insertMethod(
					database,
					row.contactIdentifier,
					{
						method: 'email',
						value: email,
						label: row.label,
						sourceKind: row.sourceKind,
						sourceLabel: row.sourceLabel,
						sourceLink: row.sourceLink,
						directoryName: row.directoryName,
						verifiedOn: day,
						nextElectionOn: row.sourceKind === 'federal-directory' ? entry.nextElectionOn : null,
						preferred: row.preferred,
						note: holder ? `The directory now lists this for ${holder}.` : null
					},
					personIdentifier,
					'Found at source by a refresh'
				).statements
			);
			summary.added += 1;
		}
	}
	// Send the changes in groups, well under D1's limit on statements in one batch.
	for (const group of inGroupsOf(statements, 90)) {
		await database.batch(group);
	}
	return summary;
}

// ---------------------------------------------------------------------------
// For sending mail
// ---------------------------------------------------------------------------

export interface MailingRecipient {
	contactIdentifier: string;
	name: string;
	role: string | null;
	organizationName: string | null;
	nationIdentifier: string | null;
	email: string;
	label: MethodLabel;
	verifiedOn: string;
}

/**
 * One email per contact for a mailing: its preferred email in use, else its
 * first one in use. Contacts with no email in use are left out, and an
 * address goes out once even when two contacts share it (a nation's office
 * and its leader often do). Unsubscribes are not known here; the mail code
 * removes them.
 */
export function mailingList(contacts: ContactEntry[]): MailingRecipient[] {
	const names = new Map(contacts.map((contact) => [contact.identifier, contact.name]));
	const recipients: MailingRecipient[] = [];
	const used = new Set<string>();
	for (const contact of contacts) {
		const emails = contact.methods.filter((method) => method.method === 'email' && method.status === 'current');
		const chosen = emails.find((method) => method.preferred) ?? emails[0];
		if (!chosen || used.has(chosen.value)) continue;
		used.add(chosen.value);
		recipients.push({
			contactIdentifier: contact.identifier,
			name: contact.name,
			role: contact.role,
			organizationName: contact.organizationIdentifier ? (names.get(contact.organizationIdentifier) ?? null) : null,
			nationIdentifier: contact.nationIdentifier,
			email: chosen.value,
			label: chosen.label,
			verifiedOn: chosen.verifiedOn
		});
	}
	return recipients;
}

// ---------------------------------------------------------------------------
// Keeping in step with the nation pages (src/lib/address-book-sync.ts)
// ---------------------------------------------------------------------------

/** Every office email and phone in the book that belongs to a nation, in use or not. */
export async function bookOfficeMethods(database: D1Database): Promise<BookOfficeMethod[]> {
	const { results } = await database
		.prepare(
			`SELECT methods.method, methods.value, methods.status, methods.note, methods.source_label, methods.source_link,
			        contacts.nation_identifier
			 FROM contact_methods AS methods
			 JOIN contacts ON contacts.identifier = methods.contact_identifier
			 WHERE methods.label = 'general-office' AND contacts.nation_identifier IS NOT NULL`
		)
		.all<{
			method: ContactMethodKind;
			value: string;
			status: MethodStatus;
			note: string | null;
			source_label: string;
			source_link: string | null;
			nation_identifier: string;
		}>();
	return results.map((row) => ({
		method: row.method,
		value: row.value,
		status: row.status,
		note: row.note,
		sourceLabel: row.source_label,
		sourceLink: row.source_link,
		nationIdentifier: row.nation_identifier
	}));
}

/** The nation's government in the address book, added when it is not there yet. */
async function nationGovernment(
	database: D1Database,
	nationIdentifier: string,
	name: string,
	personIdentifier: string | null
): Promise<string> {
	const found = await database
		.prepare(
			`SELECT contacts.identifier FROM contacts
			 JOIN contact_tags ON contact_tags.contact_identifier = contacts.identifier AND contact_tags.tag = 'nation-government'
			 WHERE contacts.nation_identifier = ? AND contacts.kind = 'organization'
			 ORDER BY contacts.created_at LIMIT 1`
		)
		.bind(nationIdentifier)
		.first<{ identifier: string }>();
	if (found) return found.identifier;
	const added = await addContact(
		database,
		{ kind: 'organization', name, nationIdentifier, role: 'Government', tags: ['nation-government'] },
		personIdentifier
	);
	if (!added.ok) throw new Error(added.problem);
	return added.identifier;
}

/**
 * Adds to the address book every office email and phone a nation page shows
 * that the book does not hold at all, on the nation's government contact,
 * with the page's source and the date the profile gives for it. An address
 * the book holds but marks out of use is left alone: that is a difference for
 * the lead author to settle, usually by correcting the page.
 */
export async function bringInPageContacts(
	database: D1Database,
	pages: PublicNationContacts[],
	personIdentifier: string | null,
	day: string
): Promise<number> {
	const missing = differences(pages, await bookOfficeMethods(database)).filter((found) => found.kind === 'page-only');
	const byNation = new Map(pages.map((page) => [page.identifier, page]));
	let added = 0;
	for (const found of missing) {
		const page = byNation.get(found.nationIdentifier);
		const contact = page?.contacts.find((item) => item.method === found.method && item.value === found.value);
		if (!page || !contact) continue;
		const government = await nationGovernment(database, page.identifier, page.name, personIdentifier);
		const result = await addContactMethod(
			database,
			government,
			{
				method: contact.method,
				value: contact.value,
				label: 'general-office',
				sourceKind: contact.sourceKind,
				sourceLabel: contact.sourceTitle || 'Nation page',
				sourceLink: contact.sourceLink,
				directoryName: contact.directoryName,
				verifiedOn: contact.asOf && /^\d{4}-\d{2}-\d{2}$/.test(contact.asOf) ? contact.asOf : day,
				note: 'Brought in from the nation page.'
			},
			personIdentifier
		);
		// A phone written differently from one the contact already has is refused as a duplicate; that is fine.
		if (result.ok) added += 1;
	}
	return added;
}

export interface WeeklySummary extends RefreshSummary {
	broughtIn: number;
}

/**
 * The weekly run: check the directories, then bring in what the nation pages
 * show and the book lacks. Run every Monday by the site's scheduled job
 * (src/routes/address-book/scheduled) and by the Address book page's "Check now".
 */
export async function weeklyAddressBookRun(
	database: D1Database,
	fetcher: Fetcher,
	pages: PublicNationContacts[],
	personIdentifier: string | null,
	day: string
): Promise<WeeklySummary> {
	const summary = await refreshFromDirectories(database, fetcher, personIdentifier, day);
	return { ...summary, broughtIn: await bringInPageContacts(database, pages, personIdentifier, day) };
}
