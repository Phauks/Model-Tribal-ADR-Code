/**
 * Big files sent from the inbox as download links (site/MAIL.md, "Big files
 * as links"). A message can carry at most 18 MB of attachments, because a
 * whole message is limited to 25 MiB and attachments grow by about a third
 * when encoded for mail. A larger file is sent up to the mail bucket in
 * pieces, checked for viruses like any attachment, and the message carries
 * a link to it instead. The link works for 30 days after the message goes;
 * then the file is deleted. Nothing records who opened a link.
 */
import { readableSize } from '#lib/uploads.ts';
import { fileScans, mayServe, requestScan, stillScanning } from '#lib/server/file-scans.ts';
import { currentTime, type MailContext } from './context.ts';
import { forgetAttachmentScans } from './scans.ts';
import { makeToken } from './tokens.ts';

export class LinkedFileError extends Error {
	constructor(
		message: string,
		readonly status = 400
	) {
		super(message);
	}
}

/** Each piece but the last is this size. R2 needs every part but the last to be the same size, and at least 5 MiB. */
export const linkedPieceBytes = 10 * 1024 * 1024;
/** The largest file sent as a link: what the virus scanner takes (site/SCANNING.md). */
export const largestLinkedFileBytes = 2048 * 1024 * 1024;
/** How long a link works after its message goes. */
export const linkDays = 30;
/** How many links one message can carry. */
export const linksPerMessage = 10;

export interface LinkedFileRow {
	identifier: string;
	person_identifier: string | null;
	message_identifier: string | null;
	filename: string;
	media_type: string;
	size_bytes: number;
	bucket_key: string;
	multipart_identifier: string | null;
	status: 'sending' | 'ready';
	created_at: string;
	expires_at: string | null;
}

export function pieceCountFor(sizeBytes: number): number {
	return Math.ceil(sizeBytes / linkedPieceBytes);
}

function expectedPieceSize(sizeBytes: number, number: number): number {
	const count = pieceCountFor(sizeBytes);
	return number < count ? linkedPieceBytes : sizeBytes - linkedPieceBytes * (count - 1);
}

function cleanFilename(value: string): string {
	return value.replace(/[\r\n"\\/]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) || 'file';
}

/**
 * Starts sending a file, or picks up one this person started with the same
 * name and size: one cut off part way, or one sent up but not yet sent with
 * a message (say the form came back with a problem), which needs no pieces.
 */
export async function startLinkedFile(
	context: MailContext,
	personIdentifier: string,
	input: { filename: string; sizeBytes: number; mediaType: string }
): Promise<{ identifier: string; pieceBytes: number; pieceCount: number; received: number[] }> {
	const filename = cleanFilename(input.filename);
	if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) throw new LinkedFileError('This file is empty.');
	if (input.sizeBytes > largestLinkedFileBytes) {
		throw new LinkedFileError(`This file is larger than ${readableSize(largestLinkedFileBytes)}, the largest that can be sent as a link.`, 413);
	}
	const unfinished = await context.database
		.prepare(
			`SELECT identifier, status FROM mail_linked_files WHERE person_identifier = ? AND message_identifier IS NULL AND filename = ? AND size_bytes = ?
			 ORDER BY status = 'ready' DESC, created_at DESC LIMIT 1`
		)
		.bind(personIdentifier, filename, input.sizeBytes)
		.first<{ identifier: string; status: string }>();
	const count = pieceCountFor(input.sizeBytes);
	if (unfinished?.status === 'ready') {
		return { identifier: unfinished.identifier, pieceBytes: linkedPieceBytes, pieceCount: count, received: Array.from({ length: count }, (_, index) => index + 1) };
	}
	if (unfinished) {
		const { results } = await context.database
			.prepare('SELECT number FROM mail_linked_file_pieces WHERE file_identifier = ? ORDER BY number')
			.bind(unfinished.identifier)
			.all<{ number: number }>();
		return { identifier: unfinished.identifier, pieceBytes: linkedPieceBytes, pieceCount: pieceCountFor(input.sizeBytes), received: results.map((row) => row.number) };
	}
	const identifier = crypto.randomUUID();
	const key = `mail/links/${identifier}`;
	const mediaType = /^[\w.+-]+\/[\w.+-]+$/.test(input.mediaType) ? input.mediaType : 'application/octet-stream';
	const multipart = await context.bucket.createMultipartUpload(key, {
		httpMetadata: { contentType: mediaType, contentDisposition: `attachment; filename="${filename}"` }
	});
	await context.database
		.prepare(
			`INSERT INTO mail_linked_files (identifier, person_identifier, filename, media_type, size_bytes, bucket_key, multipart_identifier, status, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'sending', ?)`
		)
		.bind(identifier, personIdentifier, filename, mediaType, input.sizeBytes, key, multipart.uploadId, currentTime(context).toISOString())
		.run();
	return { identifier, pieceBytes: linkedPieceBytes, pieceCount: pieceCountFor(input.sizeBytes), received: [] };
}

/** The person's own file, or "not found". */
export async function ownLinkedFile(context: MailContext, personIdentifier: string, identifier: string): Promise<LinkedFileRow> {
	const row = await context.database
		.prepare('SELECT * FROM mail_linked_files WHERE identifier = ? AND person_identifier = ?')
		.bind(identifier, personIdentifier)
		.first<LinkedFileRow>();
	if (!row) throw new LinkedFileError('There is no such file.', 404);
	return row;
}

/** Stores one piece. */
export async function receiveLinkedPiece(context: MailContext, file: LinkedFileRow, number: number, bytes: Uint8Array): Promise<{ received: number; pieceCount: number }> {
	if (file.status !== 'sending' || !file.multipart_identifier) throw new LinkedFileError('This file is not waiting for pieces.', 409);
	const count = pieceCountFor(file.size_bytes);
	if (!Number.isInteger(number) || number < 1 || number > count) throw new LinkedFileError('There is no such piece.', 404);
	if (bytes.byteLength !== expectedPieceSize(file.size_bytes, number)) throw new LinkedFileError('This piece is not the size it should be. Choose the file again.');
	const part = await context.bucket.resumeMultipartUpload(file.bucket_key, file.multipart_identifier).uploadPart(number, bytes);
	await context.database
		.prepare('INSERT OR REPLACE INTO mail_linked_file_pieces (file_identifier, number, size_bytes, entity_tag) VALUES (?, ?, ?, ?)')
		.bind(file.identifier, number, bytes.byteLength, part.etag)
		.run();
	const received = await context.database
		.prepare('SELECT COUNT(*) AS count FROM mail_linked_file_pieces WHERE file_identifier = ?')
		.bind(file.identifier)
		.first<{ count: number }>();
	return { received: received?.count ?? 0, pieceCount: count };
}

/** Joins the pieces and puts the file in line for the virus check. */
export async function finishLinkedFile(context: MailContext, file: LinkedFileRow): Promise<void> {
	if (file.status === 'ready') return;
	if (!file.multipart_identifier) throw new LinkedFileError('This file is not waiting to be finished.', 409);
	const { results: pieces } = await context.database
		.prepare('SELECT number, size_bytes, entity_tag FROM mail_linked_file_pieces WHERE file_identifier = ? ORDER BY number')
		.bind(file.identifier)
		.all<{ number: number; size_bytes: number; entity_tag: string }>();
	const count = pieceCountFor(file.size_bytes);
	if (pieces.length !== count) throw new LinkedFileError(`Only ${pieces.length} of ${count} pieces have arrived.`, 409);
	if (pieces.reduce((sum, piece) => sum + piece.size_bytes, 0) !== file.size_bytes) throw new LinkedFileError('The pieces do not add up to the file. Choose it again.', 409);
	await context.bucket
		.resumeMultipartUpload(file.bucket_key, file.multipart_identifier)
		.complete(pieces.map((piece) => ({ partNumber: piece.number, etag: piece.entity_tag })));
	const at = currentTime(context);
	// Held until the virus check passes: the message waits for it, and the link serves nothing before (site/SCANNING.md).
	await requestScan(context.database, { objectKey: file.bucket_key, purpose: 'mail-outgoing', subject: file.identifier }, at);
	await context.database.batch([
		context.database.prepare(`UPDATE mail_linked_files SET status = 'ready', multipart_identifier = NULL WHERE identifier = ?`).bind(file.identifier),
		context.database.prepare('DELETE FROM mail_linked_file_pieces WHERE file_identifier = ?').bind(file.identifier)
	]);
}

/** Takes back a file not yet sent with a message. */
export async function removeLinkedFile(context: MailContext, file: LinkedFileRow): Promise<void> {
	if (file.message_identifier) throw new LinkedFileError('This file has gone with a message.', 409);
	await deleteLinkedFiles(context, [file]);
}

/**
 * The files to send with a message, checked: the person's own, finished,
 * and not with another message yet. Returns them in the order given.
 */
export async function linkedFilesForMessage(context: MailContext, personIdentifier: string | null, identifiers: string[]): Promise<LinkedFileRow[]> {
	const chosen = [...new Set(identifiers.filter(Boolean))];
	if (chosen.length === 0) return [];
	if (chosen.length > linksPerMessage) throw new CompositionLinkError(`A message can carry at most ${linksPerMessage} files as links.`);
	if (!personIdentifier) throw new CompositionLinkError('Only a person can send files as links.');
	if (!context.settings.signingKey || !context.settings.siteAddress) {
		throw new CompositionLinkError('Files can be sent as links once MAIL_SIGNING_KEY and SITE_ADDRESS are set (site/MAIL.md, "Settings").');
	}
	const { results } = await context.database
		.prepare(`SELECT * FROM mail_linked_files WHERE person_identifier = ? AND identifier IN (${chosen.map(() => '?').join(', ')})`)
		.bind(personIdentifier, ...chosen)
		.all<LinkedFileRow>();
	return chosen.map((identifier) => {
		const row = results.find((item) => item.identifier === identifier);
		if (!row) throw new CompositionLinkError('One of the files sent as links is gone. Choose it again.');
		if (row.status !== 'ready') throw new CompositionLinkError(`${row.filename} has not finished sending up yet.`);
		if (row.message_identifier) throw new CompositionLinkError(`${row.filename} has already gone with another message.`);
		return row;
	});
}

/** A problem with the files chosen to send as links, shown on the form like any composition problem. */
export class CompositionLinkError extends Error {}

/** The address of a file's download link. */
export async function linkAddress(context: MailContext, identifier: string): Promise<string> {
	const token = await makeToken(context.settings.signingKey!, 'file', identifier);
	return `${context.settings.siteAddress}/mail/files/${token}`;
}

/**
 * The lines the message gets for its links, put above the signature (or at
 * the end when there is none), so they read as part of what was written.
 */
export async function withLinks(context: MailContext, text: string, files: LinkedFileRow[], expiresAt: Date): Promise<string> {
	if (files.length === 0) return text;
	const until = expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
	const lines = [`${files.length === 1 ? 'A file is' : 'Files are'} attached as ${files.length === 1 ? 'a link' : 'links'}, to download until ${until}:`];
	for (const file of files) lines.push(`${file.filename} (${readableSize(file.size_bytes)}): ${await linkAddress(context, file.identifier)}`);
	const block = lines.join('\n');
	const signatureAt = text.indexOf('\n-- \n');
	if (signatureAt === -1) return `${text.replace(/\s+$/, '')}\n\n${block}\n`;
	return `${text.slice(0, signatureAt).replace(/\s+$/, '')}\n\n${block}\n${text.slice(signatureAt)}`;
}

/** Statements joining the files to a message, with the link's end date. */
export function joinStatements(context: MailContext, files: LinkedFileRow[], messageIdentifier: string, expiresAt: Date) {
	return files.map((file) =>
		context.database
			.prepare('UPDATE mail_linked_files SET message_identifier = ?, expires_at = ? WHERE identifier = ? AND message_identifier IS NULL')
			.bind(messageIdentifier, expiresAt.toISOString(), file.identifier)
	);
}

/** When a link sent at `sendAt` stops working. */
export function linkExpiry(sendAt: Date): Date {
	return new Date(sendAt.getTime() + linkDays * 86_400_000);
}

/**
 * Whether the message's linked files are ready to go: all passed the virus
 * check ("ready"), some still being checked ("waiting"), or one that will
 * never pass ("refused", with the reason).
 */
export async function linkedFilesState(context: MailContext, messageIdentifier: string): Promise<{ state: 'ready' | 'waiting' } | { state: 'refused'; reason: string }> {
	const { results } = await context.database
		.prepare('SELECT filename, bucket_key FROM mail_linked_files WHERE message_identifier = ?')
		.bind(messageIdentifier)
		.all<{ filename: string; bucket_key: string }>();
	if (results.length === 0) return { state: 'ready' };
	const scans = await fileScans(context.database, results.map((row) => row.bucket_key));
	let waiting = false;
	for (const row of results) {
		const scan = scans.get(row.bucket_key) ?? null;
		if (mayServe(scan)) continue;
		if (stillScanning(scan)) {
			waiting = true;
			continue;
		}
		return {
			state: 'refused',
			reason:
				scan?.status === 'flagged'
					? `The virus check found ${scan.reason ? `“${scan.reason}”` : 'something harmful'} in ${row.filename}, so the message was not sent. Remove it and send again.`
					: `${row.filename} could not be checked for viruses, so the message was not sent. Remove it and send again.`
		};
	}
	return { state: waiting ? 'waiting' : 'ready' };
}

/** A file for its download link: the row, if the link has not run out. */
export async function linkedFileForDownload(context: MailContext, identifier: string): Promise<LinkedFileRow | 'expired' | null> {
	const row = await context.database
		.prepare(`SELECT f.* FROM mail_linked_files f JOIN mail_messages m ON m.identifier = f.message_identifier WHERE f.identifier = ? AND m.status = 'sent'`)
		.bind(identifier)
		.first<LinkedFileRow>();
	if (!row) return null;
	if (!row.expires_at || new Date(row.expires_at).getTime() <= currentTime(context).getTime()) return 'expired';
	return row;
}

async function deleteLinkedFiles(context: MailContext, files: LinkedFileRow[]): Promise<void> {
	for (const file of files) {
		if (file.multipart_identifier) await context.bucket.resumeMultipartUpload(file.bucket_key, file.multipart_identifier).abort().catch(() => undefined);
	}
	const keys = files.filter((file) => !file.multipart_identifier).map((file) => file.bucket_key);
	if (keys.length) await context.bucket.delete(keys);
	await forgetAttachmentScans(context, keys);
	if (files.length) {
		await context.database
			.prepare(`DELETE FROM mail_linked_files WHERE identifier IN (${files.map(() => '?').join(', ')})`)
			.bind(...files.map((file) => file.identifier))
			.run();
	}
}

/**
 * Deletes files whose link has run out, uploads left unfinished for a day,
 * and files never sent with a message within a week. Run by the mail run
 * every five minutes, a few at a time.
 */
export async function removeExpiredLinkedFiles(context: MailContext): Promise<number> {
	const now = currentTime(context);
	const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
	const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
	const { results } = await context.database
		.prepare(
			`SELECT * FROM mail_linked_files
			 WHERE (expires_at IS NOT NULL AND expires_at <= ?) OR (status = 'sending' AND created_at < ?) OR (message_identifier IS NULL AND created_at < ?)
			 LIMIT 20`
		)
		.bind(now.toISOString(), dayAgo, weekAgo)
		.all<LinkedFileRow>();
	await deleteLinkedFiles(context, results);
	return results.length;
}
