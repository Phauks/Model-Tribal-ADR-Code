import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { readRequestForm } from '#lib/server/request-form.ts';
import {
	changeStatus,
	deleteExpiredPersonalDetails,
	requestByReference,
	resolveRequest,
	saveRequest
} from '#lib/server/request-store.ts';
import { activityHistoryFor } from '#lib/server/activity-log.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { testDatabase } from './database.ts';

let database: D1Database;
let stored: Map<string, Uint8Array>;
let bucket: R2Bucket;
let editor: SignedInPerson;

beforeEach(async () => {
	database = testDatabase();
	stored = new Map();
	bucket = {
		put: async (key: string, value: Uint8Array) => void stored.set(key, value),
		delete: async (keys: string[]) => keys.forEach((key) => stored.delete(key))
	} as unknown as R2Bucket;
	const result = await matchSignIn(
		database,
		{ subject: 'account-lead', email: 'lead@example.org', emailVerified: true, name: 'Lead' },
		'lead@example.org'
	);
	if (result.outcome !== 'signed-in') throw new Error('not signed in');
	editor = result.person;
});

async function save(fields: Record<string, string | File>): Promise<string> {
	const data = new FormData();
	for (const [name, value] of Object.entries(fields)) data.append(name, value);
	const result = await readRequestForm(data);
	if (!result.ok) throw new Error(JSON.stringify(result.errors));
	return saveRequest(database, bucket, result.request);
}

describe('request store', () => {
	it('saves a request with its proof and uploads the file privately', async () => {
		const reference = await save({
			kind: 'add-nation',
			contact: 'clerk@example.org',
			missingNationOfficialName: 'Example Band',
			missingNationStates: 'Nevada',
			authorityStatement: 'authorized-by-government',
			source1Kind: 'federal',
			source1File: new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 'list.pdf')
		});
		const found = await requestByReference(database, reference);
		expect(found?.request.status).toBe('received');
		expect(found?.sources[0]?.fileKey).toMatch(/^requests\//);
		expect(stored.has(found!.sources[0]!.fileKey!)).toBe(true);
		// Held for the virus check from the moment it is stored.
		expect(await fileScan(database, found!.sources[0]!.fileKey!)).toMatchObject({ status: 'waiting', purpose: 'request-file', subject: reference });
		const history = await activityHistoryFor(database, 'request', found!.request.identifier);
		expect(history.map((event) => event.action)).toEqual(['Request received through the website']);
	});

	it('records when a request is acknowledged and when material is hidden', async () => {
		const reference = await save({ kind: 'remove', contact: 'x', details: 'Withdraw it', material: 'tribes/sample' });
		let found = (await requestByReference(database, reference))!;
		await changeStatus(database, found.request, 'hidden-pending-review', 'Hidden by pull request', editor);
		found = (await requestByReference(database, reference))!;
		expect(found.request.acknowledgedAt).not.toBeNull();
		expect(found.request.materialHiddenAt).not.toBeNull();
		const history = await activityHistoryFor(database, 'request', found.request.identifier);
		expect(history.at(-1)).toMatchObject({
			action: 'Status changed from “Received” to “Hidden, pending review”',
			note: 'Hidden by pull request',
			personName: 'Lead'
		});
	});

	it('deletes personal details 12 months after resolution, unless credited', async () => {
		const plain = await save({ kind: 'question', contact: 'person@example.org', details: 'Hello', requesterName: 'Person' });
		const credited = await save({
			kind: 'contribute',
			contact: 'author@example.org',
			details: 'A source',
			creditPreference: 'Author, Example Nation',
			publicationPermission: 'publish'
		});
		for (const reference of [plain, credited]) {
			const found = (await requestByReference(database, reference))!;
			await resolveRequest(database, found.request, 'answered', null, editor);
		}
		expect(await deleteExpiredPersonalDetails(database)).toBe(0);

		await database
			.prepare(`UPDATE requests SET resolved_at = '2025-01-01T00:00:00.000Z'`)
			.run();
		expect(await deleteExpiredPersonalDetails(database)).toBe(1);
		expect((await requestByReference(database, plain))?.request.contact).toBeNull();
		expect((await requestByReference(database, credited))?.request.contact).toBe('author@example.org');
	});
});
