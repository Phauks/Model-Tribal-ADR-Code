import { isHttpError, isRedirect } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { termEnd, type TeamLevel } from '#lib/nation-teams.ts';
import { setGrant } from '#lib/server/access.ts';
import { nationAndGranter } from '#lib/server/nation-team-access.ts';
import { addPlace, endPlace, placesOf } from '#lib/server/nation-teams.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

const bindings = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));
vi.mock('virtual:review-subjects', () => ({
	reviewSubjects: [
		{ kind: 'nation', identifier: 'navajo-nation', title: 'Navajo Nation, Arizona, New Mexico & Utah', file: 'content/tribes/n/navajo-nation.yaml', page: '/nations/navajo-nation' },
		{ kind: 'nation', identifier: 'hopi-tribe-of-arizona', title: 'Hopi Tribe of Arizona', file: 'content/tribes/h/hopi-tribe-of-arizona.yaml', page: null },
		{ kind: 'glossary-term', identifier: 'peacemaking', title: 'Peacemaking', file: 'content/glossary/peacemaking.yaml', page: '/glossary/peacemaking' }
	]
}));

const navajo = 'navajo-nation';
const hopi = 'hopi-tribe-of-arizona';
const bucket = { name: 'bucket' };
let database: D1Database;
let lead: SignedInPerson;

async function signIn(subject: string, email: string): Promise<SignedInPerson> {
	const result = await matchSignIn(database, { subject, email, emailVerified: true, name: email }, 'lead@example.org');
	if (result.outcome !== 'signed-in') throw new Error(result.outcome);
	return result.person;
}

/** Someone with an account and a place on a nation's team. */
async function teamMember(name: string, level: TeamLevel, { nation = navajo, expiresAt = termEnd(365) } = {}): Promise<SignedInPerson> {
	const email = `${name}@example.org`;
	await database
		.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, '2026-11-20T00:00:00Z', '2026-11-20T00:00:00Z')`)
		.bind(`account-${name}`, email)
		.run();
	await addPlace(database, { nationIdentifier: nation, email, displayName: name, level, parts: null, office: null, expiresAt, basis: null, addedByProject: false }, lead);
	return signIn(`account-${name}`, email);
}

function event(person: SignedInPerson | undefined, nation = navajo) {
	return {
		locals: { person, account: person ? { subject: person.identifier, email: person.email, name: null } : undefined, twoStepNeeded: false } as App.Locals,
		url: new URL(`https://example.org/workspace/nations/${nation}/team`),
		params: { nation }
	};
}

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
	lead = await signIn('account-lead', 'lead@example.org');
});

describe('nationAndGranter', () => {
	it('sends someone signed out to sign in', async () => {
		expect(await refusal(nationAndGranter(event(undefined)))).toBe('redirect');
	});

	it('answers 404 for a nation that is not on the list, or for another kind of record', async () => {
		expect(await refusal(nationAndGranter(event(lead, 'no-such-nation')))).toBe(404);
		expect(await refusal(nationAndGranter(event(lead, 'peacemaking')))).toBe(404);
	});

	it('lets the lead author into any nation’s team, as administrator', async () => {
		const found = await nationAndGranter(event(lead));
		expect(found.granter).toEqual({ isAdministrator: true, personIdentifier: lead.identifier });
		expect(found.nation).toMatchObject({ kind: 'nation', identifier: navajo, title: 'Navajo Nation' });
		expect(found.person).toEqual(lead);
		expect(found.database).toBe(database);
		expect(found.bucket).toBe(bucket);
	});

	it('refuses a signed-in person with no place on the team, and records why', async () => {
		await database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('editor', 'editor@example.org', 'Editor', 'editor', 'active', '2026-11-20T00:00:00Z')`)
			.run();
		const editor: SignedInPerson = { identifier: 'editor', displayName: 'Editor', email: 'editor@example.org', role: 'editor', nationIdentifier: null };
		const request = event(editor);
		expect(await refusal(nationAndGranter(request))).toBe(403);
		expect(request.locals.refused).toBe(`not on the team of nation ${navajo}`);
	});

	it('gives a team member their own level and parts on their nation', async () => {
		const drafter = await teamMember('drafter', 'drafter');
		const found = await nationAndGranter(event(drafter));
		expect(found.granter).toEqual({ isAdministrator: false, personIdentifier: drafter.identifier, level: 'drafter', parts: null });
	});

	it('does not let a place on one nation’s team open another nation’s', async () => {
		const steward = await teamMember('steward', 'steward', { nation: hopi });
		expect((await nationAndGranter(event(steward, hopi))).granter.level).toBe('steward');
		const request = event(steward, navajo);
		expect(await refusal(nationAndGranter(request))).toBe(403);
		expect(request.locals.refused).toBe(`not on the team of nation ${navajo}`);
	});

	it('refuses someone whose place has expired', async () => {
		const former = await teamMember('former', 'editor', { expiresAt: '2020-01-01T23:59:59.999Z' });
		expect(await refusal(nationAndGranter(event(former)))).toBe(403);
	});

	it('refuses someone who has left the team', async () => {
		const leaving = await teamMember('leaving', 'editor');
		expect((await nationAndGranter(event(leaving))).granter.level).toBe('editor');
		await endPlace(database, (await placesOf(database, leaving.identifier))[0], leaving, 'left');
		expect(await refusal(nationAndGranter(event(leaving)))).toBe(403);
	});

	it('goes by the place on the team, not by grants on the nation’s record', async () => {
		// A grant on the record opens the record for review, not the team's pages.
		const reviewer = await teamMember('reviewer', 'reviewer', { nation: hopi });
		await setGrant(
			database,
			{ personIdentifier: reviewer.identifier, subjectKind: 'nation', subjectIdentifier: navajo, level: 'full', expiresAt: null, note: null },
			lead
		);
		expect(await refusal(nationAndGranter(event(reviewer, navajo)))).toBe(403);
	});

	it('answers 503 while storage is not connected, after checking the nation', async () => {
		delete bindings.database;
		expect(await refusal(nationAndGranter(event(lead, 'no-such-nation')))).toBe(404);
		expect(await refusal(nationAndGranter(event(lead)))).toBe(503);
	});
});
