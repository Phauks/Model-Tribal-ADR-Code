import { describe, expect, it } from 'vitest';
import {
	accessLevels,
	allowedDecisions,
	atLeast,
	can,
	canSeeSubject,
	documentAccess,
	everyDocument,
	roles,
	type AccessGrant,
	type Grantee
} from '#lib/permissions.ts';

const person = (role: Grantee['role'], nationIdentifier: string | null = null): Grantee => ({
	role,
	nationIdentifier
});

describe('permissions', () => {
	it('lets only the lead author manage people', () => {
		for (const role of roles) {
			expect(can(person(role, role === 'nation-reviewer' ? 'a' : null), 'manage-people')).toBe(
				role === 'lead-author'
			);
		}
	});

	it('lets only the lead author read the project inbox and send outreach', () => {
		for (const permission of ['read-mail', 'send-outreach', 'manage-mail'] as const) {
			expect(roles.filter((role) => can(person(role, role === 'nation-reviewer' ? 'a' : null), permission))).toEqual(['lead-author']);
		}
	});

	it('lets only the lead author and editors read and handle requests', () => {
		const allowed = roles.filter((role) => can(person(role), 'handle-requests'));
		expect(allowed).toEqual(['lead-author', 'editor']);
		expect(roles.filter((role) => can(person(role), 'read-requests'))).toEqual(['lead-author', 'editor']);
	});

	it('limits a nation reviewer to their own nation', () => {
		const reviewer = person('nation-reviewer', 'sample-nation');
		expect(canSeeSubject(reviewer, { kind: 'nation', identifier: 'sample-nation' })).toBe(true);
		expect(canSeeSubject(reviewer, { kind: 'nation', identifier: 'other-nation' })).toBe(false);
		expect(canSeeSubject(reviewer, { kind: 'glossary-term', identifier: 'sample-nation' })).toBe(false);
		expect(allowedDecisions(reviewer, { kind: 'nation', identifier: 'sample-nation' })).toEqual({
			capacity: 'nation',
			decisions: ['approved', 'changes-requested', 'comment']
		});
		expect(allowedDecisions(reviewer, { kind: 'nation', identifier: 'other-nation' })).toBeUndefined();
	});

	it('lets co-authors comment but not sign off', () => {
		expect(allowedDecisions(person('co-author'), { kind: 'essay', identifier: 'one' })).toEqual({
			capacity: 'co-author',
			decisions: ['comment']
		});
	});

	it('records advisors and editors in their own capacity', () => {
		const subject = { kind: 'provision', identifier: 'mediation-1' } as const;
		expect(allowedDecisions(person('advisor'), subject)?.capacity).toBe('advisor');
		expect(allowedDecisions(person('editor'), subject)?.capacity).toBe('editor');
		expect(allowedDecisions(person('lead-author'), subject)?.decisions).toContain('approved');
	});
});

describe('access to each document', () => {
	const essay = { kind: 'essay', identifier: 'i-key-cases-digest' } as const;
	const otherEssay = { kind: 'essay', identifier: 'i-legal-history-timeline' } as const;
	const grant = (
		subjectIdentifier: string,
		level: AccessGrant['level'],
		expiresAt: string | null = null
	): AccessGrant => ({ subjectKind: 'essay', subjectIdentifier, level, expiresAt });

	it('orders the levels and has no view-only level', () => {
		expect(accessLevels).toEqual(['no-access', 'comment', 'contribute', 'full']);
		expect(atLeast('full', 'contribute')).toBe(true);
		expect(atLeast('comment', 'contribute')).toBe(false);
	});

	it('starts each role at its default', () => {
		expect(documentAccess(person('co-author'), essay, [])).toEqual({ level: 'comment', source: 'role' });
		expect(documentAccess(person('editor'), essay, []).level).toBe('contribute');
		expect(documentAccess(person('contributor'), essay, []).level).toBe('no-access');
		expect(documentAccess(person('nation-reviewer', 'a'), essay, []).level).toBe('no-access');
	});

	it('always gives the lead author full access, whatever the grants say', () => {
		expect(documentAccess(person('lead-author'), essay, [grant(essay.identifier, 'no-access')])).toEqual({
			level: 'full',
			source: 'administrator'
		});
	});

	it('lets a document grant beat a kind grant, and a kind grant beat the role', () => {
		const grants = [grant(everyDocument, 'contribute'), grant(essay.identifier, 'no-access')];
		expect(documentAccess(person('co-author'), essay, grants)).toEqual({
			level: 'no-access',
			source: 'document-grant'
		});
		expect(documentAccess(person('co-author'), otherEssay, grants)).toEqual({
			level: 'contribute',
			source: 'kind-grant'
		});
		// A kind grant covers drafts that have no file yet.
		expect(documentAccess(person('co-author'), { kind: 'essay', identifier: 'ii-planned' }, grants).level).toBe(
			'contribute'
		);
		// It covers only its own kind.
		expect(documentAccess(person('co-author'), { kind: 'nation', identifier: 'x' }, grants).level).toBe('comment');
	});

	it('ignores expired grants', () => {
		const time = new Date('2026-12-01T00:00:00Z');
		const grants = [grant(essay.identifier, 'full', '2026-11-30T23:59:59.999Z')];
		expect(documentAccess(person('contributor'), essay, grants, time).level).toBe('no-access');
		expect(documentAccess(person('contributor'), essay, grants, new Date('2026-11-30T12:00:00Z')).level).toBe('full');
	});

	it('lets a lead author restrict a co-author from one essay, which hides it and stops comments', () => {
		const grants = [grant(essay.identifier, 'no-access')];
		expect(canSeeSubject(person('co-author'), essay, grants)).toBe(false);
		expect(allowedDecisions(person('co-author'), essay, grants)).toBeUndefined();
		expect(canSeeSubject(person('co-author'), otherEssay, grants)).toBe(true);
	});

	it('lets a contributor comment only where granted, never sign off', () => {
		expect(allowedDecisions(person('contributor'), essay, [])).toBeUndefined();
		expect(allowedDecisions(person('contributor'), essay, [grant(essay.identifier, 'full')])).toEqual({
			capacity: 'contributor',
			decisions: ['comment']
		});
	});

	it('lets a nation reviewer given another document only comment on it', () => {
		const reviewer = person('nation-reviewer', 'sample-nation');
		expect(allowedDecisions(reviewer, essay, [grant(essay.identifier, 'comment')])).toEqual({
			capacity: 'nation',
			decisions: ['comment']
		});
	});
});
