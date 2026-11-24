import { isHttpError, isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignedInAccount } from '#lib/server/contributor-profiles.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import { formText, refuse, requireAccount, requirePermission, requirePerson, requirePersonForData, storage } from '#lib/server/workspace.ts';

// The Worker's bindings (src/lib/server/environment.ts), which each test sets.
const bindings = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));

const account: SignedInAccount = { subject: 'account-a', email: 'a@example.org', name: 'A' };
const person = (role: SignedInPerson['role']): SignedInPerson => ({
	identifier: `person-${role}`,
	displayName: role,
	email: `${role}@example.org`,
	role,
	nationIdentifier: role === 'nation-reviewer' ? 'navajo-nation' : null
});

function event(locals: Partial<App.Locals> = {}, address = 'https://example.org/workspace/essays?view=mine') {
	return {
		locals: { person: undefined, account: undefined, session: undefined, refused: undefined, waitingSession: undefined, twoStepNeeded: false, ...locals } as App.Locals,
		url: new URL(address)
	};
}

/** What a check threw: SvelteKit's redirect() and error() both throw. */
function thrownBy(check: () => unknown): unknown {
	try {
		check();
	} catch (problem) {
		return problem;
	}
	throw new Error('The check let the request through.');
}

function redirectOf(check: () => unknown): string {
	const problem = thrownBy(check);
	if (!isRedirect(problem)) throw problem;
	expect(problem.status).toBe(303);
	return problem.location;
}

function refusalOf(check: () => unknown): { status: number; message: string } {
	const problem = thrownBy(check);
	if (!isHttpError(problem)) throw problem;
	return { status: problem.status, message: problem.body.message };
}

beforeEach(() => {
	for (const key of Object.keys(bindings)) delete bindings[key];
});

describe('requirePerson, for pages', () => {
	it('sends someone signed out to sign in, and back to the same page and query', () => {
		expect(redirectOf(() => requirePerson(event()))).toBe(`/sign-in?returnTo=${encodeURIComponent('/workspace/essays?view=mine')}`);
	});

	it('sends someone signed in without workspace access to their contributor profile', () => {
		expect(redirectOf(() => requirePerson(event({ account })))).toBe('/profile');
	});

	it('sends someone whose role needs two-step sign-in to set it up first, even when signed in', () => {
		const location = redirectOf(() => requirePerson(event({ account, person: person('editor'), twoStepNeeded: true })));
		expect(location).toBe(`/account/security/two-step?required=1&returnTo=${encodeURIComponent('/workspace/essays?view=mine')}`);
	});

	it('lets a signed-in person through', () => {
		const lead = person('lead-author');
		expect(requirePerson(event({ account, person: lead }))).toBe(lead);
	});
});

describe('requirePersonForData, for addresses the editor fetches', () => {
	it('answers 401 rather than redirecting someone signed out', () => {
		expect(refusalOf(() => requirePersonForData(event()))).toEqual({ status: 401, message: expect.stringMatching(/signed out/) });
	});

	it('answers 401 for an account with no workspace access, saying so', () => {
		expect(refusalOf(() => requirePersonForData(event({ account })))).toEqual({ status: 401, message: 'This account has no workspace access.' });
	});

	it('answers 403 while two-step sign-in is still to be set up', () => {
		expect(refusalOf(() => requirePersonForData(event({ person: person('editor'), twoStepNeeded: true }))).status).toBe(403);
	});

	it('lets a signed-in person through', () => {
		const writer = person('contributor');
		expect(requirePersonForData(event({ person: writer }))).toBe(writer);
	});
});

describe('requireAccount', () => {
	it('sends someone signed out to sign in and come back', () => {
		expect(redirectOf(() => requireAccount(event({}, 'https://example.org/profile')))).toBe('/sign-in?returnTo=%2Fprofile');
	});

	it('lets any account through, with or without workspace access', () => {
		expect(requireAccount(event({ account }))).toBe(account);
	});
});

describe('requirePermission', () => {
	it('sends someone signed out to sign in before looking at permissions', () => {
		expect(redirectOf(() => requirePermission(event(), 'manage-people'))).toMatch(/^\/sign-in\?returnTo=/);
	});

	it('refuses a person who lacks the permission, and notes why for the activity log', () => {
		const request = event({ account, person: person('co-author') });
		expect(refusalOf(() => requirePermission(request, 'manage-people'))).toEqual({ status: 403, message: 'You do not have permission to see this page.' });
		expect(request.locals.refused).toBe('lacks the manage-people permission');
	});

	it('lets a person who holds the permission through, without noting a refusal', () => {
		const editor = person('editor');
		const request = event({ account, person: editor });
		expect(requirePermission(request, 'handle-requests')).toBe(editor);
		expect(request.locals.refused).toBeUndefined();
	});

	it('follows each role’s own permissions, not a ranking of roles', () => {
		// A nation reviewer reviews for their nation, which even the lead author's list leaves out.
		expect(requirePermission(event({ person: person('nation-reviewer') }), 'review-for-nation').role).toBe('nation-reviewer');
		expect(refusalOf(() => requirePermission(event({ person: person('lead-author') }), 'review-for-nation')).status).toBe(403);
		expect(refusalOf(() => requirePermission(event({ person: person('nation-reviewer') }), 'comment')).status).toBe(403);
	});

	it('still sends someone needing two-step sign-in to set it up, even with the permission', () => {
		expect(redirectOf(() => requirePermission(event({ person: person('lead-author'), twoStepNeeded: true }), 'manage-people'))).toMatch(/^\/account\/security\/two-step/);
	});
});

describe('refuse', () => {
	it('answers 403 with the message given and records the reason', () => {
		const request = event({ person: person('editor') });
		expect(refusalOf(() => refuse(request, 'not on the team', 'Not yours.'))).toEqual({ status: 403, message: 'Not yours.' });
		expect(request.locals.refused).toBe('not on the team');
	});
});

describe('storage', () => {
	it('answers 503 while the database or the bucket is not connected', () => {
		expect(refusalOf(() => storage(event())).status).toBe(503);
		bindings.database = {};
		expect(refusalOf(() => storage(event())).status).toBe(503);
	});

	it('gives the database and the bucket once both are connected', () => {
		const database = { name: 'database' };
		const bucket = { name: 'bucket' };
		Object.assign(bindings, { database, sourceDocuments: bucket });
		expect(storage(event())).toEqual({ database, bucket });
	});
});

describe('formText', () => {
	it('trims the field, and gives null for an empty or missing one or a file', () => {
		const form = new FormData();
		form.set('note', '  Hello  ');
		form.set('blank', '   ');
		form.set('upload', new File(['x'], 'x.txt'));
		expect(formText(form, 'note')).toBe('Hello');
		expect(formText(form, 'blank')).toBeNull();
		expect(formText(form, 'missing')).toBeNull();
		expect(formText(form, 'upload')).toBeNull();
	});

	it('cuts long text to the maximum and composes accents into single characters', () => {
		const form = new FormData();
		form.set('name', 'Cafe\u0301 society');
		form.set('long', 'abcdef');
		expect(formText(form, 'name')).toBe('Café society');
		expect(formText(form, 'long', 3)).toBe('abc');
	});
});
