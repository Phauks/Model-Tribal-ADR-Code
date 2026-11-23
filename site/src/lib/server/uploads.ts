/**
 * Files people send for review (docs/uploads.md, decision record 0038).
 *
 * A file arrives in pieces of 10 MB, each sent to the Worker and passed on to
 * the private sourceDocuments bucket as one part of a multipart upload
 * (Cloudflare R2, "Use the R2 multipart API from Workers",
 * https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/).
 * Pieces keep every request under the Workers request size limit (100 MB on
 * the Free and Pro plans; Cloudflare Workers, "Limits: Request limits",
 * https://developers.cloudflare.com/workers/platform/limits/#request-limits),
 * and let a stopped upload pick up where it left off.
 *
 * The first piece tells what the file is (src/lib/server/upload-checks.ts);
 * every piece is hashed and searched for hidden programs as it arrives. When
 * the last piece is in, the parts are joined, a picture gets a copy without
 * its location, and the file waits for a reviewer. Every change is recorded
 * in the activity log, in the same batch as the change.
 */
import type { D1Database, D1PreparedStatement, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { atLeast, can } from '#lib/permissions.ts';
import {
	allowances,
	decidedStatuses,
	destinations,
	filedAccessLevels,
	isOneOf,
	largestAnyFileBytes,
	largestFileBytes,
	origins,
	permittedUses,
	pieceBytes,
	readableSize,
	uploadKindLabels,
	withdrawableStatuses,
	type CheckResult,
	type Destination,
	type FiledAccessLevel,
	type Origin,
	type PermittedUse,
	type UploadAllowance,
	type UploadKind,
	type UploadSource,
	type UploadStatus,
	type WayIn
} from '#lib/uploads.ts';
import { youtubeVideoIdentifier } from '#lib/video-links.ts';
import { accessTo } from './access.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, newRequestReference, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';
import {
	checkFileType,
	fileFingerprint,
	findHiddenContent,
	pictureWithoutLocation,
	sha256Hex,
	type PieceFinding
} from './upload-checks.ts';

/** A refusal the sender or reviewer should read, with the HTTP status to send. */
export class UploadProblem extends Error {
	constructor(
		message: string,
		readonly status = 400
	) {
		super(message);
	}
}

/** Pictures up to this size get a copy without location details; larger ones would strain the Worker. */
export const largestPreviewBytes = 20 * 1024 * 1024;

/** Withdrawn, declined and refused files are removed from the bucket after this many days. */
export const keepDeclinedDays = 30;

/** A file that stops arriving is given up after this many days, when the bucket drops its pieces. */
export const unfinishedDays = 7;

/** Statuses that count toward what an account has waiting. */
const waitingForUs: readonly UploadStatus[] = [
	'sending',
	'checking',
	'waiting-for-review',
	'in-review',
	'needs-answer',
	'waiting-for-nation'
];

export interface UploadRow {
	identifier: string;
	reference: string;
	group_identifier: string;
	account_identifier: string | null;
	way_in: WayIn;
	essay_identifier: string | null;
	kind: UploadKind | null;
	source: UploadSource;
	status: UploadStatus;
	file_name: string | null;
	media_type: string | null;
	size_bytes: number | null;
	fingerprint: string | null;
	original_key: string | null;
	preview_key: string | null;
	multipart_identifier: string | null;
	youtube_identifier: string | null;
	title: string | null;
	description: string | null;
	origin: Origin | null;
	origin_note: string | null;
	permitted_use: PermittedUse | null;
	nation_first: number;
	sender_under_eighteen: number;
	described_at: string | null;
	check_result: CheckResult | null;
	check_notes: string | null;
	reviewer_identifier: string | null;
	decision_reason: string | null;
	destination: Destination | null;
	filed_page: string | null;
	caption: string | null;
	credit: string | null;
	alternative_text: string | null;
	transcript: string | null;
	access_level: FiledAccessLevel | null;
	embargoed_until: string | null;
	filing_identifier: string | null;
	filed_key: string | null;
	received_at: string;
	finished_at: string | null;
	checked_at: string | null;
	decided_at: string | null;
	withdrawn_at: string | null;
	deleted_at: string | null;
}

export interface PieceRow {
	number: number;
	size_bytes: number;
	sha256: string;
	entity_tag: string;
	findings: string | null;
}

export interface MessageRow {
	identifier: string;
	kind: 'question' | 'answer' | 'note' | 'nation-comment';
	body: string;
	created_at: string;
	person_name: string | null;
}

export interface LinkRow {
	target_kind: 'nation' | 'record';
	target_identifier: string;
	added_by: 'sender' | 'reviewer';
}

/** What the sender says about the files they send together. */
export interface SenderAnswers {
	title: string | null;
	description: string;
	origin: Origin;
	originNote: string | null;
	permittedUse: PermittedUse;
	nationFirst: boolean;
	underEighteen: boolean;
	nations: string[];
}

export type AnswerErrors = Partial<Record<'description' | 'origin' | 'originNote' | 'permittedUse' | 'confirmed' | 'nations', string>>;

/**
 * Reads the sender's answers from a form or from the JSON the Send files
 * page posts. `isNation` says whether an identifier names a nation page.
 */
export function readAnswers(
	values: Record<string, unknown>,
	isNation: (identifier: string) => boolean = () => true
): { ok: true; answers: SenderAnswers } | { ok: false; errors: AnswerErrors } {
	const text = (name: string, maximum: number): string | null => {
		const value = values[name];
		if (typeof value !== 'string') return null;
		const trimmed = value.normalize('NFC').trim().slice(0, maximum);
		return trimmed === '' ? null : trimmed;
	};
	const yes = (name: string) => values[name] === true || values[name] === 'on' || values[name] === 'yes';
	const errors: AnswerErrors = {};
	const description = text('description', 4000);
	if (!description) errors.description = 'Say in a few words what the files are.';
	const origin = values.origin;
	if (!isOneOf(origins, origin)) errors.origin = 'Choose where the files came from.';
	const originNote = text('originNote', 1000);
	if ((origin === 'with-permission' || origin === 'published') && !originNote) {
		errors.originNote =
			origin === 'published' ? 'Say where they were published.' : 'Say whose permission you have.';
	}
	const permittedUse = values.permittedUse;
	if (!isOneOf(permittedUses, permittedUse)) errors.permittedUse = 'Choose how we may use them.';
	if (!yes('confirmed')) errors.confirmed = 'Confirm that you may send these files.';
	const rawNations = Array.isArray(values.nations)
		? values.nations
		: typeof values.nations === 'string'
			? values.nations.split(/[\s,]+/)
			: [];
	const nations = [...new Set(rawNations.filter((value): value is string => typeof value === 'string' && value !== ''))];
	if (nations.length > 20) errors.nations = 'Name at most 20 nations.';
	else if (nations.some((identifier) => !isNation(identifier))) errors.nations = 'Choose nations from the list.';
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		answers: {
			title: text('title', 300),
			description: description!,
			origin: origin as Origin,
			originNote,
			permittedUse: permittedUse as PermittedUse,
			nationFirst: yes('nationFirst'),
			underEighteen: yes('underEighteen'),
			nations
		}
	};
}

/** A file name safe to store and show: no folders, no control characters, at most 200 characters. */
export function safeFileName(name: string): string {
	const base = name.normalize('NFC').split(/[\\/]/).at(-1) ?? '';
	// eslint-disable-next-line no-control-regex
	const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, '').trim().slice(-200);
	return cleaned === '' || cleaned === '.' || cleaned === '..' ? 'file' : cleaned;
}

/** A file name for the Content-Disposition header: ASCII only. */
export function downloadName(name: string): string {
	return name.replace(/[^A-Za-z0-9._ -]/g, '_') || 'file';
}

/** How many pieces a file of this size is sent in. */
export function pieceCount(sizeBytes: number): number {
	return Math.max(1, Math.ceil(sizeBytes / pieceBytes));
}

/** The size the piece numbered `number` (from 1) must have. */
export function expectedPieceSize(sizeBytes: number, number: number): number {
	const count = pieceCount(sizeBytes);
	return number < count ? pieceBytes : sizeBytes - (count - 1) * pieceBytes;
}

/** The limits for an account: none for reviewers, more for contributors who confirmed a profile. */
export async function allowanceFor(
	database: D1Database,
	accountIdentifier: string,
	person: SignedInPerson | undefined
): Promise<UploadAllowance> {
	if (person && can(person, 'review-uploads')) return allowances.unlimited;
	const profile = await database
		.prepare(`SELECT 1 AS found FROM contributor_profiles WHERE sign_in_subject = ? AND status = 'welcomed'`)
		.bind(accountIdentifier)
		.first<{ found: number }>();
	return profile ? allowances.confirmedContributor : allowances.signedIn;
}

function uploadEvent(
	database: D1Database,
	upload: Pick<UploadRow, 'identifier' | 'reference'>,
	action: string,
	personIdentifier: string | null = null,
	note: string | null = null
): D1PreparedStatement {
	return eventStatement(database, {
		personIdentifier,
		action,
		targetKind: 'upload',
		targetIdentifier: upload.identifier,
		note: note ? `${upload.reference}: ${note}`.slice(0, 500) : upload.reference
	});
}

function answerColumns(answers: SenderAnswers): (string | number | null)[] {
	return [
		answers.description,
		answers.origin,
		answers.originNote,
		answers.permittedUse,
		answers.nationFirst ? 1 : 0,
		answers.underEighteen ? 1 : 0
	];
}

function linkStatements(database: D1Database, identifier: string, nations: string[], at: string): D1PreparedStatement[] {
	return nations.map((nation) =>
		database
			.prepare(
				`INSERT OR IGNORE INTO upload_links (upload_identifier, target_kind, target_identifier, added_by, added_at)
				 VALUES (?, 'nation', ?, 'sender', ?)`
			)
			.bind(identifier, nation, at)
	);
}

async function checkAllowance(
	database: D1Database,
	accountIdentifier: string,
	allowance: UploadAllowance,
	addingBytes: number
): Promise<void> {
	if (allowance.filesPerDay === Number.POSITIVE_INFINITY) return;
	const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const today = await database
		.prepare(`SELECT COUNT(*) AS count FROM uploads WHERE account_identifier = ? AND received_at > ?`)
		.bind(accountIdentifier, since)
		.first<{ count: number }>();
	if ((today?.count ?? 0) >= allowance.filesPerDay) {
		throw new UploadProblem(
			`You can send ${allowance.filesPerDay} files a day. Send the rest tomorrow, or write to us if you have many.`,
			429
		);
	}
	const waiting = await database
		.prepare(
			`SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM uploads
			 WHERE account_identifier = ? AND status IN (${waitingForUs.map(() => '?').join(', ')})`
		)
		.bind(accountIdentifier, ...waitingForUs)
		.first<{ bytes: number }>();
	if ((waiting?.bytes ?? 0) + addingBytes > allowance.waitingBytes) {
		throw new UploadProblem(
			`You have ${readableSize(waiting?.bytes ?? 0)} waiting for review, and the limit is ${readableSize(allowance.waitingBytes)}. Send more once we have looked at what you sent.`,
			429
		);
	}
}

export interface StartInput {
	accountIdentifier: string;
	/** The person, when the sender also has workspace access, for the activity log. */
	personIdentifier?: string | null;
	groupIdentifier: string;
	fileName: string;
	sizeBytes: number;
	wayIn: WayIn;
	essayIdentifier?: string | null;
	/** Required for files sent on the Send files page. */
	answers?: SenderAnswers;
}

export interface StartedUpload {
	reference: string;
	pieceBytes: number;
	pieceCount: number;
	/** Pieces already in, when the same file was chosen again after a stop. */
	received: number[];
}

/**
 * Starts sending one file, or picks up a file of the same name and size that
 * the same account had started and not finished.
 */
export async function startUpload(
	database: D1Database,
	bucket: R2Bucket,
	input: StartInput,
	allowance: UploadAllowance
): Promise<StartedUpload> {
	const fileName = safeFileName(input.fileName);
	if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes <= 0) throw new UploadProblem('This file is empty.');
	if (input.sizeBytes > largestAnyFileBytes) {
		throw new UploadProblem(`This file is larger than ${readableSize(largestAnyFileBytes)}, the largest we can take.`, 413);
	}
	if (input.wayIn === 'send-files' && !input.answers) throw new UploadProblem('Answer the questions about the files first.');
	if (input.wayIn === 'essay-figure' && !input.essayIdentifier) throw new UploadProblem('Name the essay.');

	const unfinished = await database
		.prepare(
			`SELECT * FROM uploads
			 WHERE account_identifier = ? AND status = 'sending' AND file_name = ? AND size_bytes = ? AND way_in = ?
			 ORDER BY received_at DESC LIMIT 1`
		)
		.bind(input.accountIdentifier, fileName, input.sizeBytes, input.wayIn)
		.first<UploadRow>();
	if (unfinished) {
		const pieces = await database
			.prepare('SELECT number FROM upload_pieces WHERE upload_identifier = ? ORDER BY number')
			.bind(unfinished.identifier)
			.all<{ number: number }>();
		return {
			reference: unfinished.reference,
			pieceBytes,
			pieceCount: pieceCount(input.sizeBytes),
			received: pieces.results.map((row) => row.number)
		};
	}

	await checkAllowance(database, input.accountIdentifier, allowance, input.sizeBytes);

	const identifier = newIdentifier();
	const reference = `U-${newRequestReference()}`;
	const originalKey = `uploads/${identifier}/original`;
	const multipart = await bucket.createMultipartUpload(originalKey, {
		httpMetadata: { contentType: 'application/octet-stream' },
		customMetadata: { reference }
	});
	const at = now();
	const answers = input.answers;
	await database.batch([
		database
			.prepare(
				`INSERT INTO uploads (
					identifier, reference, group_identifier, account_identifier, way_in, essay_identifier, source, status,
					file_name, size_bytes, original_key, multipart_identifier,
					title, description, origin, origin_note, permitted_use, nation_first, sender_under_eighteen, described_at,
					received_at
				) VALUES (?, ?, ?, ?, ?, ?, 'file', 'sending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				reference,
				input.groupIdentifier,
				input.accountIdentifier,
				input.wayIn,
				input.essayIdentifier ?? null,
				fileName,
				input.sizeBytes,
				originalKey,
				multipart.uploadId,
				answers?.title ?? null,
				...(answers ? answerColumns(answers) : [null, null, null, null, 0, 0]),
				answers ? at : null,
				at
			),
		...linkStatements(database, identifier, answers?.nations ?? [], at),
		uploadEvent(database, { identifier, reference }, 'Upload started', input.personIdentifier ?? null, fileName)
	]);
	return { reference, pieceBytes, pieceCount: pieceCount(input.sizeBytes), received: [] };
}

/** One upload, if it belongs to the account. */
export async function ownUpload(
	database: D1Database,
	accountIdentifier: string,
	reference: string
): Promise<UploadRow | null> {
	return database
		.prepare('SELECT * FROM uploads WHERE reference = ? AND account_identifier = ?')
		.bind(reference, accountIdentifier)
		.first<UploadRow>();
}

export async function uploadByReference(database: D1Database, reference: string): Promise<UploadRow | null> {
	return database.prepare('SELECT * FROM uploads WHERE reference = ?').bind(reference).first<UploadRow>();
}

/** Marks a file as not accepted and drops whatever arrived of it. */
async function refuseFile(
	database: D1Database,
	bucket: R2Bucket,
	upload: UploadRow,
	reason: string,
	notes: string | null = null
): Promise<void> {
	if (upload.multipart_identifier && upload.original_key) {
		await bucket
			.resumeMultipartUpload(upload.original_key, upload.multipart_identifier)
			.abort()
			.catch(() => undefined);
	}
	const at = now();
	await database.batch([
		database
			.prepare(
				`UPDATE uploads SET status = 'not-accepted', check_result = 'refused', decision_reason = ?, check_notes = ?,
				 multipart_identifier = NULL, checked_at = ?, decided_at = ?, deleted_at = ? WHERE identifier = ?`
			)
			.bind(reason, notes, at, at, at, upload.identifier),
		database.prepare('DELETE FROM upload_pieces WHERE upload_identifier = ?').bind(upload.identifier),
		uploadEvent(database, upload, 'Upload not accepted', null, reason)
	]);
}

export type PieceOutcome =
	| { accepted: true; received: number; pieceCount: number }
	| { accepted: false; reason: string };

/** Takes one piece of a file: checks it, hashes it and passes it to the bucket. */
export async function receivePiece(
	database: D1Database,
	bucket: R2Bucket,
	upload: UploadRow,
	number: number,
	bytes: Uint8Array
): Promise<PieceOutcome> {
	if (upload.status !== 'sending' || !upload.size_bytes || !upload.original_key || !upload.multipart_identifier) {
		throw new UploadProblem('This file is not waiting for pieces.', 409);
	}
	const count = pieceCount(upload.size_bytes);
	if (!Number.isInteger(number) || number < 1 || number > count) throw new UploadProblem('There is no such piece.', 404);
	if (bytes.byteLength !== expectedPieceSize(upload.size_bytes, number)) {
		throw new UploadProblem('This piece is not the size it should be. Choose the file again.');
	}

	let kind = upload.kind;
	let mediaType = upload.media_type;
	if (number === 1) {
		const type = checkFileType(bytes, upload.file_name ?? '');
		if (!type.accepted) {
			await refuseFile(database, bucket, upload, type.reason);
			return { accepted: false, reason: type.reason };
		}
		if (upload.size_bytes > largestFileBytes[type.kind]) {
			const reason = `${uploadKindLabels[type.kind]} files can be at most ${readableSize(largestFileBytes[type.kind])}.`;
			await refuseFile(database, bucket, upload, reason);
			return { accepted: false, reason };
		}
		if (upload.way_in === 'essay-figure' && type.kind === 'document') {
			const reason = 'An essay figure must be a picture, a sound recording or a video.';
			await refuseFile(database, bucket, upload, reason);
			return { accepted: false, reason };
		}
		kind = type.kind;
		mediaType = type.mediaType;
	} else if (!kind || !mediaType) {
		throw new UploadProblem('Send the first piece first.', 409);
	}

	const findings = findHiddenContent(mediaType!, bytes);
	const refusal = findings.find((finding) => finding.severity === 'refuse');
	if (refusal) {
		await refuseFile(database, bucket, upload, refusal.note, describeFindings(findings));
		return { accepted: false, reason: refusal.note };
	}

	const hash = await sha256Hex(bytes);
	const part = await bucket.resumeMultipartUpload(upload.original_key, upload.multipart_identifier).uploadPart(number, bytes);
	const statements: D1PreparedStatement[] = [
		database
			.prepare(
				`INSERT OR REPLACE INTO upload_pieces (upload_identifier, number, size_bytes, sha256, entity_tag, findings, received_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(upload.identifier, number, bytes.byteLength, hash, part.etag, describeFindings(findings), now())
	];
	if (number === 1) {
		statements.push(
			database
				.prepare(`UPDATE uploads SET kind = ?, media_type = ? WHERE identifier = ? AND status = 'sending'`)
				.bind(kind, mediaType, upload.identifier)
		);
	}
	await database.batch(statements);
	const received = await database
		.prepare('SELECT COUNT(*) AS count FROM upload_pieces WHERE upload_identifier = ?')
		.bind(upload.identifier)
		.first<{ count: number }>();
	return { accepted: true, received: received?.count ?? 0, pieceCount: count };
}

function describeFindings(findings: readonly PieceFinding[]): string | null {
	return findings.length === 0 ? null : findings.map((finding) => finding.note).join('\n');
}

/** Pieces that have arrived, for picking up after a stop. */
export async function receivedPieces(database: D1Database, upload: UploadRow): Promise<number[]> {
	const pieces = await database
		.prepare('SELECT number FROM upload_pieces WHERE upload_identifier = ? ORDER BY number')
		.bind(upload.identifier)
		.all<{ number: number }>();
	return pieces.results.map((row) => row.number);
}

/**
 * Joins the pieces once all have arrived, records the file's fingerprint and
 * what the checks found, and puts the file in line for a reviewer. An essay
 * figure is filed with its essay straight away.
 */
export async function finishUpload(database: D1Database, bucket: R2Bucket, upload: UploadRow): Promise<UploadStatus> {
	if (upload.status !== 'sending' || !upload.size_bytes || !upload.original_key || !upload.multipart_identifier) {
		throw new UploadProblem('This file is not waiting to be finished.', 409);
	}
	const pieces = await database
		.prepare('SELECT * FROM upload_pieces WHERE upload_identifier = ? ORDER BY number')
		.bind(upload.identifier)
		.all<PieceRow>();
	const count = pieceCount(upload.size_bytes);
	if (pieces.results.length !== count) {
		throw new UploadProblem(`Only ${pieces.results.length} of ${count} pieces have arrived.`, 409);
	}
	const total = pieces.results.reduce((sum, piece) => sum + piece.size_bytes, 0);
	if (total !== upload.size_bytes) throw new UploadProblem('The pieces do not add up to the file. Choose it again.', 409);

	await bucket
		.resumeMultipartUpload(upload.original_key, upload.multipart_identifier)
		.complete(pieces.results.map((piece) => ({ partNumber: piece.number, etag: piece.entity_tag })));

	const fingerprint = await fileFingerprint(pieces.results.map((piece) => piece.sha256));
	const notes = pieces.results
		.map((piece) => piece.findings)
		.filter((value): value is string => !!value)
		.join('\n');
	const checkResult: CheckResult = notes ? 'careful-look' : 'passed';

	let previewKey: string | null = null;
	if (upload.kind === 'picture' && upload.media_type && upload.size_bytes <= largestPreviewBytes) {
		const original = await bucket.get(upload.original_key);
		if (original) {
			const cleaned = pictureWithoutLocation(new Uint8Array(await original.arrayBuffer()), upload.media_type);
			if (cleaned) {
				previewKey = `uploads/${upload.identifier}/preview`;
				await bucket.put(previewKey, cleaned, { httpMetadata: { contentType: upload.media_type } });
			}
		}
	}

	const at = now();
	const figure = upload.way_in === 'essay-figure';
	const status: UploadStatus = figure ? 'filed' : 'waiting-for-review';
	await database.batch([
		database
			.prepare(
				`UPDATE uploads SET status = ?, fingerprint = ?, preview_key = ?, multipart_identifier = NULL,
				 check_result = ?, check_notes = ?, finished_at = ?, checked_at = ?,
				 destination = CASE WHEN way_in = 'essay-figure' THEN 'essay-figure' ELSE destination END,
				 filed_key = CASE WHEN way_in = 'essay-figure' THEN COALESCE(?, original_key) ELSE filed_key END,
				 decided_at = CASE WHEN way_in = 'essay-figure' THEN ? ELSE decided_at END
				 WHERE identifier = ? AND status = 'sending'`
			)
			.bind(status, fingerprint, previewKey, checkResult, notes || null, at, at, previewKey, at, upload.identifier),
		uploadEvent(
			database,
			upload,
			figure ? 'Essay figure received' : 'Upload received',
			null,
			checkResult === 'careful-look' ? 'needs a careful look' : null
		)
	]);
	return status;
}

/** Adds a YouTube video as an upload, with no file. */
export async function addYoutubeLink(
	database: D1Database,
	input: {
		accountIdentifier: string;
		personIdentifier?: string | null;
		link: string;
		groupIdentifier?: string;
		wayIn: WayIn;
		essayIdentifier?: string | null;
		answers?: SenderAnswers;
	},
	allowance: UploadAllowance
): Promise<{ reference: string; youtubeIdentifier: string }> {
	const youtubeIdentifier = youtubeVideoIdentifier(input.link);
	if (!youtubeIdentifier) throw new UploadProblem('That is not a link to a YouTube video.');
	if (input.wayIn === 'send-files' && !input.answers) throw new UploadProblem('Answer the questions about the video first.');
	await checkAllowance(database, input.accountIdentifier, allowance, 0);
	const identifier = newIdentifier();
	const reference = `U-${newRequestReference()}`;
	const at = now();
	const figure = input.wayIn === 'essay-figure';
	const answers = input.answers;
	await database.batch([
		database
			.prepare(
				`INSERT INTO uploads (
					identifier, reference, group_identifier, account_identifier, way_in, essay_identifier, kind, source, status,
					youtube_identifier, title, description, origin, origin_note, permitted_use, nation_first, sender_under_eighteen,
					described_at, check_result, destination, received_at, finished_at, checked_at, decided_at
				) VALUES (?, ?, ?, ?, ?, ?, 'video', 'youtube', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'passed', ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				reference,
				input.groupIdentifier ?? identifier,
				input.accountIdentifier,
				input.wayIn,
				input.essayIdentifier ?? null,
				figure ? 'filed' : 'waiting-for-review',
				youtubeIdentifier,
				answers?.title ?? null,
				...(answers ? answerColumns(answers) : [null, null, null, null, 0, 0]),
				answers ? at : null,
				figure ? 'essay-figure' : null,
				at,
				at,
				at,
				figure ? at : null
			),
		...linkStatements(database, identifier, answers?.nations ?? [], at),
		uploadEvent(database, { identifier, reference }, 'YouTube link received', input.personIdentifier ?? null, youtubeIdentifier)
	]);
	return { reference, youtubeIdentifier };
}

export interface SenderUpload {
	reference: string;
	kind: UploadKind | null;
	source: UploadSource;
	status: UploadStatus;
	name: string;
	sizeBytes: number | null;
	receivedAt: string;
	reason: string | null;
	youtubeIdentifier: string | null;
	/** Questions and answers, oldest first; reviewers' private notes are left out. */
	messages: { kind: 'question' | 'answer'; body: string; createdAt: string }[];
}

/** What one account has sent, newest first, for Your uploads. */
export async function uploadsOfAccount(database: D1Database, accountIdentifier: string): Promise<SenderUpload[]> {
	const rows = await database
		.prepare(
			`SELECT * FROM uploads WHERE account_identifier = ? AND way_in = 'send-files' ORDER BY received_at DESC LIMIT 500`
		)
		.bind(accountIdentifier)
		.all<UploadRow>();
	const messages = await database
		.prepare(
			`SELECT upload_messages.upload_identifier AS upload, upload_messages.kind, upload_messages.body,
			        upload_messages.created_at AS createdAt
			 FROM upload_messages JOIN uploads ON uploads.identifier = upload_messages.upload_identifier
			 WHERE uploads.account_identifier = ? AND upload_messages.kind IN ('question', 'answer')
			 ORDER BY upload_messages.created_at`
		)
		.bind(accountIdentifier)
		.all<{ upload: string; kind: 'question' | 'answer'; body: string; createdAt: string }>();
	return rows.results.map((row) => ({
		reference: row.reference,
		kind: row.kind,
		source: row.source,
		status: row.status,
		name: row.title ?? row.file_name ?? 'YouTube video',
		sizeBytes: row.size_bytes,
		receivedAt: row.received_at,
		reason: row.status === 'not-used' || row.status === 'not-accepted' ? row.decision_reason : null,
		youtubeIdentifier: row.youtube_identifier,
		messages: messages.results
			.filter((message) => message.upload === row.identifier)
			.map(({ kind, body, createdAt }) => ({ kind, body, createdAt }))
	}));
}

async function deleteBytes(bucket: R2Bucket, upload: UploadRow): Promise<void> {
	if (upload.multipart_identifier && upload.original_key) {
		await bucket
			.resumeMultipartUpload(upload.original_key, upload.multipart_identifier)
			.abort()
			.catch(() => undefined);
	}
	const keys = [upload.original_key, upload.preview_key].filter((key): key is string => !!key);
	if (keys.length > 0) await bucket.delete(keys);
}

/** The sender takes a file back. Its bytes are deleted at once. */
export async function withdrawUpload(database: D1Database, bucket: R2Bucket, upload: UploadRow): Promise<void> {
	if (!withdrawableStatuses.includes(upload.status)) {
		throw new UploadProblem('This file can no longer be withdrawn. Write to us and we will help.', 409);
	}
	await deleteBytes(bucket, upload);
	const at = now();
	await database.batch([
		database
			.prepare(
				`UPDATE uploads SET status = 'withdrawn', multipart_identifier = NULL, withdrawn_at = ?, deleted_at = ? WHERE identifier = ?`
			)
			.bind(at, at, upload.identifier),
		database.prepare('DELETE FROM upload_pieces WHERE upload_identifier = ?').bind(upload.identifier),
		uploadEvent(database, upload, 'Upload withdrawn by the sender')
	]);
}

/** The sender answers a reviewer's question; the file goes back to the reviewer. */
export async function answerQuestion(database: D1Database, upload: UploadRow, body: string): Promise<void> {
	if (upload.status !== 'needs-answer') throw new UploadProblem('Nobody is waiting for an answer about this file.', 409);
	await database.batch([
		database
			.prepare(
				`INSERT INTO upload_messages (identifier, upload_identifier, kind, person_identifier, body, created_at)
				 VALUES (?, ?, 'answer', NULL, ?, ?)`
			)
			.bind(newIdentifier(), upload.identifier, body, now()),
		database.prepare(`UPDATE uploads SET status = 'in-review' WHERE identifier = ?`).bind(upload.identifier),
		uploadEvent(database, upload, 'Sender answered')
	]);
}

export const queueViews = ['open', 'waiting', 'decided', 'not-accepted', 'all'] as const;
export type QueueView = (typeof queueViews)[number];

const viewStatuses: Record<QueueView, readonly UploadStatus[] | null> = {
	open: ['waiting-for-review', 'in-review'],
	waiting: ['needs-answer', 'waiting-for-nation'],
	decided: decidedStatuses,
	'not-accepted': ['not-accepted', 'withdrawn'],
	all: null
};

export interface QueueRow {
	reference: string;
	groupIdentifier: string;
	kind: UploadKind | null;
	source: UploadSource;
	status: UploadStatus;
	name: string;
	sizeBytes: number | null;
	checkResult: CheckResult | null;
	/** Empty once the sender deleted their account. */
	senderEmail: string | null;
	senderName: string | null;
	reviewerName: string | null;
	receivedAt: string;
	nations: string[];
}

/** The workspace queue: files sent on the Send files page, oldest first while open. */
export async function uploadQueue(
	database: D1Database,
	view: QueueView,
	kind: UploadKind | null = null
): Promise<QueueRow[]> {
	const statuses = viewStatuses[view];
	const conditions = [`uploads.way_in = 'send-files'`, `uploads.status <> 'sending'`];
	const values: (string | number)[] = [];
	if (statuses) {
		conditions.push(`uploads.status IN (${statuses.map(() => '?').join(', ')})`);
		values.push(...statuses);
	}
	if (kind) {
		conditions.push('uploads.kind = ?');
		values.push(kind);
	}
	const order = view === 'open' || view === 'waiting' ? 'ASC' : 'DESC';
	const rows = await database
		.prepare(
			`SELECT uploads.reference, uploads.group_identifier AS groupIdentifier, uploads.kind, uploads.source,
			        uploads.status, COALESCE(uploads.title, uploads.file_name, 'YouTube video') AS name,
			        uploads.size_bytes AS sizeBytes, uploads.check_result AS checkResult, accounts.email AS senderEmail,
			        TRIM(COALESCE(profiles.given_name, '') || ' ' || COALESCE(profiles.family_name, '')) AS senderName,
			        reviewers.display_name AS reviewerName, uploads.received_at AS receivedAt,
			        (SELECT GROUP_CONCAT(target_identifier, ' ') FROM upload_links
			         WHERE upload_identifier = uploads.identifier AND target_kind = 'nation') AS nations
			 FROM uploads
			 LEFT JOIN accounts ON accounts.identifier = uploads.account_identifier
			 LEFT JOIN contributor_profiles AS profiles ON profiles.sign_in_subject = uploads.account_identifier
			 LEFT JOIN people AS reviewers ON reviewers.identifier = uploads.reviewer_identifier
			 WHERE ${conditions.join(' AND ')}
			 ORDER BY uploads.received_at ${order} LIMIT 500`
		)
		.bind(...values)
		.all<Omit<QueueRow, 'nations' | 'senderName'> & { nations: string | null; senderName: string }>();
	return rows.results.map((row) => ({
		...row,
		senderName: row.senderName || null,
		nations: row.nations ? row.nations.split(' ') : []
	}));
}

/** How many files are in each view, for the tabs on the queue. */
export async function queueCounts(database: D1Database): Promise<Record<QueueView, number>> {
	const rows = await database
		.prepare(
			`SELECT status, COUNT(*) AS count FROM uploads WHERE way_in = 'send-files' AND status <> 'sending' GROUP BY status`
		)
		.all<{ status: UploadStatus; count: number }>();
	const counts = { open: 0, waiting: 0, decided: 0, 'not-accepted': 0, all: 0 } as Record<QueueView, number>;
	for (const row of rows.results) {
		counts.all += row.count;
		for (const view of ['open', 'waiting', 'decided', 'not-accepted'] as const) {
			if (viewStatuses[view]!.includes(row.status)) counts[view] += row.count;
		}
	}
	return counts;
}

export interface UploadDetail {
	upload: UploadRow;
	/** Empty once the sender deleted their account. */
	senderEmail: string | null;
	senderName: string | null;
	reviewerName: string | null;
	pieces: PieceRow[];
	links: LinkRow[];
	messages: MessageRow[];
	/** Other files sent in the same group. */
	group: { reference: string; name: string; status: UploadStatus }[];
	/** Earlier files with the same fingerprint. */
	sameFile: { reference: string; status: UploadStatus }[];
}

/** Everything a reviewer sees about one upload. */
export async function uploadDetail(database: D1Database, reference: string): Promise<UploadDetail | null> {
	const upload = await uploadByReference(database, reference);
	if (!upload) return null;
	const [sender, reviewer, pieces, links, messages, group, sameFile] = await Promise.all([
		database
			.prepare(
				`SELECT accounts.email,
				        TRIM(COALESCE(profiles.given_name, '') || ' ' || COALESCE(profiles.family_name, '')) AS name
				 FROM accounts LEFT JOIN contributor_profiles AS profiles ON profiles.sign_in_subject = accounts.identifier
				 WHERE accounts.identifier = ?`
			)
			.bind(upload.account_identifier)
			.first<{ email: string; name: string }>(),
		upload.reviewer_identifier
			? database
					.prepare('SELECT display_name AS name FROM people WHERE identifier = ?')
					.bind(upload.reviewer_identifier)
					.first<{ name: string }>()
			: Promise.resolve(null),
		database
			.prepare('SELECT * FROM upload_pieces WHERE upload_identifier = ? ORDER BY number')
			.bind(upload.identifier)
			.all<PieceRow>(),
		database
			.prepare(
				'SELECT target_kind, target_identifier, added_by FROM upload_links WHERE upload_identifier = ? ORDER BY added_at'
			)
			.bind(upload.identifier)
			.all<LinkRow>(),
		database
			.prepare(
				`SELECT upload_messages.identifier, kind, body, created_at, people.display_name AS person_name
				 FROM upload_messages LEFT JOIN people ON people.identifier = upload_messages.person_identifier
				 WHERE upload_identifier = ? ORDER BY created_at`
			)
			.bind(upload.identifier)
			.all<MessageRow>(),
		database
			.prepare(
				`SELECT reference, COALESCE(title, file_name, 'YouTube video') AS name, status FROM uploads
				 WHERE group_identifier = ? AND identifier <> ? ORDER BY received_at`
			)
			.bind(upload.group_identifier, upload.identifier)
			.all<{ reference: string; name: string; status: UploadStatus }>(),
		upload.fingerprint
			? database
					.prepare('SELECT reference, status FROM uploads WHERE fingerprint = ? AND identifier <> ? ORDER BY received_at')
					.bind(upload.fingerprint, upload.identifier)
					.all<{ reference: string; status: UploadStatus }>()
			: Promise.resolve({ results: [] as { reference: string; status: UploadStatus }[] })
	]);
	return {
		upload,
		senderEmail: sender?.email ?? null,
		senderName: sender?.name || null,
		reviewerName: reviewer?.name ?? null,
		pieces: pieces.results,
		links: links.results,
		messages: messages.results,
		group: group.results,
		sameFile: sameFile.results
	};
}

function mustBeUnderReview(upload: UploadRow): void {
	const reviewable: readonly UploadStatus[] = ['waiting-for-review', 'in-review', 'needs-answer', 'waiting-for-nation'];
	if (!reviewable.includes(upload.status)) {
		throw new UploadProblem('This file is not waiting for review.', 409);
	}
}

/** A reviewer takes the file. */
export async function claimUpload(database: D1Database, person: SignedInPerson, upload: UploadRow): Promise<void> {
	mustBeUnderReview(upload);
	await database.batch([
		database
			.prepare(`UPDATE uploads SET status = 'in-review', reviewer_identifier = ? WHERE identifier = ?`)
			.bind(person.identifier, upload.identifier),
		uploadEvent(database, upload, 'Review started', person.identifier)
	]);
}

/** A reviewer asks the sender a question, or writes a note other reviewers see. */
export async function addUploadMessage(
	database: D1Database,
	person: SignedInPerson,
	upload: UploadRow,
	kind: 'question' | 'note',
	body: string
): Promise<void> {
	if (kind === 'question') mustBeUnderReview(upload);
	const statements: D1PreparedStatement[] = [
		database
			.prepare(
				`INSERT INTO upload_messages (identifier, upload_identifier, kind, person_identifier, body, created_at)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.bind(newIdentifier(), upload.identifier, kind, person.identifier, body, now()),
		uploadEvent(database, upload, kind === 'question' ? 'Question sent to the sender' : 'Note added', person.identifier)
	];
	if (kind === 'question') {
		statements.push(
			database
				.prepare(`UPDATE uploads SET status = 'needs-answer', reviewer_identifier = ? WHERE identifier = ?`)
				.bind(person.identifier, upload.identifier)
		);
	}
	await database.batch(statements);
}

// ---------------------------------------------------------------------------
// Comments from the nation (decision record 0038): a nation reviewer reads
// the files linked to their nation and comments on them; only the project's
// reviewers file them. The nation sees what was sent and why, not who sent it.
// ---------------------------------------------------------------------------

/** What a nation sees: the file arrived and is not withdrawn, refused or deleted. */
const nationVisibleStatuses: readonly UploadStatus[] = [
	'waiting-for-review',
	'in-review',
	'needs-answer',
	'waiting-for-nation',
	'filed',
	'kept-for-reference',
	'not-used'
];

/**
 * The nation a person comments for on uploads, or null. Today that is a
 * nation reviewer's own nation, unless the lead author lowered their access
 * to it below comment.
 */
export async function nationSpokenFor(database: D1Database, person: SignedInPerson): Promise<string | null> {
	if (!can(person, 'comment-on-nation-uploads') || !person.nationIdentifier) return null;
	const access = await accessTo(database, person, { kind: 'nation', identifier: person.nationIdentifier });
	return atLeast(access.level, 'comment') ? person.nationIdentifier : null;
}

const nationUploadFilter = `uploads.status IN (${nationVisibleStatuses.map((status) => `'${status}'`).join(', ')})
	AND uploads.deleted_at IS NULL
	AND EXISTS (
		SELECT 1 FROM upload_links
		WHERE upload_links.upload_identifier = uploads.identifier
		  AND upload_links.target_kind = 'nation' AND upload_links.target_identifier = ?
	)`;

export interface NationUploadItem {
	reference: string;
	name: string;
	kind: UploadKind | null;
	source: 'file' | 'youtube';
	sizeBytes: number | null;
	status: UploadStatus;
	receivedAt: string;
	comments: number;
}

/** The files people sent about the person's nation, newest first. */
export async function nationUploads(database: D1Database, person: SignedInPerson): Promise<NationUploadItem[]> {
	const nation = await nationSpokenFor(database, person);
	if (!nation) return [];
	const rows = await database
		.prepare(
			`SELECT uploads.reference, COALESCE(uploads.title, uploads.file_name, 'YouTube video') AS name, uploads.kind,
			        uploads.source, uploads.size_bytes AS sizeBytes, uploads.status, uploads.received_at AS receivedAt,
			        (SELECT COUNT(*) FROM upload_messages
			         WHERE upload_messages.upload_identifier = uploads.identifier AND upload_messages.kind = 'nation-comment') AS comments
			 FROM uploads WHERE ${nationUploadFilter}
			 ORDER BY uploads.received_at DESC`
		)
		.bind(nation)
		.all<NationUploadItem>();
	return rows.results;
}

/** One upload as its nation sees it, or null when the person may not see it. */
export async function nationUpload(
	database: D1Database,
	person: SignedInPerson,
	reference: string
): Promise<{ upload: UploadRow; nation: string; comments: MessageRow[] } | null> {
	const nation = await nationSpokenFor(database, person);
	if (!nation) return null;
	const upload = await database
		.prepare(`SELECT * FROM uploads WHERE reference = ? AND ${nationUploadFilter}`)
		.bind(reference, nation)
		.first<UploadRow>();
	if (!upload) return null;
	const comments = await database
		.prepare(
			`SELECT upload_messages.identifier, kind, body, created_at, people.display_name AS person_name
			 FROM upload_messages LEFT JOIN people ON people.identifier = upload_messages.person_identifier
			 WHERE upload_identifier = ? AND kind = 'nation-comment' ORDER BY created_at`
		)
		.bind(upload.identifier)
		.all<MessageRow>();
	return { upload, nation, comments: comments.results };
}

/** A nation reviewer comments on an upload about their nation. Reviewers see it with the upload. */
export async function addNationComment(
	database: D1Database,
	person: SignedInPerson,
	upload: UploadRow,
	body: string
): Promise<void> {
	if (!(await nationUpload(database, person, upload.reference))) {
		throw new UploadProblem('You can comment only on files about your nation.', 403);
	}
	await database.batch([
		database
			.prepare(
				`INSERT INTO upload_messages (identifier, upload_identifier, kind, person_identifier, body, created_at)
				 VALUES (?, ?, 'nation-comment', ?, ?, ?)`
			)
			.bind(newIdentifier(), upload.identifier, person.identifier, body, now()),
		uploadEvent(database, upload, 'Comment from the nation', person.identifier)
	]);
}

/** The file waits until the nation has seen it. */
export async function waitForNation(database: D1Database, person: SignedInPerson, upload: UploadRow): Promise<void> {
	mustBeUnderReview(upload);
	await database.batch([
		database
			.prepare(`UPDATE uploads SET status = 'waiting-for-nation', reviewer_identifier = ? WHERE identifier = ?`)
			.bind(person.identifier, upload.identifier),
		uploadEvent(database, upload, 'Waiting for the nation', person.identifier)
	]);
}

export interface Filing {
	destination: Destination;
	filedPage: string | null;
	caption: string | null;
	credit: string | null;
	alternativeText: string | null;
	transcript: string | null;
	accessLevel: FiledAccessLevel;
	embargoedUntil: string | null;
	filingIdentifier: string | null;
	nations: string[];
}

export type FilingErrors = Partial<Record<keyof Filing, string>>;

/** Reads the Review and file form. */
export function readFiling(
	form: FormData,
	isNation: (identifier: string) => boolean = () => true
): { ok: true; filing: Filing } | { ok: false; errors: FilingErrors } {
	const text = (name: string, maximum = 2000) => {
		const value = form.get(name);
		if (typeof value !== 'string') return null;
		const trimmed = value.normalize('NFC').trim().slice(0, maximum);
		return trimmed === '' ? null : trimmed;
	};
	const errors: FilingErrors = {};
	const destination = form.get('destination');
	if (!isOneOf(destinations, destination)) errors.destination = 'Choose where it goes.';
	const accessLevel = form.get('accessLevel');
	if (!isOneOf(filedAccessLevels, accessLevel)) errors.accessLevel = 'Choose who can see it.';
	const embargoedUntil = text('embargoedUntil', 10);
	if (accessLevel === 'embargoed' && !(embargoedUntil && /^\d{4}-\d{2}-\d{2}$/.test(embargoedUntil))) {
		errors.embargoedUntil = 'Give the date it can be shown.';
	}
	const filingIdentifier = text('filingIdentifier', 20);
	if (filingIdentifier && !/^filing-\d{4}-\d{4}$/.test(filingIdentifier)) {
		errors.filingIdentifier = 'A filing number looks like filing-2026-0001.';
	}
	const filedPage = text('filedPage', 300);
	if (filedPage && !/^[a-z0-9][a-z0-9/-]*$/.test(filedPage)) {
		errors.filedPage = 'Give the page’s address after the site name, such as nations/hopi-tribe.';
	}
	const nations = [...new Set(form.getAll('nations').filter((value): value is string => typeof value === 'string' && value !== ''))];
	if (nations.some((identifier) => !isNation(identifier))) errors.nations = 'Choose nations from the list.';
	const alternativeText = text('alternativeText', 1000);
	if (
		(destination === 'nation-picture' || destination === 'essay-figure') &&
		accessLevel === 'public' &&
		!alternativeText
	) {
		errors.alternativeText = 'Describe the picture for people who cannot see it.';
	}
	if (Object.keys(errors).length > 0) return { ok: false, errors };
	return {
		ok: true,
		filing: {
			destination: destination as Destination,
			filedPage,
			caption: text('caption'),
			credit: text('credit', 500),
			alternativeText,
			transcript: text('transcript', 100_000),
			accessLevel: accessLevel as FiledAccessLevel,
			embargoedUntil: accessLevel === 'embargoed' ? embargoedUntil : null,
			filingIdentifier,
			nations
		}
	};
}

/**
 * Files an upload. The file stays where it is in the bucket; a picture is
 * filed as its copy without location details, other files as sent.
 */
export async function fileUpload(
	database: D1Database,
	person: SignedInPerson,
	upload: UploadRow,
	filing: Filing
): Promise<void> {
	mustBeUnderReview(upload);
	if (upload.permitted_use === 'background-only' && filing.accessLevel === 'public') {
		throw new UploadProblem('The sender said these files are background only, so they cannot be shown to everyone.');
	}
	const at = now();
	await database.batch([
		database
			.prepare(
				`UPDATE uploads SET status = 'filed', reviewer_identifier = ?, destination = ?, filed_page = ?, caption = ?,
				 credit = ?, alternative_text = ?, transcript = ?, access_level = ?, embargoed_until = ?, filing_identifier = ?,
				 filed_key = COALESCE(preview_key, original_key), decided_at = ?
				 WHERE identifier = ?`
			)
			.bind(
				person.identifier,
				filing.destination,
				filing.filedPage,
				filing.caption,
				filing.credit,
				filing.alternativeText,
				filing.transcript,
				filing.accessLevel,
				filing.embargoedUntil,
				filing.filingIdentifier,
				at,
				upload.identifier
			),
		...filing.nations.map((nation) =>
			database
				.prepare(
					`INSERT OR IGNORE INTO upload_links (upload_identifier, target_kind, target_identifier, added_by, added_at)
					 VALUES (?, 'nation', ?, 'reviewer', ?)`
				)
				.bind(upload.identifier, nation, at)
		),
		uploadEvent(database, upload, 'Upload filed', person.identifier, `${filing.destination}, ${filing.accessLevel}`)
	]);
}

/**
 * Sets the words spoken in a recording or video, for an essay figure from the
 * essay editor or a filed upload. The caller checks the person may change it.
 */
export async function setTranscript(
	database: D1Database,
	person: SignedInPerson,
	upload: UploadRow,
	transcript: string | null
): Promise<void> {
	if (upload.kind !== 'sound' && upload.kind !== 'video') throw new UploadProblem('Only recordings and videos have a transcript.');
	await database.batch([
		database.prepare('UPDATE uploads SET transcript = ? WHERE identifier = ?').bind(transcript, upload.identifier),
		uploadEvent(database, upload, transcript ? 'Transcript saved' : 'Transcript removed', person.identifier)
	]);
}

/** Kept privately as background for research; never shown on the site. */
export async function keepForReference(
	database: D1Database,
	person: SignedInPerson,
	upload: UploadRow,
	note: string | null
): Promise<void> {
	mustBeUnderReview(upload);
	const at = now();
	await database.batch([
		database
			.prepare(
				`UPDATE uploads SET status = 'kept-for-reference', reviewer_identifier = ?, destination = 'research-library',
				 access_level = 'restricted', filed_key = original_key, decided_at = ? WHERE identifier = ?`
			)
			.bind(person.identifier, at, upload.identifier),
		uploadEvent(database, upload, 'Kept for reference', person.identifier, note)
	]);
}

/** Not used. The sender sees the reason; the file is deleted after 30 days. */
export async function declineUpload(
	database: D1Database,
	person: SignedInPerson,
	upload: UploadRow,
	reason: string
): Promise<void> {
	mustBeUnderReview(upload);
	const at = now();
	await database.batch([
		database
			.prepare(
				`UPDATE uploads SET status = 'not-used', reviewer_identifier = ?, decision_reason = ?, decided_at = ? WHERE identifier = ?`
			)
			.bind(person.identifier, reason, at, upload.identifier),
		uploadEvent(database, upload, 'Not used', person.identifier, reason)
	]);
}

/** A reviewer puts a decided file back in the queue, for example after a mistake. */
export async function reopenUpload(database: D1Database, person: SignedInPerson, upload: UploadRow): Promise<void> {
	if (!decidedStatuses.includes(upload.status) || upload.deleted_at) {
		throw new UploadProblem('Only a filed, kept or declined file whose bytes are still here can be reopened.', 409);
	}
	await database.batch([
		database
			.prepare(
				`UPDATE uploads SET status = 'in-review', reviewer_identifier = ?, decided_at = NULL, filed_key = NULL WHERE identifier = ?`
			)
			.bind(person.identifier, upload.identifier),
		uploadEvent(database, upload, 'Reopened', person.identifier)
	]);
}

/**
 * Deletes the bytes of files declined more than 30 days ago, and gives up
 * files that stopped arriving more than 7 days ago (the bucket drops
 * unfinished pieces after 7 days by default; Cloudflare R2, "Object
 * lifecycles", https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
 * The rows stay, so the sender and the activity log still show what happened.
 */
export async function deleteOldUploads(database: D1Database, bucket: R2Bucket, limit = 50): Promise<number> {
	const declinedBefore = new Date(Date.now() - keepDeclinedDays * 24 * 60 * 60 * 1000).toISOString();
	const startedBefore = new Date(Date.now() - unfinishedDays * 24 * 60 * 60 * 1000).toISOString();
	const declined = await database
		.prepare(
			`SELECT * FROM uploads WHERE status = 'not-used' AND deleted_at IS NULL AND decided_at < ? LIMIT ?`
		)
		.bind(declinedBefore, limit)
		.all<UploadRow>();
	for (const upload of declined.results) {
		await deleteBytes(bucket, upload);
		await database.batch([
			database.prepare('UPDATE uploads SET deleted_at = ? WHERE identifier = ?').bind(now(), upload.identifier),
			database.prepare('DELETE FROM upload_pieces WHERE upload_identifier = ?').bind(upload.identifier),
			uploadEvent(database, upload, 'File deleted', null, `${keepDeclinedDays} days after it was not used`)
		]);
	}
	const unfinished = await database
		.prepare(`SELECT * FROM uploads WHERE status = 'sending' AND received_at < ? LIMIT ?`)
		.bind(startedBefore, limit)
		.all<UploadRow>();
	for (const upload of unfinished.results) {
		await refuseFile(database, bucket, upload, `It did not finish arriving within ${unfinishedDays} days.`);
	}
	return declined.results.length + unfinished.results.length;
}

/**
 * When someone deletes their account: files filed or kept for reference stay,
 * no longer tied to the account; everything else they sent is deleted, bytes
 * and rows. Call it before the account row is deleted.
 */
export async function forgetAccountUploads(
	database: D1Database,
	bucket: R2Bucket,
	accountIdentifier: string
): Promise<{ deleted: number; kept: number }> {
	const rows = await database
		.prepare('SELECT * FROM uploads WHERE account_identifier = ?')
		.bind(accountIdentifier)
		.all<UploadRow>();
	const keep = rows.results.filter((upload) => upload.status === 'filed' || upload.status === 'kept-for-reference');
	const remove = rows.results.filter((upload) => !keep.includes(upload));
	for (const upload of remove) await deleteBytes(bucket, upload);
	const statements: D1PreparedStatement[] = [];
	for (const upload of remove) {
		statements.push(
			database.prepare('DELETE FROM uploads WHERE identifier = ?').bind(upload.identifier),
			uploadEvent(database, upload, 'Deleted with the sender’s account')
		);
	}
	for (const upload of keep) {
		statements.push(
			database.prepare('UPDATE uploads SET account_identifier = NULL WHERE identifier = ?').bind(upload.identifier),
			uploadEvent(database, upload, 'Kept after the sender deleted their account')
		);
	}
	if (statements.length > 0) await database.batch(statements);
	return { deleted: remove.length, kept: keep.length };
}

/**
 * Whether a signed-in person may see a filed file that is not yet public:
 * reviewers always, and, for an essay figure, anyone with at least comment
 * access to its essay, so co-authors see figures while drafting.
 */
export async function maySeeFiledFile(
	database: D1Database,
	person: SignedInPerson | undefined,
	upload: UploadRow
): Promise<boolean> {
	if (!person) return false;
	if (can(person, 'review-uploads')) return true;
	if (upload.way_in !== 'essay-figure' || !upload.essay_identifier) return false;
	const access = await accessTo(database, person, { kind: 'essay', identifier: upload.essay_identifier });
	return atLeast(access.level, 'comment');
}

/** Whether anyone may see a filed file: public, or embargoed and past its date, or a figure of a published essay. */
export async function isPublicFile(database: D1Database, upload: UploadRow): Promise<boolean> {
	if (upload.status !== 'filed' || !upload.filed_key || upload.deleted_at) return false;
	if (upload.way_in === 'essay-figure') {
		const published = await database
			.prepare('SELECT 1 AS found FROM essay_publications WHERE essay_identifier = ? AND listed = 1 LIMIT 1')
			.bind(upload.essay_identifier)
			.first<{ found: number }>();
		return !!published;
	}
	if (upload.access_level === 'public') return true;
	if (upload.access_level === 'embargoed' && upload.embargoed_until) {
		return upload.embargoed_until <= now().slice(0, 10);
	}
	return false;
}
