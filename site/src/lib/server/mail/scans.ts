/**
 * The virus check for attachments that arrive in the project inbox
 * (site/SCANNING.md, site/MAIL.md "Attachments and the virus check").
 *
 * Every attachment, of a message that arrives or one the project sends, is
 * stored with storeSentFile, which puts it in line for the shared scanner,
 * and is held until the scan says clean: it cannot be downloaded, forwarded
 * or sent before then (openScannedFile). A file where something was
 * found is held for good; one that could not be checked (locked with a
 * password, too large) can be released by someone who manages the inbox.
 *
 * A message the project sends waits until its attachments pass
 * (outbound.ts, sendMessage).
 */
import { fileScans, forgetScan, mayServe, releaseByHand, scanStatusWords, type FileScan } from '#lib/server/file-scans.ts';
import { actionStatement, currentTime, type MailContext } from './context.ts';
import { report } from '../report.ts';

/** Where an attachment stands, for the conversation page. */
export interface AttachmentCheck {
	/** True while the file may not be downloaded or forwarded. */
	held: boolean;
	label: string;
	explanation: string;
	/** Whether someone who manages the inbox may release it by hand. */
	releasable: boolean;
	/** When it was checked, by which scanner and signatures, once it has been. */
	checkedBy: string | null;
}

async function scansOf(context: MailContext, keys: string[]): Promise<Map<string, FileScan>> {
	if (keys.length === 0) return new Map();
	try {
		return await fileScans(context.database, keys);
	} catch (problem) {
		// Without the scans every attachment is held, as if not yet scanned; the failure is reported.
		report(problem, { code: 'mail.scans', place: 'mail' });
		return new Map();
	}
}

function checkOf(scan: FileScan | null, received: boolean): AttachmentCheck {
	const words = scanStatusWords(scan);
	return {
		held: !mayServe(scan),
		label: words.label,
		explanation: words.explanation,
		checkedBy: words.checkedBy,
		// Only a received file can be released by hand; a file the team attached is simply sent again without it.
		releasable: received && scan !== null && (scan.status === 'cannot-scan' || scan.status === 'failed') && scan.reason !== 'missing'
	};
}

/** The virus check of each attachment, received or sent, by attachment identifier. */
export async function attachmentChecks(context: MailContext, attachments: { identifier: string; key: string; received: boolean }[]): Promise<Map<string, AttachmentCheck>> {
	const scans = await scansOf(context, attachments.map((item) => item.key));
	return new Map(attachments.map((item) => [item.identifier, checkOf(scans.get(item.key) ?? null, item.received)]));
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
		} catch (problem) {
			// The file is already gone; its scan row is left behind, and the failure is reported.
			report(problem, { code: 'mail.forget-scans', place: 'mail' });
			return;
		}
	}
}
