import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { endProblem, placeProblem, termEnd } from '#lib/nation-teams.ts';
import { allowedDecisions } from '#lib/permissions.ts';
import { accessTo, grantsOf, setGrant } from '#lib/server/access.ts';
import { checkSeals, sealNewEntries } from '#lib/server/activity-seals.ts';
import {
	addPlace,
	applicationByReference,
	applicationsOf,
	confirmApplication,
	declineApplication,
	endPlace,
	granterOn,
	listApplications,
	markConfirming,
	placesOf,
	saveApplication,
	suspendWithEveryoneAdded,
	teamActivity,
	teamOf
} from '#lib/server/nation-teams.ts';
import { fileScan } from '#lib/server/file-scans.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

const navajo = 'navajo-nation';
const hopi = 'hopi-tribe-of-arizona';
const time = new Date('2026-11-23T12:00:00Z');

describe('who may give a place on a team', () => {
	const steward = { isAdministrator: false, level: 'steward', parts: null } as const;
	const inTwoYears = termEnd(730, time);

	it('lets a steward give any level up to steward, for any part they hold', () => {
		expect(placeProblem(steward, { level: 'steward', parts: null, expiresAt: inTwoYears }, time)).toBeUndefined();
		expect(placeProblem(steward, { level: 'reviewer', parts: ['contacts'], expiresAt: inTwoYears }, time)).toBeUndefined();
	});

	it('never lets anyone give more than they hold', () => {
		const editor = { isAdministrator: false, level: 'editor' } as const;
		expect(placeProblem(editor, { level: 'drafter', parts: null, expiresAt: inTwoYears }, time)).toMatch(/steward/);
		const partial = { isAdministrator: false, level: 'steward', parts: ['contacts'] } as const;
		expect(placeProblem(partial, { level: 'editor', parts: null, expiresAt: inTwoYears }, time)).toMatch(/parts/);
		expect(placeProblem(partial, { level: 'editor', parts: ['about'], expiresAt: inTwoYears }, time)).toMatch(/parts/);
		expect(placeProblem(partial, { level: 'editor', parts: ['contacts'], expiresAt: inTwoYears }, time)).toBeUndefined();
	});

	it('refuses someone with no place on this nation’s team', () => {
		expect(placeProblem({ isAdministrator: false }, { level: 'reviewer', parts: null, expiresAt: inTwoYears }, time)).toMatch(
			/Only a steward/
		);
	});

	it('limits every place to two years and refuses dates in the past', () => {
		expect(placeProblem(steward, { level: 'editor', parts: null, expiresAt: termEnd(731, time) }, time)).toBeUndefined();
		expect(placeProblem(steward, { level: 'editor', parts: null, expiresAt: termEnd(800, time) }, time)).toMatch(/two years/);
		expect(placeProblem(steward, { level: 'editor', parts: null, expiresAt: '2026-11-01T23:59:59.999Z' }, time)).toMatch(/passed/);
	});

	it('lets a steward end others’ places, but not one the project confirmed with the office', () => {
		const granter = { ...steward, personIdentifier: 'a' };
		expect(endProblem(granter, { personIdentifier: 'b', level: 'editor', addedByProject: false })).toBeUndefined();
		expect(endProblem(granter, { personIdentifier: 'b', level: 'steward', addedByProject: true })).toMatch(/office/);
		const editor = { isAdministrator: false, level: 'editor', personIdentifier: 'c' } as const;
		expect(endProblem(editor, { personIdentifier: 'b', level: 'drafter', addedByProject: false })).toMatch(/Only a steward/);
		// Anyone may leave a team.
		expect(endProblem(editor, { personIdentifier: 'c', level: 'editor', addedByProject: false })).toBeUndefined();
	});
});

describe('nation teams in the database', () => {
	let database: D1Database;
	let lead: SignedInPerson;

	async function signIn(subject: string, email: string): Promise<SignedInPerson> {
		const result = await matchSignIn(database, { subject, email, emailVerified: true, name: email }, 'lead@example.org');
		if (result.outcome !== 'signed-in') throw new Error(result.outcome);
		return result.person;
	}

	async function addAccount(identifier: string, email: string): Promise<void> {
		await database
			.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, ?, ?)`)
			.bind(identifier, email, time.toISOString(), time.toISOString())
			.run();
	}

	const place = (email: string, level: 'steward' | 'editor' | 'drafter' | 'reviewer', nation = navajo) => ({
		nationIdentifier: nation,
		email,
		displayName: email.split('@')[0],
		level,
		parts: null,
		office: null,
		expiresAt: termEnd(365),
		basis: null,
		addedByProject: false
	});

	beforeEach(async () => {
		database = testDatabase();
		lead = await signIn('account-lead', 'lead@example.org');
	});

	it('confirms a request and gives the applicant a steward’s place on that nation only', async () => {
		await addAccount('account-a', 'a@navajo.example');
		const bucket = { put: async () => undefined, delete: async () => undefined } as never;
		const reference = await saveApplication(database, bucket, {
			accountIdentifier: 'account-a',
			email: 'a@navajo.example',
			displayName: 'A. Sample',
			nationIdentifier: navajo,
			office: 'Court administrator',
			route: 'letter',
			parts: null,
			details: null,
			proof: null
		});
		expect((await applicationsOf(database, 'account-a'))[0].status).toBe('received');
		const application = (await applicationByReference(database, reference))!;
		await markConfirming(database, application, 'Office of the President, listed in the Tribal Leaders Directory', lead);
		expect((await listApplications(database))[0].status).toBe('confirming-with-nation');
		const result = await confirmApplication(
			database,
			(await applicationByReference(database, reference))!,
			{ level: 'steward', parts: null, expiresAt: termEnd(730), basis: 'Letter of Nov. 18, 2026, confirmed by the office' },
			lead
		);
		expect(result).toMatchObject({ outcome: 'added', invited: false });

		// The account was linked at once, so the steward is signed in as a person.
		const steward = await signIn('account-a', 'a@navajo.example');
		expect(steward.role).toBe('nation-reviewer');
		expect(await accessTo(database, steward, { kind: 'nation', identifier: navajo })).toEqual({
			level: 'full',
			source: 'nation-team'
		});
		expect((await accessTo(database, steward, { kind: 'nation', identifier: hopi })).level).toBe('no-access');
		expect(allowedDecisions(steward, { kind: 'nation', identifier: navajo }, await grantsOf(database, steward.identifier))?.capacity).toBe(
			'nation'
		);
		const granter = await granterOn(database, steward, navajo);
		expect(granter).toMatchObject({ level: 'steward', parts: null });
		expect((await granterOn(database, steward, hopi)).level).toBeUndefined();
		expect((await teamOf(database, navajo))[0]).toMatchObject({ level: 'steward', addedByProject: true });
	});

	it('holds the proof for the virus check from the moment it is stored', async () => {
		const stored = new Map<string, unknown>();
		const bucket = { put: async (key: string, bytes: unknown) => void stored.set(key, bytes), delete: async () => undefined } as never;
		const reference = await saveApplication(database, bucket, {
			accountIdentifier: 'account-c',
			email: 'c@example.org',
			displayName: 'C',
			nationIdentifier: hopi,
			office: 'Staff',
			route: 'letter',
			parts: null,
			details: null,
			proof: { name: 'letter.pdf', type: 'application/pdf', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) }
		});
		const [key] = [...stored.keys()];
		expect(key).toMatch(/^nation-teams\//);
		expect(await fileScan(database, key!)).toMatchObject({ status: 'waiting', purpose: 'nation-team-proof', subject: reference });
	});

	it('lets a declined request say why', async () => {
		const bucket = { put: async () => undefined, delete: async () => undefined } as never;
		const reference = await saveApplication(database, bucket, {
			accountIdentifier: 'account-b',
			email: 'b@example.org',
			displayName: 'B',
			nationIdentifier: hopi,
			office: 'Staff',
			route: 'office',
			parts: ['contacts'],
			details: null,
			proof: null
		});
		await declineApplication(database, (await applicationByReference(database, reference))!, 'The office did not confirm.', lead);
		expect(await applicationByReference(database, reference)).toMatchObject({
			status: 'declined',
			decisionNote: 'The office did not confirm.',
			parts: ['contacts']
		});
	});

	it('invites someone new for one nation, and replaces a place rather than adding a second', async () => {
		const added = await addPlace(database, place('new@example.org', 'drafter'), lead);
		expect(added).toMatchObject({ outcome: 'added', invited: true });
		await addPlace(database, place('new@example.org', 'editor'), lead);
		const team = await teamOf(database, navajo);
		expect(team).toHaveLength(1);
		expect(team[0]).toMatchObject({ level: 'editor', personStatus: 'invited' });
	});

	it('lets the lead author’s own grant overrule a place on a team', async () => {
		await addAccount('account-e', 'e@example.org');
		await addPlace(database, place('e@example.org', 'editor'), lead);
		const editor = await signIn('account-e', 'e@example.org');
		await setGrant(
			database,
			{ personIdentifier: editor.identifier, subjectKind: 'nation', subjectIdentifier: navajo, level: 'no-access', expiresAt: null, note: 'Paused' },
			lead
		);
		expect(await accessTo(database, editor, { kind: 'nation', identifier: navajo })).toEqual({
			level: 'no-access',
			source: 'document-grant'
		});
	});

	it('suspends a person together with everyone they added, and keeps the others', async () => {
		await addAccount('account-s', 's@example.org');
		await addPlace(database, place('s@example.org', 'steward'), lead);
		const steward = await signIn('account-s', 's@example.org');
		await addAccount('account-t', 't@example.org');
		await addPlace(database, place('t@example.org', 'steward'), steward);
		const second = await signIn('account-t', 't@example.org');
		await addPlace(database, place('u@example.org', 'reviewer'), second);
		await addPlace(database, place('kept@example.org', 'editor'), lead);
		await addPlace(database, place('other-nation@example.org', 'editor', hopi), steward);

		const stewardPlace = (await placesOf(database, steward.identifier))[0];
		const names = await suspendWithEveryoneAdded(database, stewardPlace, lead);
		expect(names.sort()).toEqual(['s', 't', 'u']);
		expect((await teamOf(database, navajo)).map((row) => row.personName)).toEqual(['kept']);
		// A place on another nation's team is not touched.
		expect(await teamOf(database, hopi)).toHaveLength(1);

		const log = await teamActivity(database, navajo);
		expect(log[0].action).toMatch(/suspended/);
		await sealNewEntries(database);
		expect((await checkSeals(database)).intact).toBe(true);
	});

	it('lets a person leave, and drops expired places', async () => {
		await addAccount('account-l', 'l@example.org');
		await addPlace(database, place('l@example.org', 'editor'), lead);
		const editor = await signIn('account-l', 'l@example.org');
		await endPlace(database, (await placesOf(database, editor.identifier))[0], editor, 'left');
		expect(await placesOf(database, editor.identifier)).toEqual([]);
		expect((await accessTo(database, editor, { kind: 'nation', identifier: navajo })).level).toBe('comment');

		await addPlace(database, { ...place('l@example.org', 'editor'), expiresAt: '2026-12-01T23:59:59.999Z' }, lead);
		expect(await placesOf(database, editor.identifier, '2027-01-01T00:00:00.000Z')).toEqual([]);
	});
});
