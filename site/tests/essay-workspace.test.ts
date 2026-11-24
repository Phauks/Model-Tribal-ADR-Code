import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { everyDocument, type AccessLevel } from '#lib/permissions.ts';
import { endGrant, grantByIdentifier, listGrants, setGrant } from '#lib/server/access.ts';
import { canStartEssays, essayAccess, essayLevels, levelOn } from '#lib/server/essay-workspace.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

const bindings = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));
vi.mock('virtual:essay-library', () => ({ essaysInGit: {} }));

const essay = 'i-key-cases-digest';
const otherEssay = 'i-legal-history-timeline';
const bucket = { name: 'bucket' };
let database: D1Database;
let lead: SignedInPerson;
let writer: SignedInPerson;
let coAuthor: SignedInPerson;

async function addPerson(identifier: string, role: SignedInPerson['role']): Promise<SignedInPerson> {
	await database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES (?, ?, ?, ?, 'active', '2026-11-20T00:00:00Z')`)
		.bind(identifier, `${identifier}@example.org`, identifier, role)
		.run();
	return { identifier, displayName: identifier, email: `${identifier}@example.org`, role, nationIdentifier: null };
}

function grant(person: SignedInPerson, level: AccessLevel, { subject = essay, expiresAt = null as string | null } = {}) {
	return setGrant(database, { personIdentifier: person.identifier, subjectKind: 'essay', subjectIdentifier: subject, level, expiresAt, note: null }, lead);
}

function event(person: SignedInPerson | undefined, identifier: string | null = essay) {
	return {
		locals: { person, account: person ? { subject: person.identifier, email: person.email, name: null } : undefined, twoStepNeeded: false } as App.Locals,
		url: new URL(`https://example.org/workspace/essays/${identifier}`),
		params: identifier === null ? {} : { id: identifier }
	};
}

/** The status a refused check answers with, or "redirect" for a redirect to sign in. */
async function refusal(check: Promise<unknown>): Promise<number | 'redirect'> {
	try {
		await check;
	} catch (problem) {
		if (isRedirect(problem)) return 'redirect';
		if (isHttpError(problem)) return problem.status;
		throw problem;
	}
	throw new Error('The check let the request through.');
}

beforeEach(async () => {
	for (const key of Object.keys(bindings)) delete bindings[key];
	database = testDatabase();
	Object.assign(bindings, { database, sourceDocuments: bucket });
	lead = await addPerson('lead', 'lead-author');
	writer = await addPerson('writer', 'contributor');
	coAuthor = await addPerson('co-author', 'co-author');
});

describe('essayAccess', () => {
	it('sends someone signed out to sign in, or answers 401 for the editor’s fetches', async () => {
		expect(await refusal(essayAccess(event(undefined), 'comment'))).toBe('redirect');
		expect(await refusal(essayAccess(event(undefined), 'comment', { forData: true }))).toBe(401);
	});

	it('answers 404 for an address that cannot be an essay, before reading any grant', async () => {
		expect(await refusal(essayAccess(event(lead, 'Not An Essay'), 'comment'))).toBe(404);
		expect(await refusal(essayAccess(event(lead, '../secrets'), 'comment'))).toBe(404);
		expect(await refusal(essayAccess(event(lead, null), 'comment'))).toBe(404);
	});

	it('answers 503 while storage is not connected', async () => {
		delete bindings.sourceDocuments;
		expect(await refusal(essayAccess(event(lead), 'comment'))).toBe(503);
	});

	it('refuses a contributor with no grant, and records why', async () => {
		const request = event(writer);
		expect(await refusal(essayAccess(request, 'comment'))).toBe(403);
		expect(request.locals.refused).toBe(`needs comment on essay ${essay}, has no-access`);
	});

	it('gives the person, the essay, storage and the level when the level is enough', async () => {
		await grant(writer, 'contribute');
		const access = await essayAccess(event(writer), 'contribute');
		expect(access).toEqual({ person: writer, identifier: essay, database, bucket, level: 'contribute' });
	});

	it('refuses a level above the one granted', async () => {
		await grant(writer, 'contribute');
		expect(await refusal(essayAccess(event(writer), 'full'))).toBe(403);
	});

	it('does not carry a grant on one essay over to another', async () => {
		await grant(writer, 'full');
		expect(await refusal(essayAccess(event(writer, otherEssay), 'comment'))).toBe(403);
	});

	it('does not count a grant that has expired', async () => {
		await grant(writer, 'full', { expiresAt: '2020-01-01T00:00:00.000Z' });
		expect(await refusal(essayAccess(event(writer), 'comment'))).toBe(403);
	});

	it('does not count a grant the lead author ended', async () => {
		await grant(writer, 'full');
		const [current] = await listGrants(database, writer.identifier);
		await endGrant(database, (await grantByIdentifier(database, current.identifier))!, lead);
		expect(await refusal(essayAccess(event(writer), 'comment'))).toBe(403);
	});

	it('lets a co-author comment by their role, and a grant of no access take that away for one essay', async () => {
		expect((await essayAccess(event(coAuthor), 'comment')).level).toBe('comment');
		expect(await refusal(essayAccess(event(coAuthor), 'contribute'))).toBe(403);
		await grant(coAuthor, 'no-access');
		expect(await refusal(essayAccess(event(coAuthor), 'comment'))).toBe(403);
		expect((await essayAccess(event(coAuthor, otherEssay), 'comment')).level).toBe('comment');
	});

	it('lets a grant on one essay outrank a grant on every essay', async () => {
		await grant(writer, 'comment', { subject: everyDocument });
		await grant(writer, 'full');
		expect((await essayAccess(event(writer), 'full')).level).toBe('full');
		expect((await essayAccess(event(writer, otherEssay), 'comment')).level).toBe('comment');
	});

	it('always gives the lead author full access, whatever their grants say', async () => {
		await grant(lead, 'no-access');
		expect((await essayAccess(event(lead), 'full')).level).toBe('full');
	});
});

describe('levels on essays', () => {
	it('gives the same level for one essay as the list of every essay', async () => {
		await grant(writer, 'contribute');
		const levelFor = await essayLevels(database, writer);
		for (const identifier of [essay, otherEssay]) expect(levelFor(identifier)).toBe(await levelOn(database, writer, identifier));
		expect(levelFor(essay)).toBe('contribute');
		expect(levelFor(otherEssay)).toBe('no-access');
	});

	it('lets only those with full access to every essay start a new one', async () => {
		expect(await canStartEssays(database, lead)).toBe(true);
		expect(await canStartEssays(database, coAuthor)).toBe(false);
		// Full access to one essay is not enough.
		await grant(writer, 'full');
		expect(await canStartEssays(database, writer)).toBe(false);
		await grant(writer, 'full', { subject: everyDocument });
		expect(await canStartEssays(database, writer)).toBe(true);
	});
});
