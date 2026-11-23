import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { deleteAccount } from '#lib/server/account-deletion.ts';
import { allowances, pieceBytes } from '#lib/uploads.ts';
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
	isPublicFile,
	readAnswers,
	receivePiece,
	startUpload,
	uploadByReference,
	uploadQueue,
	uploadsOfAccount,
	withdrawUpload,
	type Filing,
	type SenderAnswers
} from '#lib/server/uploads.ts';
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
		async put(key: string, value: Uint8Array) {
			stored.set(key, new Uint8Array(value));
		},
		async get(key: string) {
			const value = stored.get(key);
			return value ? { size: value.length, arrayBuffer: async () => value.slice().buffer } : null;
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

// A small PNG with a text chunk that should not survive into the copy.
function png(): Uint8Array {
	const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...new TextEncoder().encode(type), ...data, 0, 0, 0, 0];
	return new Uint8Array([
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
		...chunk('tEXt', [0x47, 0x50, 0x53]),
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

async function sendWhole(bytes: Uint8Array, fileName: string, extra: Partial<SenderAnswers> = {}) {
	const started = await startUpload(
		database,
		fake.bucket,
		{ accountIdentifier: sender, groupIdentifier: crypto.randomUUID(), fileName, sizeBytes: bytes.length, wayIn: 'send-files', answers: { ...answers, ...extra } },
		allowances.signedIn
	);
	for (let number = 1; number <= started.pieceCount; number++) {
		const piece = bytes.subarray((number - 1) * pieceBytes, Math.min(number * pieceBytes, bytes.length));
		const outcome = await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, number, piece);
		if (!outcome.accepted) return { reference: started.reference, refused: outcome.reason };
	}
	await finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);
	return { reference: started.reference, refused: null };
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
		expect(history.map((event) => event.action)).toEqual(['Upload started', 'Upload received']);
		expect((await uploadQueue(database, 'open')).map((row) => row.reference)).toEqual([reference]);
	});

	it('sends a large video in pieces, picks up after a stop and fingerprints the pieces', async () => {
		const bytes = new Uint8Array(pieceBytes + 1000);
		bytes.set([0, 0, 0, 0x20, ...new TextEncoder().encode('ftypisom')]);
		const input = { accountIdentifier: sender, groupIdentifier: crypto.randomUUID(), fileName: 'talk.mp4', sizeBytes: bytes.length, wayIn: 'send-files' as const, answers };
		const started = await startUpload(database, fake.bucket, input, allowances.signedIn);
		expect(started.pieceCount).toBe(2);
		await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 1, bytes.subarray(0, pieceBytes));

		// The page was closed; choosing the same file again picks up at piece 2.
		const again = await startUpload(database, fake.bucket, input, allowances.signedIn);
		expect(again).toMatchObject({ reference: started.reference, received: [1] });
		await receivePiece(database, fake.bucket, (await uploadByReference(database, started.reference))!, 2, bytes.subarray(pieceBytes));
		await finishUpload(database, fake.bucket, (await uploadByReference(database, started.reference))!);

		const upload = (await uploadByReference(database, started.reference))!;
		expect(upload).toMatchObject({ status: 'waiting-for-review', kind: 'video', media_type: 'video/mp4' });
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
			allowances.signedIn
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
			allowances.signedIn
		);
		expect(await uploadByReference(database, added.reference)).toMatchObject({
			source: 'youtube',
			kind: 'video',
			youtube_identifier: 'dQw4w9WgXcQ',
			status: 'waiting-for-review'
		});
		await expect(
			addYoutubeLink(database, { accountIdentifier: sender, link: 'https://vimeo.com/1', wayIn: 'send-files', answers }, allowances.signedIn)
		).rejects.toThrow(/YouTube/);
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
});
