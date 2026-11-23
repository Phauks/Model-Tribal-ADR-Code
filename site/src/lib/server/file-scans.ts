/**
 * Virus and malware scans of files in the private bucket (site/SCANNING.md).
 * This is the whole interface the rest of the site uses:
 *
 * 1. Store the file in the bucket, then call requestScan with its key. The
 *    file is now held.
 * 2. Before serving or opening it, read its scan (fileScan or fileScans) and
 *    serve it only if mayServe says yes. Pass the bucket object, so a file
 *    replaced after its scan is held again.
 * 3. Show people where it stands with scanStatusWords.
 *
 * The scanner Worker (site/scanner) does the scanning on its own, from the
 * file_scans table (migrations/0021_file_scans.sql), so nothing here needs
 * the scanner to be running. Until it is, files simply wait.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';

export const scanStatuses = ['waiting', 'scanning', 'retrying', 'clean', 'flagged', 'cannot-scan', 'failed', 'released-by-hand'] as const;
export type ScanStatus = (typeof scanStatuses)[number];

/** What a file is, so each part of the site can find its own scans. */
export type ScanPurpose = 'upload' | 'mail-attachment';

export interface FileScan {
	objectKey: string;
	purpose: string;
	subject: string | null;
	status: ScanStatus;
	reason: string | null;
	activeContent: boolean;
	objectEtag: string | null;
	sizeBytes: number | null;
	provider: string | null;
	engineVersion: string | null;
	attempts: number;
	requestedAt: string;
	startedAt: string | null;
	finishedAt: string | null;
	nextTryAt: string | null;
	releasedBy: string | null;
	releasedAt: string | null;
	releaseNote: string | null;
}

interface FileScanRow {
	object_key: string;
	purpose: string;
	subject: string | null;
	status: ScanStatus;
	reason: string | null;
	active_content: number;
	object_etag: string | null;
	size_bytes: number | null;
	provider: string | null;
	engine_version: string | null;
	attempts: number;
	requested_at: string;
	started_at: string | null;
	finished_at: string | null;
	next_try_at: string | null;
	released_by: string | null;
	released_at: string | null;
	release_note: string | null;
}

export function fileScanFromRow(row: FileScanRow): FileScan {
	return {
		objectKey: row.object_key,
		purpose: row.purpose,
		subject: row.subject,
		status: row.status,
		reason: row.reason,
		activeContent: row.active_content === 1,
		objectEtag: row.object_etag,
		sizeBytes: row.size_bytes,
		provider: row.provider,
		engineVersion: row.engine_version,
		attempts: row.attempts,
		requestedAt: row.requested_at,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		nextTryAt: row.next_try_at,
		releasedBy: row.released_by,
		releasedAt: row.released_at,
		releaseNote: row.release_note
	};
}

/**
 * Holds a file and puts it in line for the scanner. Asking again for the same
 * key (the file was replaced, or someone wants it scanned again) starts over,
 * so an old result never covers new bytes.
 */
export async function requestScan(
	database: D1Database,
	file: { objectKey: string; purpose: ScanPurpose; subject?: string | null },
	now: Date = new Date()
): Promise<void> {
	await database
		.prepare(
			`INSERT INTO file_scans (object_key, purpose, subject, status, requested_at)
			 VALUES (?, ?, ?, 'waiting', ?)
			 ON CONFLICT (object_key) DO UPDATE SET
				purpose = excluded.purpose, subject = excluded.subject, status = 'waiting', reason = NULL,
				active_content = 0, object_etag = NULL, size_bytes = NULL, provider = NULL, engine_version = NULL,
				attempts = 0, requested_at = excluded.requested_at, started_at = NULL, finished_at = NULL,
				next_try_at = NULL, released_by = NULL, released_at = NULL, release_note = NULL`
		)
		.bind(file.objectKey, file.purpose, file.subject ?? null, now.toISOString())
		.run();
}

/** One file's scan, or null if it was never put in line. */
export async function fileScan(database: D1Database, objectKey: string): Promise<FileScan | null> {
	const row = await database.prepare('SELECT * FROM file_scans WHERE object_key = ?').bind(objectKey).first<FileScanRow>();
	return row ? fileScanFromRow(row) : null;
}

/** Several files' scans at once, by key. Keys never put in line are missing from the map. */
export async function fileScans(database: D1Database, objectKeys: readonly string[]): Promise<Map<string, FileScan>> {
	const found = new Map<string, FileScan>();
	const unique = [...new Set(objectKeys)];
	// D1 takes up to 100 bound values in one statement.
	for (let start = 0; start < unique.length; start += 90) {
		const keys = unique.slice(start, start + 90);
		const { results } = await database
			.prepare(`SELECT * FROM file_scans WHERE object_key IN (${keys.map(() => '?').join(', ')})`)
			.bind(...keys)
			.all<FileScanRow>();
		for (const row of results) found.set(row.object_key, fileScanFromRow(row));
	}
	return found;
}

/**
 * Whether a file may be served or opened. Only a clean scan, or a reviewer's
 * release, lets it out, and only for the bytes that were scanned: pass the
 * bucket object (its etag) whenever you have it. A file with no scan at all
 * is held.
 */
export function mayServe(scan: FileScan | null, object?: { etag: string } | null): boolean {
	if (!scan) return false;
	if (scan.status !== 'clean' && scan.status !== 'released-by-hand') return false;
	if (object && scan.objectEtag !== null && scan.objectEtag !== object.etag) return false;
	return true;
}

/** Whether the file is still in line or being scanned, so a page can say "checking" and look again later. */
export function stillScanning(scan: FileScan | null): boolean {
	return !scan || scan.status === 'waiting' || scan.status === 'scanning' || scan.status === 'retrying';
}

/** Plain words for a file's scan, for the people who sent it and the people who review it. */
export function scanStatusWords(scan: FileScan | null): { label: string; explanation: string } {
	if (!scan) return { label: 'Not checked', explanation: 'This file was never put in line for the virus check, so it is held.' };
	switch (scan.status) {
		case 'waiting':
			return scan.reason === 'no-engine'
				? { label: 'Waiting for the virus check', explanation: 'The virus check is not running yet. The file is held until it is checked.' }
				: { label: 'Waiting for the virus check', explanation: 'The file is in line for the virus check and is held until it passes.' };
		case 'scanning':
			return { label: 'Checking for viruses', explanation: 'The virus check is looking at the file now.' };
		case 'retrying':
			return {
				label: 'Checking for viruses',
				explanation: 'The virus check could not finish and will try again shortly. The file is held until it passes.'
			};
		case 'clean':
			return scan.activeContent
				? {
						label: 'No virus found',
						explanation: 'No virus was found, but the file holds scripts or macros. Open it with care.'
					}
				: { label: 'No virus found', explanation: 'The virus check found nothing.' };
		case 'flagged':
			return {
				label: 'Virus found',
				explanation: `The virus check found ${scan.reason ? `“${scan.reason}”` : 'something harmful'}. The file is held and will never be shown or downloaded.`
			};
		case 'cannot-scan':
			return {
				label: 'Could not be checked',
				explanation:
					scan.reason === 'encrypted'
						? 'The file is locked with a password, so it could not be checked. It is held until a reviewer decides.'
						: scan.reason === 'too-large'
							? 'The file is larger than the virus check takes. It is held until a reviewer decides.'
							: scan.reason === 'missing'
								? 'The file was not in storage when the check looked for it.'
								: 'The file could not be checked. It is held until a reviewer decides.'
			};
		case 'failed':
			return {
				label: 'Check did not finish',
				explanation: 'The virus check tried several times and did not finish. The file is held; a reviewer can try again.'
			};
		case 'released-by-hand':
			return {
				label: 'Released without a check',
				explanation: 'The file could not be checked, and a reviewer released it. Open it with care.'
			};
	}
}

/**
 * Lets a reviewer release a file that could not be scanned (locked, too
 * large, or the check gave up). A file where something was found can never
 * be released this way. Returns whether it was released. The caller checks
 * the person's permission and writes the activity log entry.
 */
export async function releaseByHand(
	database: D1Database,
	objectKey: string,
	personIdentifier: string,
	note: string,
	now: Date = new Date()
): Promise<boolean> {
	const result = await database
		.prepare(
			`UPDATE file_scans SET status = 'released-by-hand', released_by = ?, released_at = ?, release_note = ?
			 WHERE object_key = ? AND status IN ('cannot-scan', 'failed') AND COALESCE(reason, '') <> 'missing'`
		)
		.bind(personIdentifier, now.toISOString(), note.trim() || null, objectKey)
		.run();
	return result.meta.changes > 0;
}

/** Puts a file back in line, for example after the check gave up. A flagged file stays flagged. */
export async function scanAgain(database: D1Database, objectKey: string, now: Date = new Date()): Promise<boolean> {
	const result = await database
		.prepare(
			`UPDATE file_scans SET status = 'waiting', reason = NULL, attempts = 0, requested_at = ?, started_at = NULL,
				finished_at = NULL, next_try_at = NULL, released_by = NULL, released_at = NULL, release_note = NULL
			 WHERE object_key = ? AND status <> 'flagged'`
		)
		.bind(now.toISOString(), objectKey)
		.run();
	return result.meta.changes > 0;
}

/** Forgets a file's scan once the file itself is deleted. */
export async function forgetScan(database: D1Database, objectKey: string): Promise<void> {
	await database.prepare('DELETE FROM file_scans WHERE object_key = ?').bind(objectKey).run();
}
