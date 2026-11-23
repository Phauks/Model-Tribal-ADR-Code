import { describe, expect, it } from 'vitest';
import {
	finishLinkedFile,
	linkedFileForDownload,
	linkedPieceBytes,
	ownLinkedFile,
	receiveLinkedPiece,
	removeExpiredLinkedFiles,
	startLinkedFile
} from '#lib/server/mail/linked-files.ts';
import { CompositionError, queueMessage, sendMessage } from '#lib/server/mail/outbound.ts';
import { readToken } from '#lib/server/mail/tokens.ts';
import { recordingCarrier, testContext, testSettings } from './mail-fixtures.ts';

const clock = { now: new Date('2026-11-24T17:00:00Z') };
type Context = Awaited<ReturnType<typeof testContext>>;

/** Sends a file of `size` bytes up in pieces, as the composer does, and returns its identifier. */
async function sendUp(context: Context, filename: string, size: number): Promise<string> {
	const started = await startLinkedFile(context, 'lead', { filename, sizeBytes: size, mediaType: 'application/pdf' });
	expect(started.pieceCount).toBe(Math.ceil(size / linkedPieceBytes));
	for (let number = 1; number <= started.pieceCount; number += 1) {
		const length = number < started.pieceCount ? linkedPieceBytes : size - linkedPieceBytes * (started.pieceCount - 1);
		await receiveLinkedPiece(context, await ownLinkedFile(context, 'lead', started.identifier), number, new Uint8Array(length).fill(number));
	}
	await finishLinkedFile(context, await ownLinkedFile(context, 'lead', started.identifier));
	return started.identifier;
}

function message(context: Context, links: string[]) {
	return queueMessage(context, {
		personIdentifier: 'lead',
		threadIdentifier: null,
		from: 'contact@example.org',
		to: [{ email: 'clerk@court.example' }],
		subject: 'The recording',
		text: 'Here is the hearing recording.\n\n-- \nTrevor',
		links
	});
}

describe('big files sent as links', () => {
	it('sends a file up in pieces, puts the link above the signature, and sends once the virus check passes', async () => {
		const context = await testContext(clock);
		const size = linkedPieceBytes + 1234;
		const identifier = await sendUp(context, 'Hearing recording.mp4', size);
		const key = `mail/links/${identifier}`;
		expect(context.bucket.files.get(key)?.byteLength).toBe(size);
		expect(await context.database.prepare('SELECT status FROM file_scans WHERE object_key = ?').bind(key).first()).toEqual({ status: 'waiting' });

		const queued = await message(context, [identifier]);
		const row = await context.database.prepare('SELECT text_body FROM mail_messages WHERE identifier = ?').bind(queued.messageIdentifier).first<{ text_body: string }>();
		expect(row!.text_body).toMatch(/^Here is the hearing recording\.\n\nA file is attached as a link, to download until December 24, 2026:\nHearing recording\.mp4 \(10\.0 MB\): https:\/\/example\.org\/mail\/files\/[a-z2-7]+\n\n-- \nTrevor$/);
		const token = /mail\/files\/([a-z2-7]+)/.exec(row!.text_body)![1];
		expect(await readToken(testSettings().signingKey!, 'file', token)).toBe(identifier);

		// Held while the check runs: nothing goes, and the link serves nothing.
		const carrier = recordingCarrier();
		expect(await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier)).toMatchObject({ sent: false, held: true });
		expect(carrier.sent).toHaveLength(0);
		expect(await linkedFileForDownload(context, identifier)).toBeNull();

		await context.database.prepare(`UPDATE file_scans SET status = 'clean' WHERE object_key = ?`).bind(key).run();
		await context.database.prepare(`UPDATE mail_messages SET scheduled_for = ? WHERE identifier = ?`).bind(clock.now.toISOString(), queued.messageIdentifier).run();
		expect(await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier)).toEqual({ sent: true });
		expect(carrier.sent[0].text).toContain(`/mail/files/${token}`);
		expect(carrier.sent[0].attachments ?? []).toHaveLength(0);
		expect(await linkedFileForDownload(context, identifier)).toMatchObject({ filename: 'Hearing recording.mp4' });

		// After 30 days the link runs out and the file is deleted.
		clock.now = new Date('2026-12-24T17:00:01Z');
		expect(await linkedFileForDownload(context, identifier)).toBe('expired');
		expect(await removeExpiredLinkedFiles(context)).toBe(1);
		expect(context.bucket.files.has(key)).toBe(false);
		expect(await linkedFileForDownload(context, identifier)).toBeNull();
		clock.now = new Date('2026-11-24T17:00:00Z');
	});

	it('does not send a message whose linked file the check flags', async () => {
		const context = await testContext(clock);
		const identifier = await sendUp(context, 'report.pdf', 2000);
		const queued = await message(context, [identifier]);
		await context.database.prepare(`UPDATE file_scans SET status = 'flagged', reason = 'Win.Test.EICAR' WHERE object_key = ?`).bind(`mail/links/${identifier}`).run();
		const carrier = recordingCarrier();
		const result = await sendMessage(context, { replies: carrier, outreach: null }, queued.messageIdentifier);
		expect(result).toMatchObject({ sent: false });
		expect(result.error).toContain('Win.Test.EICAR');
		expect(carrier.sent).toHaveLength(0);
	});

	it('refuses files that are not finished, not the sender’s, or already sent', async () => {
		const context = await testContext(clock);
		const started = await startLinkedFile(context, 'lead', { filename: 'half.pdf', sizeBytes: 5000, mediaType: 'application/pdf' });
		await expect(message(context, [started.identifier])).rejects.toThrow('has not finished sending up');
		await expect(message(context, ['00000000-0000-4000-8000-000000000000'])).rejects.toThrow(CompositionError);
		const done = await sendUp(context, 'done.pdf', 3000);
		await message(context, [done]);
		await expect(message(context, [done])).rejects.toThrow('already gone with another message');
	});

	it('picks up a file already sent up when the same one is chosen again', async () => {
		const context = await testContext(clock);
		const identifier = await sendUp(context, 'again.pdf', 4000);
		const again = await startLinkedFile(context, 'lead', { filename: 'again.pdf', sizeBytes: 4000, mediaType: 'application/pdf' });
		expect(again).toMatchObject({ identifier, received: [1] });
	});

	it('refuses a piece of the wrong size and files over the limit', async () => {
		const context = await testContext(clock);
		const started = await startLinkedFile(context, 'lead', { filename: 'x.bin', sizeBytes: 100, mediaType: 'application/octet-stream' });
		await expect(receiveLinkedPiece(context, await ownLinkedFile(context, 'lead', started.identifier), 1, new Uint8Array(99))).rejects.toThrow('not the size');
		await expect(startLinkedFile(context, 'lead', { filename: 'huge.iso', sizeBytes: 3 * 1024 ** 3, mediaType: 'application/octet-stream' })).rejects.toThrow('largest');
	});
});
