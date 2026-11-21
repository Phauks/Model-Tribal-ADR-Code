import { describe, expect, it } from 'vitest';
import { allowedDecisions, can, canSeeSubject, roles, type Grantee } from '#lib/permissions.ts';

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
