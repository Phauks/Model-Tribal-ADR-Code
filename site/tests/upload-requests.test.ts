import { isHttpError, json } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allowances } from '#lib/uploads.ts';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import { answering, looksLikeNation, senderOf, senderUpload, withinStartLimit } from '#lib/server/upload-requests.ts';
import { startUpload, UploadProblem } from '#lib/server/uploads.ts';
import { memoryBucket } from './mail-fixtures.ts';
import { testDatabase } from './database.ts';

const bindings = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));

let database: D1Database;
const sender: SignedInAccount = { subject: 'account-sender', email: 'sender@example.org', name: 'Sender' };
const stranger: SignedInAccount = { subject: 'account-stranger', email: 'stranger@example.org', name: 'Stranger' };

function event(account: SignedInAccount | undefined, reference?: string) {
	return {
		locals: { account, person: undefined, twoStepNeeded: false } as App.Locals,
		params: reference === undefined ? {} : { reference }
	};
}

async function refusal(check: () => unknown): Promise<{ status: number; message: string }> {
	try {
		await check();
	} catch (problem) {
		if (isHttpError(problem)) return { status: problem.status, message: problem.body.message };
		throw problem;
	}
	throw new Error('The check let the request through.');
}

async function started(account: SignedInAccount): Promise<string> {
	const { reference } = await startUpload(
		database,
		memoryBucket(),
		{ accountIdentifier: account.subject, groupIdentifier: crypto.randomUUID(), fileName: 'rules.pdf', sizeBytes: 1000, wayIn: 'send-files', fromPullList: true },
		allowances.unlimited
	);
	return reference;
}

beforeEach(async () => {
	for (const key of Object.keys(bindings)) delete bindings[key];
	database = testDatabase();
	for (const account of [sender, stranger]) {
		await database
			.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, '2026-11-23T00:00:00Z', '2026-11-23T00:00:00Z')`)
			.bind(account.subject, account.email)
			.run();
	}
});

describe('senderOf', () => {
	it('answers 401 for someone signed out rather than redirecting, since the page sends files with fetch', async () => {
		expect(await refusal(() => senderOf(event(undefined)))).toEqual({ status: 401, message: 'Sign in first.' });
	});

	it('gives the signed-in account, with or without workspace access', () => {
		expect(senderOf(event(sender))).toBe(sender);
	});
});

describe('senderUpload', () => {
	it('answers 401 for someone signed out, before looking at the address', async () => {
		expect((await refusal(() => senderUpload(event(undefined, 'U-20261123-ABCDEF'), database))).status).toBe(401);
	});

	it('answers 404 for an address that is not an upload reference', async () => {
		for (const reference of [undefined, '', 'U-2026-ABCDEF', 'u-20261123-abcdef', "U-20261123-ABCDEF' OR 1=1"]) {
			expect((await refusal(() => senderUpload(event(sender, reference), database))).status).toBe(404);
		}
	});

	it('gives the upload to the account that started it', async () => {
		const reference = await started(sender);
		const upload = await senderUpload(event(sender, reference), database);
		expect(upload).toMatchObject({ reference, account_identifier: sender.subject, file_name: 'rules.pdf', status: 'sending' });
	});

	it('answers 404, not 403, for another account’s upload, so references cannot be probed', async () => {
		const reference = await started(sender);
		expect(await refusal(() => senderUpload(event(stranger, reference), database))).toEqual({ status: 404, message: 'There is no such upload.' });
	});

	it('answers 404 for a well-formed reference that does not exist', async () => {
		expect((await refusal(() => senderUpload(event(sender, 'U-20261123-ABCDEF'), database))).status).toBe(404);
	});
});

describe('answering', () => {
	it('passes a step’s own answer through', async () => {
		const response = await answering(async () => json({ received: 3 }));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ received: 3 });
	});

	it('answers a refusal as JSON with its status, never kept in a cache', async () => {
		const response = await answering(async () => {
			throw new UploadProblem('This file is larger than we can take.', 413);
		});
		expect(response.status).toBe(413);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toEqual({ message: 'This file is larger than we can take.' });
	});

	it('gives a refusal 400 when it names no status', async () => {
		const response = await answering(async () => {
			throw new UploadProblem('Answer the questions about the files first.');
		});
		expect(response.status).toBe(400);
	});

	it('lets any other problem through, so it is not shown as a refusal', async () => {
		await expect(
			answering(async () => {
				throw new Error('The bucket did not answer');
			})
		).rejects.toThrow('The bucket did not answer');
	});
});

describe('withinStartLimit', () => {
	it('allows every start when no limit is set up', async () => {
		expect(await withinStartLimit('account-sender')).toBe(true);
	});

	it('asks the limiter, keyed by the account', async () => {
		const asked: string[] = [];
		bindings.uploadLimit = {
			limit: async ({ key }: { key: string }) => {
				asked.push(key);
				return { success: asked.length <= 2 };
			}
		};
		expect([await withinStartLimit('account-sender'), await withinStartLimit('account-sender'), await withinStartLimit('account-sender')]).toEqual([true, true, false]);
		expect(asked).toEqual(['account-sender', 'account-sender', 'account-sender']);
	});
});

describe('looksLikeNation', () => {
	it('takes lower-case page identifiers and nothing else', () => {
		expect(looksLikeNation('navajo-nation')).toBe(true);
		expect(looksLikeNation('0-start-with-a-digit')).toBe(true);
		expect(looksLikeNation('-leading-hyphen')).toBe(false);
		expect(looksLikeNation('Navajo-Nation')).toBe(false);
		expect(looksLikeNation('navajo/../nation')).toBe(false);
		expect(looksLikeNation('')).toBe(false);
		expect(looksLikeNation(`a${'b'.repeat(120)}`)).toBe(true);
		expect(looksLikeNation(`a${'b'.repeat(121)}`)).toBe(false);
	});
});
