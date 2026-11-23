/**
 * Exporting mail from the project inbox (site/MAIL.md, "Blocking,
 * unsubscribing and exporting"): one message as an .eml file, which any mail
 * program opens, or a whole conversation as an .mbox file, which mail
 * programs import.
 *
 * The file is the copy of the message the inbox kept as it arrived or as it
 * was sent, with its attachments inside. So a received message can be
 * exported only once every attachment in it has passed the virus check
 * (site/SCANNING.md); a message the project sent is the project's own.
 */
import { fileScans, mayServe } from '#lib/server/file-scans.ts';
import type { MailContext } from './context.ts';

export type MessageCopy =
	| { state: 'ready'; bytes: Uint8Array<ArrayBuffer>; filename: string; subject: string; from: string; at: string }
	| { state: 'held'; files: string[] }
	| { state: 'missing' };

/** A file name from a subject and date: "2026-11-24 A question about the code.eml". */
export function exportName(subject: string, at: string, extension: 'eml' | 'mbox'): string {
	const words = subject
		.normalize('NFC')
		.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 80);
	return `${at.slice(0, 10)} ${words || 'message'}.${extension}`;
}

/** The kept copy of one message, or why it cannot be handed out. */
export async function messageCopy(context: MailContext, messageIdentifier: string): Promise<MessageCopy> {
	const row = await context.database
		.prepare(
			`SELECT identifier, direction, raw_key, subject, from_address, COALESCE(received_at, sent_at, created_at) AS at FROM mail_messages
			 WHERE identifier = ? AND status IN ('received', 'sent')`
		)
		.bind(messageIdentifier)
		.first<{ identifier: string; direction: 'in' | 'out'; raw_key: string | null; subject: string; from_address: string; at: string }>();
	if (!row?.raw_key) return { state: 'missing' };
	if (row.direction === 'in') {
		// Every attachment inside a received message must have passed the virus check before the whole message is handed out.
		const { results: files } = await context.database
			.prepare('SELECT filename, bucket_key FROM mail_attachments WHERE message_identifier = ?')
			.bind(row.identifier)
			.all<{ filename: string; bucket_key: string }>();
		const scans = await fileScans(context.database, files.map((file) => file.bucket_key));
		const held = files.filter((file) => !mayServe(scans.get(file.bucket_key) ?? null)).map((file) => file.filename);
		if (held.length) return { state: 'held', files: held };
	}
	const object = await context.bucket.get(row.raw_key);
	if (!object) return { state: 'missing' };
	return {
		state: 'ready',
		bytes: new Uint8Array(await object.arrayBuffer()),
		filename: exportName(row.subject, row.at, 'eml'),
		subject: row.subject,
		from: row.from_address,
		at: row.at
	};
}

/** The asctime-style date an mbox "From " line carries: "Tue Nov 24 17:00:00 2026". */
function mboxDate(at: string): string {
	const date = new Date(at);
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const pad = (value: number) => String(value).padStart(2, '0');
	return `${days[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, ' ')} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} ${date.getUTCFullYear()}`;
}

/**
 * Messages joined into one mbox file (the "mboxrd" form, RFC 4155): each
 * starts with a "From " line, and a line inside a message that starts with
 * "From " (after any ">") gets one more ">", so it is not read as a new
 * message.
 */
export function toMbox(messages: { bytes: Uint8Array; from: string; at: string }[]): Uint8Array<ArrayBuffer> {
	const encoder = new TextEncoder();
	const gt = Uint8Array.of(0x3e);
	const newline = Uint8Array.of(0x0a);
	const from = [0x46, 0x72, 0x6f, 0x6d, 0x20]; // "From "
	// Pieces of the messages themselves, not copies, so a large message is not held twice.
	const pieces: Uint8Array[] = [];
	for (const message of messages) {
		pieces.push(encoder.encode(`From ${message.from.replace(/\s/g, '') || 'unknown'} ${mboxDate(message.at)}\n`));
		const bytes = message.bytes;
		let start = 0;
		for (let index = 0; index <= bytes.length; index += 1) {
			if (index < bytes.length && bytes[index] !== 0x0a) continue;
			// One line, from start to index (the LF), without a CR before the LF.
			const end = index > start && bytes[index - 1] === 0x0d ? index - 1 : index;
			let look = start;
			while (look < end && bytes[look] === 0x3e) look += 1;
			if (from.every((value, offset) => bytes[look + offset] === value)) pieces.push(gt);
			if (end > start) pieces.push(bytes.subarray(start, end));
			if (index < bytes.length) pieces.push(newline);
			start = index + 1;
		}
		if (bytes.length === 0 || bytes[bytes.length - 1] !== 0x0a) pieces.push(newline);
		pieces.push(newline);
	}
	const joined = new Uint8Array(pieces.reduce((total, piece) => total + piece.length, 0));
	let at = 0;
	for (const piece of pieces) {
		joined.set(piece, at);
		at += piece.length;
	}
	return joined;
}

/** A whole conversation as one mbox file, oldest message first. */
export async function conversationExport(
	context: MailContext,
	threadIdentifier: string
): Promise<{ state: 'ready'; bytes: Uint8Array<ArrayBuffer>; filename: string; count: number } | { state: 'held'; files: string[] } | { state: 'missing' }> {
	const thread = await context.database.prepare('SELECT subject FROM mail_threads WHERE identifier = ?').bind(threadIdentifier).first<{ subject: string }>();
	if (!thread) return { state: 'missing' };
	const { results } = await context.database
		.prepare(
			`SELECT identifier FROM mail_messages WHERE thread_identifier = ? AND status IN ('received', 'sent') AND raw_key IS NOT NULL
			 ORDER BY COALESCE(received_at, sent_at, created_at)`
		)
		.bind(threadIdentifier)
		.all<{ identifier: string }>();
	const copies = [];
	const held: string[] = [];
	for (const { identifier } of results) {
		const copy = await messageCopy(context, identifier);
		if (copy.state === 'ready') copies.push(copy);
		else if (copy.state === 'held') held.push(...copy.files);
	}
	if (held.length) return { state: 'held', files: held };
	if (copies.length === 0) return { state: 'missing' };
	return { state: 'ready', bytes: toMbox(copies), filename: exportName(thread.subject, copies[0].at, 'mbox'), count: copies.length };
}
