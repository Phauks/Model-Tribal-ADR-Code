/**
 * Shared pieces for the project inbox's tests: an in-memory bucket, a
 * carrier that records what it was asked to send, the inbox's settings, and
 * the private address book's tables.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { MailCarrier } from '#lib/server/mail/carriers.ts';
import type { MailContext } from '#lib/server/mail/context.ts';
import type { OutgoingMail } from '#lib/server/mail/mime.ts';
import type { MailSettings } from '#lib/server/mail/settings.ts';
import { testDatabase } from './database.ts';

export function memoryBucket(): R2Bucket & { files: Map<string, Uint8Array>; backdate(key: string, uploaded: Date): void } {
	const files = new Map<string, Uint8Array>();
	// What each object was stored with: its custom metadata and when, for list and head.
	const details = new Map<string, { customMetadata: Record<string, string>; uploaded: Date }>();
	const unfinished = new Map<string, Map<number, Uint8Array>>();
	const multipart = (key: string, uploadId: string) => ({
		key,
		uploadId,
		async uploadPart(partNumber: number, value: Uint8Array) {
			const parts = unfinished.get(uploadId);
			if (!parts) throw new Error('No such multipart upload');
			parts.set(partNumber, new Uint8Array(value));
			return { partNumber, etag: `etag-${partNumber}` };
		},
		async complete(list: { partNumber: number; etag: string }[]) {
			const parts = unfinished.get(uploadId);
			if (!parts) throw new Error('No such multipart upload');
			const pieces = list.map((part) => parts.get(part.partNumber)!);
			const joined = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
			let offset = 0;
			for (const piece of pieces) {
				joined.set(piece, offset);
				offset += piece.length;
			}
			files.set(key, joined);
			unfinished.delete(uploadId);
		},
		async abort() {
			unfinished.delete(uploadId);
		}
	});
	const bytes = (value: unknown): Uint8Array =>
		typeof value === 'string' ? new TextEncoder().encode(value) : value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
	return {
		files,
		async put(key: string, value: unknown, options?: { customMetadata?: Record<string, string> }) {
			files.set(key, bytes(value));
			details.set(key, { customMetadata: options?.customMetadata ?? {}, uploaded: new Date() });
			return {};
		},
		async head(key: string) {
			return files.has(key) ? { key, size: files.get(key)!.byteLength, ...details.get(key) } : null;
		},
		async list(options: { prefix?: string; limit?: number } = {}) {
			const objects = [...files.keys()]
				.filter((key) => key.startsWith(options.prefix ?? ''))
				.sort()
				.slice(0, options.limit ?? 1000)
				.map((key) => ({ key, size: files.get(key)!.byteLength, ...(details.get(key) ?? { customMetadata: {}, uploaded: new Date(0) }) }));
			return { objects, truncated: false, delimitedPrefixes: [] };
		},
		/** Sets when an object was stored, for tests of things that wait. */
		backdate(key: string, uploaded: Date) {
			const found = details.get(key);
			if (found) found.uploaded = uploaded;
		},
		async get(key: string) {
			const content = files.get(key);
			if (!content) return null;
			return {
				customMetadata: details.get(key)?.customMetadata ?? {},
				arrayBuffer: async () => content.slice().buffer,
				text: async () => new TextDecoder().decode(content),
				body: new Response(content.slice()).body
			};
		},
		async delete(keys: string | string[]) {
			for (const key of Array.isArray(keys) ? keys : [keys]) files.delete(key);
		},
		// Multipart uploads, for big files sent as links: parts are kept until complete joins them.
		async createMultipartUpload(key: string) {
			const uploadId = crypto.randomUUID();
			unfinished.set(uploadId, new Map());
			return multipart(key, uploadId);
		},
		resumeMultipartUpload: (key: string, uploadId: string) => multipart(key, uploadId)
	} as unknown as R2Bucket & { files: Map<string, Uint8Array>; backdate(key: string, uploaded: Date): void };
}

export function recordingCarrier(name: 'cloudflare' | 'smtp' = 'cloudflare'): MailCarrier & { sent: OutgoingMail[]; failWith: Error | null } {
	const carrier = {
		name,
		sent: [] as OutgoingMail[],
		failWith: null as Error | null,
		async send(mail: OutgoingMail) {
			if (carrier.failWith) throw carrier.failWith;
			carrier.sent.push(mail);
			return name === 'cloudflare'
				? { messageId: `provider-${carrier.sent.length}@cloudflare.example`, providerMessageId: `provider-${carrier.sent.length}@cloudflare.example` }
				: { messageId: mail.messageId, providerMessageId: null };
		}
	};
	return carrier;
}

export function testSettings(overrides: Partial<MailSettings> = {}): MailSettings {
	return {
		domain: 'example.org',
		noticeAddress: 'lead@personal.example',
		siteAddress: 'https://example.org',
		senderName: 'Tribal Law Project',
		outreach: {
			carrier: 'smtp',
			from: 'outreach@outreach.example.org',
			replyTo: 'replies@example.org',
			host: 'smtp.example.net',
			port: 465,
			security: 'tls',
			username: 'outreach@outreach.example.org',
			password: 'not-a-real-password'
		},
		signingKey: 'test-signing-key-0123456789abcdef',
		...overrides
	};
}

/**
 * The address book's tables (migration 0012_address_book.sql), created here
 * only while that migration is not yet in this branch; once it is, the
 * migration has already made them and these statements do nothing.
 */
export function addAddressBook(database: D1Database): Promise<unknown> {
	return database.batch(
		[
			`CREATE TABLE IF NOT EXISTS contacts (identifier TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
			 organization_identifier TEXT REFERENCES contacts (identifier), nation_identifier TEXT, role TEXT, notes TEXT,
			 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT)`,
			`CREATE TABLE IF NOT EXISTS contact_methods (identifier TEXT PRIMARY KEY, contact_identifier TEXT NOT NULL REFERENCES contacts (identifier),
			 method TEXT NOT NULL, value TEXT NOT NULL, label TEXT NOT NULL, source_kind TEXT NOT NULL, source_label TEXT NOT NULL, source_link TEXT,
			 directory_name TEXT, first_recorded_on TEXT NOT NULL, verified_on TEXT NOT NULL, next_election_on TEXT,
			 status TEXT NOT NULL DEFAULT 'current', preferred INTEGER NOT NULL DEFAULT 0, note TEXT, updated_at TEXT NOT NULL, updated_by TEXT,
			 UNIQUE (contact_identifier, method, value))`,
			`CREATE TABLE IF NOT EXISTS contact_tags (contact_identifier TEXT NOT NULL REFERENCES contacts (identifier), tag TEXT NOT NULL,
			 PRIMARY KEY (contact_identifier, tag))`,
			`CREATE TABLE IF NOT EXISTS contact_changes (identifier TEXT PRIMARY KEY, contact_identifier TEXT NOT NULL REFERENCES contacts (identifier),
			 method_identifier TEXT REFERENCES contact_methods (identifier), change TEXT NOT NULL, before TEXT, person_identifier TEXT, created_at TEXT NOT NULL)`
		].map((sql) => database.prepare(sql))
	);
}

export async function addContact(
	database: D1Database,
	contact: { identifier: string; kind?: 'person' | 'organization'; name: string; nation?: string | null; role?: string | null; email: string; label?: string; tags?: string[] }
): Promise<void> {
	await database.batch([
		database
			.prepare(
				`INSERT INTO contacts (identifier, kind, name, nation_identifier, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z')`
			)
			.bind(contact.identifier, contact.kind ?? 'organization', contact.name, contact.nation ?? null, contact.role ?? null),
		database
			.prepare(
				`INSERT INTO contact_methods (identifier, contact_identifier, method, value, label, source_kind, source_label, first_recorded_on, verified_on, preferred, updated_at)
				 VALUES (?, ?, 'email', ?, ?, 'federal-directory', 'Tribal Leaders Directory', '2026-11-23', '2026-11-23', 1, '2026-11-23T00:00:00Z')`
			)
			.bind(`${contact.identifier}-email`, contact.identifier, contact.email, contact.label ?? 'general-office'),
		...(contact.tags ?? []).map((tag) => database.prepare('INSERT INTO contact_tags (contact_identifier, tag) VALUES (?, ?)').bind(contact.identifier, tag))
	]);
}

export async function testContext(at: { now: Date }, settings: MailSettings = testSettings()): Promise<MailContext & { bucket: ReturnType<typeof memoryBucket> }> {
	const database = testDatabase();
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'lead@example.org', 'Lead Author', 'lead-author', 'active', '2026-11-20T00:00:00Z')`)
		.run();
	// Two shared inboxes, contact@ (the catch-all, made by the migration) and requests@, both read by the lead author.
	await database.batch([
		database.prepare(
			`INSERT INTO mail_inboxes (identifier, local_part, name, kind, catch_all, created_at, updated_at) VALUES ('requests', 'requests', 'Requests', 'shared', 0, '2026-11-20T00:00:00Z', '2026-11-20T00:00:00Z')`
		),
		database.prepare(`INSERT INTO mail_inbox_members (inbox_identifier, person_identifier, added_at) VALUES ('contact', 'lead', '2026-11-20T00:00:00Z'), ('requests', 'lead', '2026-11-20T00:00:00Z')`)
	]);
	return { database, bucket: memoryBucket(), settings, now: () => at.now };
}

/** A plain-text message as a mail server would deliver it. */
export function rawMessage(headers: Record<string, string>, body: string): string {
	return `${Object.entries(headers)
		.map(([name, value]) => `${name}: ${value}`)
		.join('\r\n')}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body.replace(/\n/g, '\r\n')}\r\n`;
}
