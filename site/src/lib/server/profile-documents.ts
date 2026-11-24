/**
 * A CV or resume on a contributor profile (docs/contributor-profiles.md,
 * "CV or resume"; Trevor, Nov. 24, 2026: "Allow them to upload CV to Your
 * Background"). It is kept in the private bucket like any file sent to the
 * project, held until the virus check passes (site/SCANNING.md), and seen
 * only by the person, the lead author and editors. It is never published.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { Profile } from './contributor-profiles.ts';
import { activityStatement } from './activity-log.ts';
import { forgetScan, storeSentFile } from './file-scans.ts';
import { newIdentifier, now } from './identifiers.ts';

/** The kinds of file accepted, by extension, with the type each is served as. */
export const documentTypes: Record<string, string> = {
	pdf: 'application/pdf',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	doc: 'application/msword',
	odt: 'application/vnd.oasis.opendocument.text',
	rtf: 'application/rtf',
	txt: 'text/plain; charset=utf-8'
};

/** The largest file accepted: 10 MB, well over a long CV with pictures. */
export const documentMaximumBytes = 10_000_000;

export type CheckedDocument = { ok: true; extension: string; name: string } | { ok: false; message: string };

/** Whether a sent file may be kept as a CV: one of the kinds above, not empty and not too large. */
export function checkDocument(file: File): CheckedDocument {
	const name = file.name.normalize('NFC').replace(/[\\/\u0000-\u001f]/gu, '').slice(-120) || 'CV';
	const extension = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
	if (!(extension in documentTypes)) return { ok: false, message: 'Send the CV as a .pdf, .docx, .doc, .odt, .rtf or .txt file.' };
	if (file.size === 0) return { ok: false, message: 'This file is empty.' };
	if (file.size > documentMaximumBytes) return { ok: false, message: 'This file is over 10 MB. Send a smaller copy, such as a PDF without pictures.' };
	return { ok: true, extension, name };
}

/** Keeps a checked CV as the person's, replacing the one before it. */
export async function saveDocument(
	database: D1Database,
	bucket: R2Bucket,
	profile: Pick<Profile, 'identifier' | 'personIdentifier' | 'curriculumVitaeKey'>,
	file: File,
	checked: { extension: string; name: string }
): Promise<void> {
	const key = `profile-documents/${profile.identifier}/${newIdentifier()}.${checked.extension}`;
	await storeSentFile(database, bucket, {
		objectKey: key,
		purpose: 'profile-document',
		subject: profile.identifier,
		bytes: await file.arrayBuffer(),
		httpMetadata: { contentType: documentTypes[checked.extension] }
	});
	const time = now();
	await database.batch([
		database
			.prepare(
				`UPDATE contributor_profiles SET curriculum_vitae_key = ?, curriculum_vitae_name = ?, curriculum_vitae_updated_at = ?, updated_at = ?
				 WHERE identifier = ?`
			)
			.bind(key, checked.name, time, time, profile.identifier),
		activityStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: profile.curriculumVitaeKey ? 'Changed the CV' : 'Added a CV',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	if (profile.curriculumVitaeKey) {
		await bucket.delete(profile.curriculumVitaeKey);
		await forgetScan(database, profile.curriculumVitaeKey);
	}
}

/** Removes the person's CV from the profile and the bucket. */
export async function removeDocument(
	database: D1Database,
	bucket: R2Bucket,
	profile: Pick<Profile, 'identifier' | 'personIdentifier' | 'curriculumVitaeKey'>
): Promise<void> {
	if (!profile.curriculumVitaeKey) return;
	const time = now();
	await database.batch([
		database
			.prepare(
				`UPDATE contributor_profiles SET curriculum_vitae_key = NULL, curriculum_vitae_name = NULL, curriculum_vitae_updated_at = NULL, updated_at = ?
				 WHERE identifier = ?`
			)
			.bind(time, profile.identifier),
		activityStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: 'Removed the CV',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	await bucket.delete(profile.curriculumVitaeKey);
	await forgetScan(database, profile.curriculumVitaeKey);
}

/** A download response for a CV that passed its virus check, named as the person sent it. */
export function documentResponse(object: { body: unknown; httpMetadata?: { contentType?: string } }, name: string | null): Response {
	const fileName = (name ?? 'CV').replace(/["\r\n]/g, '');
	return new Response(object.body as ReadableStream, {
		headers: {
			'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
			'content-disposition': `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
			'cache-control': 'private, no-store',
			'x-content-type-options': 'nosniff'
		}
	});
}
