/**
 * Requests in the database, uploads in the private bucket (decision record
 * 0009). Nothing here is reachable without signing in, except saving a new
 * request.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import {
	personalDetailsKeptDays,
	requestOutcomeLabels,
	requestStatusLabels,
	type RequestKind,
	type RequestOutcome,
	type RequestStatus,
	type SourceKind
} from '#lib/requests.ts';
import { activityStatement } from './activity-log.ts';
import { forgetScan, storeSentFile } from './file-scans.ts';
import { newIdentifier, newRequestReference, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';
import type { NewRequest } from './request-form.ts';
import type { FormAnswers } from '#lib/forms.ts';

/** Uploads sit under this prefix in the sourceDocuments bucket, apart from archived sources. */
const uploadPrefix = 'requests';

/** Copies of forms filled in online sit under this prefix (migrations/0007_form_submissions.sql). */
const formCopyPrefix = 'forms';

/** A form sent from the Forms pages with the request it opens (src/lib/forms.ts). */
export interface NewFormSubmission {
	/** The form's page name, such as "contributor-statement". */
	form: string;
	title: string;
	identifiers: string[];
	version: string;
	checksum: string;
	method: 'online' | 'paper-upload';
	/** The name typed in a signature line, for a form signed online. */
	signedName: string | null;
	answers: FormAnswers | null;
	/** The filled form as Markdown, for a form filled in online. */
	filledCopy: string | null;
}

/**
 * Saves a new request and its uploads, and the form it came with, if any.
 * Returns the reference given to the requester.
 */
export async function saveRequest(
	database: D1Database,
	bucket: R2Bucket,
	request: NewRequest,
	form?: NewFormSubmission
): Promise<string> {
	const identifier = newIdentifier();
	const reference = newRequestReference();
	const receivedAt = now();
	const submissionIdentifier = newIdentifier();
	const copyKey = form?.filledCopy ? `${formCopyPrefix}/${identifier}/${submissionIdentifier}.md` : null;

	const sources = request.sources.map((source) => ({
		...source,
		identifier: newIdentifier()
	}));
	const uploaded: string[] = [];
	try {
		for (const source of sources) {
			if (!source.file) continue;
			const key = `${uploadPrefix}/${identifier}/${source.identifier}`;
			// Held until the virus check passes (site/SCANNING.md).
			await storeSentFile(database, bucket, {
				objectKey: key,
				purpose: 'request-file',
				subject: reference,
				bytes: source.file.bytes,
				httpMetadata: { contentType: source.file.type },
				customMetadata: { requestReference: reference, fileName: source.file.name }
			});
			uploaded.push(key);
		}
		if (form?.filledCopy && copyKey) {
			await bucket.put(copyKey, new TextEncoder().encode(form.filledCopy), {
				httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
				customMetadata: { requestReference: reference, form: form.form, formVersion: form.version }
			});
			uploaded.push(copyKey);
		}

		await database.batch([
			database
				.prepare(
					`INSERT INTO requests (identifier, reference, kind, material, nation_identifier,
					   requester_name, requester_nation, requester_role, writing_for_government, contact, details,
					   credit_preference, publication_permission, missing_nation_official_name,
					   missing_nation_own_name, missing_nation_states, authority_statement, earlier_reference,
					   received_at, shared_with_team)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					identifier,
					reference,
					request.kind,
					request.material,
					request.nationIdentifier,
					request.requesterName,
					request.requesterNation,
					request.requesterRole,
					request.writingForGovernment ? 1 : 0,
					request.contact,
					request.details,
					request.creditPreference,
					request.publicationPermission,
					request.missingNationOfficialName,
					request.missingNationOwnName,
					request.missingNationStates,
					request.authorityStatement,
					request.earlierReference,
					receivedAt,
					request.sharedWithTeam ? 1 : 0
				),
			...sources.map((source) =>
				database
					.prepare(
						`INSERT INTO request_sources (identifier, request_identifier, source_kind, title, citation,
						   source_date, location_in_source, file_key, file_name, file_type, file_size)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
					)
					.bind(
						source.identifier,
						identifier,
						source.sourceKind,
						source.title,
						source.citation,
						source.sourceDate,
						source.locationInSource,
						source.file ? `${uploadPrefix}/${identifier}/${source.identifier}` : null,
						source.file?.name ?? null,
						source.file?.type ?? null,
						source.file?.bytes.byteLength ?? null
					)
			),
			...(form
				? [
						database
							.prepare(
								`INSERT INTO form_submissions (identifier, request_identifier, form, form_identifiers,
								   form_version, form_checksum, method, signed_name, signed_at, answers, filled_copy_key,
								   received_at)
								 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
							)
							.bind(
								submissionIdentifier,
								identifier,
								form.form,
								form.identifiers.join(' '),
								form.version,
								form.checksum,
								form.method,
								form.signedName,
								form.method === 'online' ? receivedAt : null,
								form.answers ? JSON.stringify(form.answers) : null,
								copyKey,
								receivedAt
							)
					]
				: []),
			activityStatement(database, {
				personIdentifier: null,
				action: form
					? `Form received through the website: ${form.title}, version ${form.version}, ${
							form.method === 'online' ? 'signed online' : 'signed paper copy uploaded'
						}`
					: 'Request received through the website',
				targetKind: 'request',
				targetIdentifier: identifier
			})
		]);
	} catch (problem) {
		// Leave no orphaned uploads behind if the request could not be saved.
		if (uploaded.length > 0) {
			await bucket.delete(uploaded).catch(() => undefined);
			for (const key of uploaded) await forgetScan(database, key).catch(() => undefined);
		}
		throw problem;
	}
	return reference;
}

export interface RequestSummary {
	identifier: string;
	reference: string;
	kind: RequestKind;
	status: RequestStatus;
	outcome: RequestOutcome | null;
	nationIdentifier: string | null;
	missingNationOfficialName: string | null;
	receivedAt: string;
	acknowledgedAt: string | null;
	materialHiddenAt: string | null;
	resolvedAt: string | null;
}

const summaryColumns = `identifier, reference, kind, status, outcome,
	nation_identifier AS nationIdentifier, missing_nation_official_name AS missingNationOfficialName,
	received_at AS receivedAt, acknowledged_at AS acknowledgedAt,
	material_hidden_at AS materialHiddenAt, resolved_at AS resolvedAt`;

export async function listRequests(
	database: D1Database,
	show: 'open' | 'resolved' | 'all'
): Promise<RequestSummary[]> {
	const where =
		show === 'open' ? `WHERE status != 'resolved'` : show === 'resolved' ? `WHERE status = 'resolved'` : '';
	const result = await database
		.prepare(`SELECT ${summaryColumns} FROM requests ${where} ORDER BY received_at DESC LIMIT 500`)
		.all<RequestSummary>();
	return result.results;
}

export interface RequestDetail extends RequestSummary {
	material: string | null;
	requesterName: string | null;
	requesterNation: string | null;
	requesterRole: string | null;
	writingForGovernment: number;
	contact: string | null;
	details: string | null;
	creditPreference: string | null;
	publicationPermission: string | null;
	missingNationOwnName: string | null;
	missingNationStates: string | null;
	authorityStatement: string | null;
	earlierReference: string | null;
	outcomeReason: string | null;
	personalDetailsDeletedAt: string | null;
}

export interface RequestSource {
	identifier: string;
	sourceKind: SourceKind | null;
	title: string | null;
	citation: string | null;
	sourceDate: string | null;
	locationInSource: string | null;
	fileKey: string | null;
	fileName: string | null;
	fileType: string | null;
	fileSize: number | null;
}

export async function requestByReference(
	database: D1Database,
	reference: string
): Promise<{ request: RequestDetail; sources: RequestSource[] } | undefined> {
	const request = await database
		.prepare(
			`SELECT ${summaryColumns}, material, requester_name AS requesterName,
			        requester_nation AS requesterNation, requester_role AS requesterRole,
			        writing_for_government AS writingForGovernment, contact, details,
			        credit_preference AS creditPreference, publication_permission AS publicationPermission,
			        missing_nation_own_name AS missingNationOwnName, missing_nation_states AS missingNationStates,
			        authority_statement AS authorityStatement, earlier_reference AS earlierReference,
			        outcome_reason AS outcomeReason, personal_details_deleted_at AS personalDetailsDeletedAt
			 FROM requests WHERE reference = ?`
		)
		.bind(reference)
		.first<RequestDetail>();
	if (!request) return undefined;
	const sources = await database
		.prepare(
			`SELECT identifier, source_kind AS sourceKind, title, citation, source_date AS sourceDate,
			        location_in_source AS locationInSource, file_key AS fileKey, file_name AS fileName,
			        file_type AS fileType, file_size AS fileSize
			 FROM request_sources WHERE request_identifier = ? ORDER BY rowid`
		)
		.bind(request.identifier)
		.all<RequestSource>();
	return { request, sources: sources.results };
}

/** Moves a request to a new status, and records when it was acknowledged or the material hidden. */
export async function changeStatus(
	database: D1Database,
	request: RequestSummary,
	status: Exclude<RequestStatus, 'resolved'>,
	note: string | null,
	person: SignedInPerson
): Promise<void> {
	const time = now();
	await database.batch([
		database
			.prepare(
				`UPDATE requests SET status = ?,
				   acknowledged_at = COALESCE(acknowledged_at, CASE WHEN ? != 'received' THEN ? END),
				   material_hidden_at = COALESCE(material_hidden_at, CASE WHEN ? = 'hidden-pending-review' THEN ? END)
				 WHERE identifier = ?`
			)
			.bind(status, status, time, status, time, request.identifier),
		activityStatement(database, {
			personIdentifier: person.identifier,
			action: `Status changed from “${requestStatusLabels[request.status]}” to “${requestStatusLabels[status]}”`,
			targetKind: 'request',
			targetIdentifier: request.identifier,
			note
		})
	]);
}

export async function resolveRequest(
	database: D1Database,
	request: RequestSummary,
	outcome: RequestOutcome,
	reason: string | null,
	person: SignedInPerson
): Promise<void> {
	const time = now();
	await database.batch([
		database
			.prepare(
				`UPDATE requests SET status = 'resolved', outcome = ?, outcome_reason = ?, resolved_at = ?,
				   acknowledged_at = COALESCE(acknowledged_at, ?)
				 WHERE identifier = ?`
			)
			.bind(outcome, reason, time, time, request.identifier),
		activityStatement(database, {
			personIdentifier: person.identifier,
			action: `Resolved: ${requestOutcomeLabels[outcome]}`,
			targetKind: 'request',
			targetIdentifier: request.identifier,
			note: reason
		})
	]);
}

/** Reopens a resolved request, for example when a requester asks for reconsideration. */
export async function reopenRequest(
	database: D1Database,
	request: RequestSummary,
	note: string | null,
	person: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE requests SET status = 'acknowledged', outcome = NULL, resolved_at = NULL WHERE identifier = ?`
			)
			.bind(request.identifier),
		activityStatement(database, {
			personIdentifier: person.identifier,
			action: `Reopened (was ${request.outcome ? requestOutcomeLabels[request.outcome] : 'resolved'})`,
			targetKind: 'request',
			targetIdentifier: request.identifier,
			note
		})
	]);
}

export async function addNote(
	database: D1Database,
	request: RequestSummary,
	note: string,
	person: SignedInPerson
): Promise<void> {
	await activityStatement(database, {
		personIdentifier: person.identifier,
		action: 'Note',
		targetKind: 'request',
		targetIdentifier: request.identifier,
		note
	}).run();
}

/**
 * Deletes the requester's personal details from requests resolved more than
 * 12 months ago, unless they chose to be credited (docs/requests.md, "How it
 * is built"). A request that came with a signed form is kept whole: the form
 * is the record of what the person allowed (docs/contributions.md). Runs whenever an editor opens the request list, so it needs
 * no scheduled job. Returns how many requests were cleared.
 */
export async function deleteExpiredPersonalDetails(database: D1Database): Promise<number> {
	const cutoff = new Date(Date.now() - personalDetailsKeptDays * 24 * 60 * 60 * 1000).toISOString();
	const result = await database
		.prepare(
			`UPDATE requests SET requester_name = NULL, requester_role = NULL, contact = NULL,
			   personal_details_deleted_at = ?
			 WHERE status = 'resolved' AND resolved_at < ? AND personal_details_deleted_at IS NULL
			   AND NOT (kind = 'contribute' AND credit_preference IS NOT NULL)
			   AND NOT EXISTS (SELECT 1 FROM form_submissions WHERE form_submissions.request_identifier = requests.identifier)`
		)
		.bind(now(), cutoff)
		.run();
	return result.meta.changes ?? 0;
}
