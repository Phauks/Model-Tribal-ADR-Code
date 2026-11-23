/**
 * The virus check for attachments that arrive in the project inbox
 * (site/SCANNING.md, site/MAIL.md "Attachments and the virus check").
 *
 * Every attachment of a message that arrives is put in line for the shared
 * scanner as soon as it is stored, and is held until the scan says clean: it
 * cannot be downloaded or forwarded before then. A file where something was
 * found is held for good; one that could not be checked (locked with a
 * password, too large) can be released by someone who manages the inbox.
 *
 * Attachments the project sends are the team's own files and are not held.
 * If the scan table is missing (its migration not yet applied), asking for a
 * scan fails quietly and the file stays held, because a file with no scan is
 * never served.
 */
import { fileScans, forgetScan, mayServe, releaseByHand, requestScan, scanStatusWords, type FileScan } from '#lib/server/file-scans.ts';
import { actionStatement, currentTime, type MailContext } from './context.ts';

/** Where an attachment stands, for the conversation page. */
export interface AttachmentCheck {
	/** True while the file may not be downloaded or forwarded. */
	held: boolean;
	label: string;
	explanation: string;
	/** Whether someone who manages the inbox may release it by hand. */
	releasable: boolean;
}

/** Puts newly arrived attachments in line for the virus check. */
export async function holdAttachments(context: MailContext, attachments: { identifier: string; key: string }[]): Promise<void> {
	const at = currentTime(context);
	for (const attachment of attachments) {
		try {
			await requestScan(context.database, { objectKey: attachment.key, purpose: 'mail-attachment', subject: attachment.identifier }, at);
		} catch (problem) {
			// The scan table is missing: the file stays held, since a file with no scan is never served.
			console.error('Could not put a mail attachment in line for the virus check', problem);
		}
	}
}

async function scansOf(context: MailContext, keys: string[]): Promise<Map<string, FileScan>> {
	if (keys.length === 0) return new Map();
	try {
		return await fileScans(context.database, keys);
	} catch {
		return new Map();
	}
}

function checkOf(scan: FileScan | null): AttachmentCheck {
	const words = scanStatusWords(scan);
	return {
		held: !mayServe(scan),
		label: words.label,
		explanation: words.explanation,
		releasable: scan !== null && (scan.status === 'cannot-scan' || scan.status === 'failed') && scan.reason !== 'missing'
	};
}

/** The virus check of each received attachment, by attachment identifier. Sent attachments are left out: they are never held. */
export async function attachmentChecks(context: MailContext, attachments: { identifier: string; key: string; received: boolean }[]): Promise<Map<string, AttachmentCheck>> {
	const received = attachments.filter((item) => item.received);
	const scans = await scansOf(context, received.map((item) => item.key));
	return new Map(received.map((item) => [item.identifier, checkOf(scans.get(item.key) ?? null)]));
}

/** Whether an attachment may be downloaded or forwarded now. Pass the bucket object, so a file changed after its scan is held again. */
export async function mayHandOut(context: MailContext, attachment: { key: string; received: boolean }, object: { etag: string } | null): Promise<boolean> {
	if (!attachment.received) return true;
	const scans = await scansOf(context, [attachment.key]);
	return mayServe(scans.get(attachment.key) ?? null, object);
}

/** Releases an attachment that could not be checked. Never one where something was found. Returns whether it was released. */
export async function releaseAttachment(context: MailContext, personIdentifier: string, attachmentIdentifier: string, note: string): Promise<boolean> {
	const row = await context.database
		.prepare(
			`SELECT a.bucket_key AS key, a.filename, m.thread_identifier AS thread FROM mail_attachments a
			 JOIN mail_messages m ON m.identifier = a.message_identifier WHERE a.identifier = ? AND m.direction = 'in'`
		)
		.bind(attachmentIdentifier)
		.first<{ key: string; filename: string; thread: string }>();
	if (!row) return false;
	const released = await releaseByHand(context.database, row.key, personIdentifier, note, currentTime(context));
	if (released) {
		await actionStatement(context, {
			personIdentifier,
			action: 'Released an attachment the virus check could not finish',
			threadIdentifier: row.thread,
			note: note.trim() ? `${row.filename}: ${note.trim()}` : row.filename
		}).run();
	}
	return released;
}

/** Forgets the scans of files deleted from the bucket. */
export async function forgetAttachmentScans(context: MailContext, keys: string[]): Promise<void> {
	for (const key of keys) {
		try {
			await forgetScan(context.database, key);
		} catch {
			return;
		}
	}
}
