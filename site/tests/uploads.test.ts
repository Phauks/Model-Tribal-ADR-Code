import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { deleteAccount } from '#lib/server/account-deletion.ts';
import { allowances, pieceBytes, refusedByName } from '#lib/uploads.ts';
import { eventsFor } from '#lib/server/events.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { fileFingerprint, sha256Hex } from '#lib/server/upload-checks.ts';
import {
	addUploadMessage,
	addYoutubeLink,
	answerQuestion,
	claimUpload,
	declineUpload,
	deleteOldUploads,
	fileUpload,
	finishUpload,
	forgetAccountUploads,
	maySeeFiledFile,
	isPublicFile,
	readAnswers,
	receivePiece,
	startUpload,
	uploadByReference,
	uploadQueue,
	queueCounts,
	queueNations,
	uploadsOfAccount,
	withdrawUpload,
	addNationComment,
	releaseUnchecked,
	scanOfKey,
	advanceCheckedUploads,
	nationUpload,
	nationUploads,
	nationSpokenFor,
	uploadDetail,
	settlePulledFiles,
	intakeFilesOf,
	isCaptureKey,
	scanBadgeFor,
	UploadProblem,
	type Filing,
	type SenderAnswers
} from '#lib/server/uploads.ts';
import { setGrant } from '#lib/server/access.ts';
import { serveUploadFile } from '#lib/server/upload-serving.ts';
import { testDatabase } from './database.ts';

/** A stand-in for the R2 bucket binding, with multipart uploads. */
function fakeBucket() {
	const stored = new Map<string, Uint8Array>();
	const unfinished = new Map<string, { key: string; parts: Map<number, Uint8Array> }>();
	const handle = (key: string, uploadId: string) => ({
		key,
		uploadId,
		async uploadPart(partNumber: number, value: Uint8Array) {
			const upload = unfinished.get(uploadId);
			if (!upload) throw new Error('No such multipart upload');
			upload.parts.set(partNumber, new Uint8Array(value));
			return { partNumber, etag: `etag-${partNumber}` };
		},
		async complete(parts: { partNumber: number; etag: string }[]) {
			const upload = unfinished.get(uploadId);
			if (!upload) throw new Error('No such multipart upload');
			const pieces = parts.map((part) => upload.parts.get(part.partNumber)!);
			const joined = new Uint8Array(pieces.reduce((sum, piece) => sum + piece.length, 0));
			let offset = 0;
			for (const piece of pieces) {
				joined.set(piece, offset);
				offset += piece.length;
			}
			stored.set(key, joined);
			unfinished.delete(uploadId);
		},
		async abort() {
			unfinished.delete(uploadId);
		}
	});
	const bucket = {
		async createMultipartUpload(key: string) {
			const uploadId = crypto.randomUUID();
			unfinished.set(uploadId, { key, parts: new Map() });
			return handle(key, uploadId);
		},
		resumeMultipartUpload: (key: string, uploadId: string) => handle(key, uploadId),
		async put(key: string, value: Uint8Array | string) {
			stored.set(key, typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value));
		},
		async get(key: string) {
			const value = stored.get(key);
			return value
				? { size: value.length, arrayBuffer: async () => value.slice().buffer, text: async () => new TextDecoder().decode(value) }
				: null;
		},
		async head(key: string) {
			const value = stored.get(key);
			return value ? { key, size: value.length } : null;
		},
		async list(options: { prefix?: string; limit?: number }) {
			const keys = [...stored.keys()].filter((key) => key.startsWith(options.prefix ?? '')).sort();
			return { objects: keys.slice(0, options.limit ?? 1000).map((key) => ({ key, size: stored.get(key)!.length })), truncated: false };
		},
		async delete(keys: string[]) {
			for (const key of keys) stored.delete(key);
		}
	};
	return { bucket: bucket as unknown as R2Bucket, stored, unfinished };
}

const answers: SenderAnswers = {
	title: null,
	description: 'Rules of the peacemaker court, 1987',
	origin: 'own-work',
	originNote: null,
	permittedUse: 'publish-in-full',
	nationFirst: false,
	underEighteen: false,
	nations: ['navajo-nation']
};

const filing: Filing = {
	destination: 'nation-picture',
	filedPage: 'nations/navajo-nation',
	caption: 'The chapter house',
	credit: 'Sent by a contributor',
	alternativeText: 'A low stone building',
	transcript: null,
	accessLevel: 'public',
	embargoedUntil: null,
	filingIdentifier: null,
	nations: []
};

// A small PNG with a text chunk that should not survive into the copy. A different text makes a different file.
function png(text = 'GPS'): Uint8Array {
	const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...new TextEncoder().encode(type), ...data, 0, 0, 0, 0];
	return new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
		...chunk('tEXt', [...new TextEncoder().encode(text)]),
		...chunk('IEND', [])
	]);
}

let database: D1Database;
let fake: ReturnType<typeof fakeBucket>;
let reviewer: SignedInPerson;
const sender = 'account-sender';

beforeEach(async () => {
	database = testDatabase();
	fake = fakeBucket();
	await database
		.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, ?, ?)`)
		.bind(sender, 'sender@example.org', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z')
		.run();
	const result = await matchSignIn(
		database,
		{ subject: 'account-lead', email: 'lead@example.org', emailVerified: true, name: 'Lead' },
		'lead@example.org'
	);
	if (result.outcome !== 'signed-in') throw new Error('not signed in');
	reviewer = result.person;
});

async function sendWhole(
	bytes: Uint8Array,
	fileName: string,
	extra: Partial<SenderAnswers> = {},
	passScan = true,
	accountIdentifier = sender
) {
	const started = await startUpload(
		database,
		fake.bucket,
		{ accountIdentifier, groupIdentifier: crypto.randomUUID(), fileName, sizeBytes: bytes.length, wayIn: 'send-files', answers: { ...answers, ...extra } },
		allowances.unlimited
	);
	for (let number = 1; number <= started.pieceCount; number++) {
		const piece = bytes.subarray((number - 1) * pieceBytes, Math.min(number * pieceBytes, bytes.length));
		const outcome = await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, number, piece);
		if (!outcome.accepted) return { reference: started.reference, refused: outcome.reason };
	}
	try {
		await finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);
	} catch (problem) {
		if (problem instanceof UploadProblem) return { reference: started.reference, refused: problem.message };
		throw problem;
	}
	if (passScan) await scanned(started.reference, 'clean');
	return { reference: started.reference, refused: null };
}

/** Stands in for the scanner: writes a result for every copy of the upload, then lets the site move it on. */
async function scanned(reference: string, status: 'clean' | 'flagged' | 'cannot-scan', reason: string | null = null) {
	const upload = (await uploadByReference(database, reference))!;
	await database
		.prepare(`UPDATE file_scans SET status = ?, reason = ?, finished_at = ? WHERE subject = ?`)
		.bind(status, reason, '2026-11-23T00:00:00Z', upload.reference)
		.run();
	await advanceCheckedUploads(database, fake.bucket);
}

describe('sending files', () => {
	it('takes a picture, checks it, makes a copy without hidden details and puts it in line', async () => {
		const bytes = png();
		const { reference } = await sendWhole(bytes, 'chapter-house.png');
		const upload = (await uploadByReference(database, reference))!;
		expect(upload).toMatchObject({ status: 'waiting-for-review', kind: 'picture', media_type: 'image/png', check_result: 'passed' });
		expect(upload.fingerprint).toBe(await sha256Hex(bytes));
		expect(fake.stored.get(upload.original_key!)).toEqual(bytes);
		const preview = fake.stored.get(upload.preview_key!)!;
		expect(new TextDecoder('latin1').decode(preview)).not.toContain('tEXt');
		const history = await eventsFor(database, 'upload', upload.identifier);
		expect(history.map((event) => event.action)).toEqual(['Upload started', 'Upload received', 'Virus check passed']);
		expect((await uploadQueue(database, 'open')).map((row) => row.reference)).toEqual([reference]);
	});

	it('sends a large video in pieces, picks up after a stop and fingerprints the pieces', async () => {
		const bytes = new Uint8Array(pieceBytes + 1000);
		bytes.set([0, 0, 0, 0x20, ...new TextEncoder().encode('ftypisom')]);
		const input = { accountIdentifier: sender, groupIdentifier: crypto.randomUUID(), fileName: 'talk.mp4', sizeBytes: bytes.length, wayIn: 'send-files' as const, answers };
		const started = await startUpload(database, fake.bucket, input, allowances.unlimited);
		expect(started.pieceCount).toBe(2);
		await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 1, bytes.subarray(0, pieceBytes));

		// The page was closed; choosing the same file again picks up at piece 2.
		const again = await startUpload(database, fake.bucket, input, allowances.unlimited);
		expect(again).toMatchObject({ reference: started.reference, received: [1] });
		await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 2, bytes.subarray(pieceBytes));
		await finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);

		const upload = (await uploadByReference(database, started.reference))!;
		expect(upload).toMatchObject({ status: 'checking', kind: 'video', media_type: 'video/mp4' });
		expect(upload.fingerprint).toBe(
			await fileFingerprint([await sha256Hex(bytes.subarray(0, pieceBytes)), await sha256Hex(bytes.subarray(pieceBytes))])
		);
		expect(fake.stored.get(upload.original_key!)?.length).toBe(bytes.length);
	});

	it('refuses a piece of the wrong size', async () => {
		const started = await startUpload(
			database,
			fake.bucket,
			{ accountIdentifier: sender, groupIdentifier: crypto.randomUUID(), fileName: 'a.txt', sizeBytes: 10, wayIn: 'send-files', answers },
			allowances.unlimited
		);
		await expect(
			receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 1, new Uint8Array(9))
		).rejects.toThrow(/size/);
	});

	it('does not accept a program, and tells the sender why', async () => {
		const { reference, refused } = await sendWhole(new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]), 'setup.exe');
		expect(refused).toMatch(/Programs/);
		const upload = (await uploadByReference(database, reference))!;
		expect(upload).toMatchObject({ status: 'not-accepted', check_result: 'refused' });
		expect(fake.unfinished.size).toBe(0);
		const mine = await uploadsOfAccount(database, sender);
		expect(mine[0]).toMatchObject({ status: 'not-accepted', reason: refused });
	});

	it('marks a PDF with a script for a careful look', async () => {
		const { reference } = await sendWhole(new TextEncoder().encode('%PDF-1.7\n<< /S /JavaScript /JS (x) >>'), 'rules.pdf');
		expect(await uploadByReference(database, reference)).toMatchObject({ status: 'waiting-for-review', check_result: 'careful-look' });
	});

	it('pulls out the files that need a careful look, and the files about one nation', async () => {
		const { reference: careful } = await sendWhole(new TextEncoder().encode('%PDF-1.7\n<< /S /JavaScript /JS (x) >>'), 'rules.pdf');
		const { reference: plain } = await sendWhole(png(), 'hall.png', { nations: ['hopi-tribe'] });
		expect((await uploadQueue(database, 'careful-look')).map((row) => row.reference)).toEqual([careful]);
		expect((await queueCounts(database))['careful-look']).toBe(1);
		expect(await queueNations(database)).toEqual(['hopi-tribe', 'navajo-nation']);
		expect((await uploadQueue(database, 'open', null, 'hopi-tribe')).map((row) => row.reference)).toEqual([plain]);
		expect((await uploadQueue(database, 'all', null, 'navajo-nation')).map((row) => row.reference)).toEqual([careful]);
	});

	it('holds each account to its daily allowance', async () => {
		const tight = { filesPerDay: 1, waitingBytes: 1024 * 1024 };
		const input = { accountIdentifier: sender, groupIdentifier: crypto.randomUUID(), sizeBytes: 10, wayIn: 'send-files' as const, answers };
		await startUpload(database, fake.bucket, { ...input, fileName: 'one.txt' }, tight);
		await expect(startUpload(database, fake.bucket, { ...input, fileName: 'two.txt' }, tight)).rejects.toThrow(/1 files a day/);
	});

	it('lets the sender withdraw a file, deleting its bytes', async () => {
		const { reference } = await sendWhole(png(), 'photo.png');
		const upload = (await uploadByReference(database, reference))!;
		await withdrawUpload(database, fake.bucket, upload);
		expect(await uploadByReference(database, reference)).toMatchObject({ status: 'withdrawn' });
		expect(fake.stored.size).toBe(0);
	});

	it('takes a YouTube link in place of a video file', async () => {
		const added = await addYoutubeLink(
			database,
			{ accountIdentifier: sender, link: 'https://youtu.be/dQw4w9WgXcQ', wayIn: 'send-files', answers },
			allowances.unlimited
		);
		expect(await uploadByReference(database, added.reference)).toMatchObject({
			source: 'youtube',
			kind: 'video',
			youtube_identifier: 'dQw4w9WgXcQ',
			status: 'waiting-for-review'
		});
		await expect(
			addYoutubeLink(database, { accountIdentifier: sender, link: 'https://vimeo.com/1', wayIn: 'send-files', answers }, allowances.unlimited)
		).rejects.toThrow(/YouTube/);
	});

	it('refuses a second copy of a file the sender already sent, naming the first, and keeps none of it', async () => {
		const { reference: first } = await sendWhole(png(), 'chapter-house.png');
		const { reference: second, refused } = await sendWhole(png(), 'chapter-house (1).png');
		expect(refused).toBe(`This file was already sent as ${first}.`);
		const copy = (await uploadByReference(database, second))!;
		expect(copy).toMatchObject({ status: 'not-accepted', decision_reason: refused, fingerprint: null });
		expect(fake.stored.has(copy.original_key!)).toBe(false);
		expect(fake.unfinished.size).toBe(0);
		const history = await eventsFor(database, 'upload', copy.identifier);
		expect(history.map((event) => event.action)).toEqual(['Upload started', 'Upload not accepted']);
		expect((await uploadsOfAccount(database, sender)).find((upload) => upload.reference === second)).toMatchObject({
			status: 'not-accepted',
			reason: refused
		});
	});

	it('refuses a second copy of a large file sent in pieces', async () => {
		const bytes = new Uint8Array(pieceBytes + 1000);
		bytes.set([0, 0, 0, 0x20, ...new TextEncoder().encode('ftypisom')]);
		const { reference: first } = await sendWhole(bytes, 'talk.mp4');
		const { refused } = await sendWhole(bytes, 'talk-copy.mp4');
		expect(refused).toBe(`This file was already sent as ${first}.`);
	});

	it('takes the same file again once the first copy was withdrawn or not accepted', async () => {
		const { reference: first } = await sendWhole(png(), 'photo.png');
		await withdrawUpload(database, fake.bucket, (await uploadByReference(database, first))!);
		const { refused } = await sendWhole(png(), 'photo.png');
		expect(refused).toBeNull();
	});

	it('does not tell one sender what another sent', async () => {
		const other = 'account-other';
		await database
			.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, ?, ?)`)
			.bind(other, 'other@example.org', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z')
			.run();
		await sendWhole(png(), 'photo.png');
		const { refused } = await sendWhole(png(), 'photo.png', {}, true, other);
		expect(refused).toBeNull();
	});
});

describe('the sender’s answers', () => {
	it('asks for what is missing', () => {
		const read = readAnswers({ origin: 'published', permittedUse: 'quote' });
		expect(read.ok).toBe(false);
		if (!read.ok) expect(Object.keys(read.errors).sort()).toEqual(['confirmed', 'description', 'originNote']);
	});

	it('reads a complete set', () => {
		const read = readAnswers({ description: 'Rules', origin: 'own-work', permittedUse: 'quote', confirmed: true, nations: ['hopi-tribe'], nationFirst: true });
		expect(read).toMatchObject({ ok: true, answers: { nationFirst: true, nations: ['hopi-tribe'] } });
	});
});

describe('reviewing', () => {
	it('asks the sender a question, takes the answer and files the picture for everyone', async () => {
		const { reference } = await sendWhole(png(), 'chapter-house.png');
		await claimUpload(database, reviewer, (await uploadByReference(database, reference))!);
		await addUploadMessage(database, reviewer, (await uploadByReference(database, reference))!, 'question', 'Who took the photo?');
		await addUploadMessage(database, reviewer, (await uploadByReference(database, reference))!, 'note', 'Looks fine.');
		expect(await uploadByReference(database, reference)).toMatchObject({ status: 'needs-answer' });

		const mine = await uploadsOfAccount(database, sender);
		// The sender sees the question but not the reviewers' note.
		expect(mine[0]?.messages.map((message) => message.body)).toEqual(['Who took the photo?']);
		await answerQuestion(database, (await uploadByReference(database, reference))!, 'My aunt, and yes.');
		expect(await uploadByReference(database, reference)).toMatchObject({ status: 'in-review' });

		await fileUpload(database, reviewer, (await uploadByReference(database, reference))!, filing);
		const filed = (await uploadByReference(database, reference))!;
		expect(filed).toMatchObject({ status: 'filed', access_level: 'public', filed_key: filed.preview_key });
		expect(await isPublicFile(database, filed)).toBe(true);
	});

	it('will not show to everyone a file the sender said is background only', async () => {
		const { reference } = await sendWhole(png(), 'notes.png', { permittedUse: 'background-only' });
		await expect(fileUpload(database, reviewer, (await uploadByReference(database, reference))!, filing)).rejects.toThrow(
			/background only/
		);
	});

	it('keeps an embargoed file private until its date', async () => {
		const { reference } = await sendWhole(png(), 'later.png');
		await fileUpload(database, reviewer, (await uploadByReference(database, reference))!, {
			...filing,
			accessLevel: 'embargoed',
			embargoedUntil: '2999-01-01'
		});
		expect(await isPublicFile(database, (await uploadByReference(database, reference))!)).toBe(false);
	});

	it('deletes a declined file 30 days after the decision, keeping the record', async () => {
		const { reference } = await sendWhole(png(), 'logo.png');
		await declineUpload(database, reviewer, (await uploadByReference(database, reference))!, 'We only use seals from the nation.');
		expect(await deleteOldUploads(database, fake.bucket)).toBe(0);
		await database
			.prepare('UPDATE uploads SET decided_at = ? WHERE reference = ?')
			.bind('2026-01-01T00:00:00Z', reference)
			.run();
		expect(await deleteOldUploads(database, fake.bucket)).toBe(1);
		expect(fake.stored.size).toBe(0);
		const upload = (await uploadByReference(database, reference))!;
		expect(upload.status).toBe('not-used');
		expect(upload.deleted_at).not.toBeNull();
		expect((await uploadsOfAccount(database, sender))[0]?.reason).toBe('We only use seals from the nation.');
	});
});

describe('when the sender deletes their account', () => {
	it('keeps what was filed and deletes everything else, so the account row can go', async () => {
		const filedOne = await sendWhole(png(), 'filed.png');
		await fileUpload(database, reviewer, (await uploadByReference(database, filedOne.reference))!, filing);
		const waiting = await sendWhole(png(), 'waiting.png');
		expect(await forgetAccountUploads(database, fake.bucket, sender)).toEqual({ deleted: 1, kept: 1 });
		expect(await uploadByReference(database, waiting.reference)).toBeNull();
		expect(await uploadByReference(database, filedOne.reference)).toMatchObject({ status: 'filed', account_identifier: null });
		await database.prepare('DELETE FROM accounts WHERE identifier = ?').bind(sender).run();
		expect((await uploadQueue(database, 'decided'))[0]).toMatchObject({ reference: filedOne.reference, senderEmail: null });
	});

	it('happens as part of deleting the account', async () => {
		const filedOne = await sendWhole(png(), 'filed.png');
		await fileUpload(database, reviewer, (await uploadByReference(database, filedOne.reference))!, filing);
		const waiting = await sendWhole(png(), 'waiting.png');
		const account = { subject: sender, email: 'sender@example.org', name: null };
		expect(await deleteAccount(database, account, false, fake.bucket)).toEqual({ outcome: 'deleted' });
		expect(await database.prepare('SELECT 1 FROM accounts WHERE identifier = ?').bind(sender).first()).toBeNull();
		expect(await uploadByReference(database, waiting.reference)).toBeNull();
		expect(await uploadByReference(database, filedOne.reference)).toMatchObject({ status: 'filed', account_identifier: null });
	});
});

describe('the virus check', () => {
	const fileScan = async (key: string) =>
		database.prepare('SELECT status FROM file_scans WHERE object_key = ?').bind(key).first<{ status: string }>();

	it('holds a finished file at checking, with every copy in line, and serves nothing until it is clean', async () => {
		const { reference } = await sendWhole(png(), 'held.png', {}, false);
		const upload = (await uploadByReference(database, reference))!;
		expect(upload.status).toBe('checking');
		expect(await fileScan(upload.original_key!)).toEqual({ status: 'waiting' });
		expect(await fileScan(upload.preview_key!)).toEqual({ status: 'waiting' });
		await expect(
			serveUploadFile(new Request('https://example.org/'), fake.bucket, { key: upload.original_key!, name: 'held.png', mediaType: 'image/png', kind: 'picture' }, { inline: true, cacheControl: 'no-store', scan: await scanOfKey(database, upload.original_key!) })
		).rejects.toMatchObject({ status: 409 });
		expect(await advanceCheckedUploads(database, fake.bucket)).toBe(0);
		await scanned(reference, 'clean');
		expect((await uploadByReference(database, reference))!.status).toBe('waiting-for-review');
	});

	it('refuses and deletes a file where something was found', async () => {
		const { reference } = await sendWhole(png(), 'bad.png', {}, false);
		const upload = (await uploadByReference(database, reference))!;
		await scanned(reference, 'flagged', 'Eicar-Test-Signature');
		expect(await uploadByReference(database, reference)).toMatchObject({ status: 'not-accepted', check_result: 'refused' });
		expect((await uploadByReference(database, reference))!.decision_reason).toContain('Eicar-Test-Signature');
		expect(fake.stored.size).toBe(0);
		expect(await fileScan(upload.original_key!)).toBeNull();
		await expect(releaseUnchecked(database, fake.bucket, reviewer, upload, 'Trust it')).rejects.toThrow(/could not check/);
	});

	it('lets a reviewer release a file that could not be checked, with a reason in the history', async () => {
		const { reference } = await sendWhole(png(), 'locked.png', {}, false);
		await scanned(reference, 'cannot-scan', 'encrypted');
		const upload = (await uploadByReference(database, reference))!;
		expect(upload.status).toBe('checking');
		await releaseUnchecked(database, fake.bucket, reviewer, upload, 'From the tribal court clerk, by hand');
		expect((await uploadByReference(database, reference))!.status).toBe('waiting-for-review');
		const history = (await eventsFor(database, 'upload', upload.identifier)).map((entry) => entry.action);
		expect(history).toContain('Released without a virus check');
	});

	it('forgets the scans when a file is withdrawn', async () => {
		const { reference } = await sendWhole(png(), 'gone.png');
		const upload = (await uploadByReference(database, reference))!;
		await withdrawUpload(database, fake.bucket, upload);
		expect(await fileScan(upload.original_key!)).toBeNull();
		expect(await fileScan(upload.preview_key!)).toBeNull();
	});
});

describe('comments from the nation', () => {
	async function nationReviewer(identifier: string, nation: string): Promise<SignedInPerson> {
		await database
			.prepare(
				`INSERT INTO people (identifier, email, display_name, role, nation_identifier, status, added_at)
				 VALUES (?, ?, ?, 'nation-reviewer', ?, 'active', '2026-11-23T00:00:00Z')`
			)
			.bind(identifier, `${identifier}@example.org`, `Reviewer for ${nation}`, nation)
			.run();
		return { identifier, displayName: `Reviewer for ${nation}`, email: `${identifier}@example.org`, role: 'nation-reviewer', nationIdentifier: nation };
	}

	it('shows a nation reviewer the files about their nation only, without the sender', async () => {
		const navajo = await nationReviewer('navajo-reviewer', 'navajo-nation');
		const hopi = await nationReviewer('hopi-reviewer', 'hopi-tribe');
		const { reference } = await sendWhole(png(), 'court.png');
		expect((await nationUploads(database, navajo)).map((item) => item.reference)).toEqual([reference]);
		expect(await nationUploads(database, hopi)).toEqual([]);
		expect(await nationUpload(database, hopi, reference)).toBeNull();
		const found = (await nationUpload(database, navajo, reference))!;
		expect(found.nation).toBe('navajo-nation');
		expect(Object.keys(found)).not.toContain('senderEmail');
	});

	it('lets the nation comment, which reviewers see and the sender does not', async () => {
		const navajo = await nationReviewer('navajo-reviewer', 'navajo-nation');
		const hopi = await nationReviewer('hopi-reviewer', 'hopi-tribe');
		const { reference } = await sendWhole(png(), 'court.png');
		const upload = (await uploadByReference(database, reference))!;
		await addNationComment(database, navajo, upload, 'The nation agrees this may be shown, with credit to the court.');
		await expect(addNationComment(database, hopi, upload, 'Not ours')).rejects.toThrow(/only on files about your nation/);
		expect((await nationUpload(database, navajo, reference))!.comments).toMatchObject([
			{ kind: 'nation-comment', person_name: 'Reviewer for navajo-nation' }
		]);
		expect((await uploadDetail(database, reference))!.messages).toMatchObject([{ kind: 'nation-comment' }]);
		expect((await uploadsOfAccount(database, sender))[0]?.messages).toEqual([]);
		expect((await nationUploads(database, navajo))[0]?.comments).toBe(1);
		expect((await eventsFor(database, 'upload', upload.identifier)).map((entry) => entry.action)).toContain('Comment from the nation');
	});

	it('hides withdrawn files, and pauses when the lead author lowers the access', async () => {
		const navajo = await nationReviewer('navajo-reviewer', 'navajo-nation');
		const kept = await sendWhole(png(), 'kept.png');
		const taken = await sendWhole(png('another'), 'taken.png');
		await withdrawUpload(database, fake.bucket, (await uploadByReference(database, taken.reference))!);
		expect((await nationUploads(database, navajo)).map((item) => item.reference)).toEqual([kept.reference]);
		await setGrant(
			database,
			{ personIdentifier: navajo.identifier, subjectKind: 'nation', subjectIdentifier: 'navajo-nation', level: 'no-access', note: null, expiresAt: null },
			reviewer
		);
		expect(await nationSpokenFor(database, navajo)).toBeNull();
		expect(await nationUploads(database, navajo)).toEqual([]);
	});
});

describe('essay figures', () => {
	it('take a sound recording, skip the queue, and are shown once the essay is published', async () => {
		await database
			.prepare(`INSERT INTO essays (identifier, part, created_at) VALUES ('why-peacemaking', 'essays', '2026-11-23T00:00:00Z')`)
			.run();
		const bytes = new TextEncoder().encode('ID3\u0004\u0000 some sound');
		const started = await startUpload(
			database,
			fake.bucket,
			{ accountIdentifier: sender, groupIdentifier: crypto.randomUUID(), fileName: 'elder.mp3', sizeBytes: bytes.length, wayIn: 'essay-figure', essayIdentifier: 'why-peacemaking' },
			allowances.unlimited
		);
		await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 1, bytes);
		await finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);
		const figure = (await uploadByReference(database, started.reference))!;
		expect(figure).toMatchObject({ status: 'filed', kind: 'sound', destination: 'essay-figure' });
		expect(await isPublicFile(database, figure)).toBe(false);
		expect(await uploadQueue(database, 'all')).toEqual([]);
	});

	it('are shown before publishing to people with comment access to the essay, and no one else', async () => {
		await database
			.prepare(`INSERT INTO essays (identifier, part, created_at) VALUES ('why-peacemaking', 'essays', '2026-11-23T00:00:00Z')`)
			.run();
		const bytes = png();
		const started = await startUpload(
			database,
			fake.bucket,
			{ accountIdentifier: sender, groupIdentifier: crypto.randomUUID(), fileName: 'circle.png', sizeBytes: bytes.length, wayIn: 'essay-figure', essayIdentifier: 'why-peacemaking' },
			allowances.unlimited
		);
		await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 1, bytes);
		await finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);
		const figure = (await uploadByReference(database, started.reference))!;
		const person = (role: SignedInPerson['role']): SignedInPerson => ({
			identifier: `person-${role}`,
			displayName: role,
			email: `${role}@example.org`,
			role,
			nationIdentifier: null
		});
		expect(await maySeeFiledFile(database, person('co-author'), figure)).toBe(true);
		expect(await maySeeFiledFile(database, person('contributor'), figure)).toBe(false);
		expect(await maySeeFiledFile(database, undefined, figure)).toBe(false);
		expect(await maySeeFiledFile(database, reviewer, figure)).toBe(true);
	});
});

describe('pulled files', () => {
	const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');

	async function sendPulled(note: string | null = 'Sealaska page was spam', bytes = pdf) {
		const started = await startUpload(
			database,
			fake.bucket,
			{
				accountIdentifier: sender,
				groupIdentifier: crypto.randomUUID(),
				fileName: 'viewcontent.pdf',
				sizeBytes: bytes.length,
				wayIn: 'send-files',
				fromPullList: true,
				note
			},
			allowances.unlimited
		);
		await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 1, bytes);
		await finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);
		await scanned(started.reference, 'clean');
		return (await uploadByReference(database, started.reference))!;
	}

	it('need no answers, stay out of the review queue and are offered for intake once clean', async () => {
		const upload = await sendPulled();
		expect(upload.status).toBe('waiting-for-review');
		expect(upload.from_pull_list).toBe(1);
		expect(upload.description).toBe('Sealaska page was spam');
		expect(await uploadQueue(database, 'open')).toEqual([]);
		const offer = JSON.parse(new TextDecoder().decode(fake.stored.get(`intake/waiting/${upload.reference}.json`)!));
		expect(offer).toMatchObject({ reference: upload.reference, key: upload.original_key, fileName: 'viewcontent.pdf', sizeBytes: pdf.length });
		const mine = await uploadsOfAccount(database, sender);
		expect(mine[0]).toMatchObject({ reference: upload.reference, pulled: true });
	});

	it('are filed when the intake answers, and the upload’s own copy is deleted', async () => {
		const upload = await sendPulled();
		fake.stored.set('articles/vance-2016.pdf', pdf);
		await fake.bucket.put(`intake/filed/${upload.reference}.json`, JSON.stringify({ captureKey: 'articles/vance-2016.pdf' }));
		expect(await settlePulledFiles(database, fake.bucket)).toBe(1);
		const filed = (await uploadByReference(database, upload.reference))!;
		expect(filed).toMatchObject({ status: 'filed', destination: 'research-library', access_level: 'restricted', filed_key: 'articles/vance-2016.pdf' });
		expect(filed.deleted_at).not.toBeNull();
		expect(fake.stored.has(upload.original_key!)).toBe(false);
		expect(fake.stored.has('articles/vance-2016.pdf')).toBe(true);
		expect([...fake.stored.keys()].filter((key) => key.startsWith('intake/'))).toEqual([]);
	});

	it('file a second copy of a file already filed without breaking the page', async () => {
		// Two copies the intake script matched to one capture, as from before second copies were refused.
		const first = await sendPulled();
		const second = await sendPulled(null, pdf.map((byte, index) => (index === pdf.length - 2 ? 0x20 : byte)));
		fake.stored.set('articles/court-review-2009.pdf', pdf);
		await fake.bucket.put(`intake/filed/${first.reference}.json`, JSON.stringify({ captureKey: 'articles/court-review-2009.pdf' }));
		expect(await settlePulledFiles(database, fake.bucket)).toBe(1);
		await fake.bucket.put(
			`intake/filed/${second.reference}.json`,
			JSON.stringify({ captureKey: 'articles/court-review-2009.pdf', alreadyHeld: true })
		);
		expect(await settlePulledFiles(database, fake.bucket)).toBe(1);
		expect(await uploadByReference(database, first.reference)).toMatchObject({ status: 'filed', filed_key: 'articles/court-review-2009.pdf' });
		expect(await uploadByReference(database, second.reference)).toMatchObject({
			status: 'filed',
			filed_key: null,
			decision_reason: 'Already held as articles/court-review-2009.pdf'
		});
		expect(fake.stored.has(second.original_key!)).toBe(false);
		const intake = await intakeFilesOf(database, sender);
		expect(intake.find((file) => file.reference === second.reference)?.filedAs).toBe('Already held as articles/court-review-2009.pdf');
		expect([...fake.stored.keys()].filter((key) => key.startsWith('intake/'))).toEqual([]);
	});

	it('refuse a second copy of a file any editor pulled, before or after it was filed', async () => {
		const first = await sendPulled();
		const editor = 'account-editor';
		await database
			.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, ?, ?)`)
			.bind(editor, 'editor@example.org', '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z')
			.run();
		const again = async () => {
			const started = await startUpload(
				database,
				fake.bucket,
				{ accountIdentifier: editor, groupIdentifier: crypto.randomUUID(), fileName: 'copy.pdf', sizeBytes: pdf.length, wayIn: 'send-files', fromPullList: true },
				allowances.unlimited
			);
			await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 1, pdf);
			return finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);
		};
		await expect(again()).rejects.toThrow(`This file was already sent as ${first.reference}.`);
		fake.stored.set('articles/vance-2016.pdf', pdf);
		await fake.bucket.put(`intake/filed/${first.reference}.json`, JSON.stringify({ captureKey: 'articles/vance-2016.pdf' }));
		await settlePulledFiles(database, fake.bucket);
		await expect(again()).rejects.toThrow(`This file was already sent as ${first.reference}.`);
		const intake = await intakeFilesOf(database, editor);
		expect(intake.map((file) => file.statusText)).toEqual([
			`Not filed: This file was already sent as ${first.reference}.`,
			`Not filed: This file was already sent as ${first.reference}.`
		]);
	});

	it('are marked not used when the intake declines them', async () => {
		const upload = await sendPulled(null);
		await fake.bucket.put(`intake/declined/${upload.reference}.json`, JSON.stringify({ reason: 'A sign-in page, not the code.' }));
		expect(await settlePulledFiles(database, fake.bucket)).toBe(1);
		expect(await uploadByReference(database, upload.reference)).toMatchObject({ status: 'not-used', decision_reason: 'A sign-in page, not the code.' });
	});

	it('wait when the filed copy is missing or the note names a key outside the captures', async () => {
		const upload = await sendPulled();
		await fake.bucket.put(`intake/filed/${upload.reference}.json`, JSON.stringify({ captureKey: 'articles/missing.pdf' }));
		expect(await settlePulledFiles(database, fake.bucket)).toBe(0);
		expect((await uploadByReference(database, upload.reference))!.status).toBe('waiting-for-review');
		expect(fake.stored.has(upload.original_key!)).toBe(true);
		expect(isCaptureKey('uploads/x/original')).toBe(false);
		expect(isCaptureKey('articles/../uploads/x')).toBe(false);
		expect(isCaptureKey('westlaw/usc-8-1359.pdf')).toBe(true);
	});

	it('are offered again when the note went missing, and withdrawing drops the note', async () => {
		const upload = await sendPulled();
		fake.stored.delete(`intake/waiting/${upload.reference}.json`);
		await settlePulledFiles(database, fake.bucket);
		expect(fake.stored.has(`intake/waiting/${upload.reference}.json`)).toBe(true);
		await withdrawUpload(database, fake.bucket, upload);
		expect(fake.stored.has(`intake/waiting/${upload.reference}.json`)).toBe(false);
	});
});

describe('scanBadgeFor', () => {
	it('follows the scan while the file is being checked', () => {
		expect(scanBadgeFor('checking', null, null)).toBe('checking');
		expect(scanBadgeFor('checking', 'waiting', null)).toBe('checking');
		expect(scanBadgeFor('checking', 'clean', null)).toBe('clean');
		expect(scanBadgeFor('checking', 'flagged', null)).toBe('flagged');
	});
	it('reads the upload’s own status once the check is over', () => {
		expect(scanBadgeFor('waiting-for-review', null, null)).toBe('clean');
		expect(scanBadgeFor('filed', null, null)).toBe('clean');
		expect(scanBadgeFor('not-accepted', null, 'The virus check found “Eicar-Signature”, so the file was deleted.')).toBe('flagged');
		expect(scanBadgeFor('not-accepted', null, 'Archives such as ZIP files can’t be sent.')).toBeNull();
		expect(scanBadgeFor('sending', null, null)).toBeNull();
	});
});

describe('refusedByName', () => {
	it('marks kinds of file that are never accepted as soon as they are added', () => {
		expect(refusedByName('salt-river-code.html')).toBe('Web pages can’t be sent. Save it as a PDF.');
		expect(refusedByName('minutes.docm')).toBe('Office files with macros can’t be accepted.');
		expect(refusedByName('setup.EXE')).toMatch(/Programs/);
		expect(refusedByName('Vance - A Pretty Smart Answer.pdf')).toBeUndefined();
		expect(refusedByName('notes')).toBeUndefined();
	});
});
