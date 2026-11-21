import { describe, expect, it } from 'vitest';
import { deadlinesOf, statusesFor, type DeadlineInput } from '#lib/requests.ts';
import { isRequestReference, newRequestReference } from '#lib/server/identifiers.ts';

const base: DeadlineInput = {
	kind: 'restrict',
	status: 'received',
	outcome: null,
	receivedAt: '2026-11-01T12:00:00.000Z',
	acknowledgedAt: null,
	materialHiddenAt: null,
	resolvedAt: null
};

describe('request deadlines (docs/requests.md)', () => {
	it('asks to acknowledge and hide within 7 days of receipt', () => {
		const deadlines = deadlinesOf(base, new Date('2026-11-05T00:00:00Z'));
		expect(deadlines.map((deadline) => [deadline.label, deadline.due.slice(0, 10), deadline.overdue])).toEqual([
			['Acknowledge by', '2026-11-08', false],
			['Hide the material by', '2026-11-08', false]
		]);
	});

	it('marks a missed target as past', () => {
		const deadlines = deadlinesOf(base, new Date('2026-11-09T00:00:00Z'));
		expect(deadlines.every((deadline) => deadline.overdue)).toBe(true);
	});

	it('drops the hiding target once the material is hidden, and asks for a decision within 30 days', () => {
		const deadlines = deadlinesOf(
			{
				...base,
				status: 'hidden-pending-review',
				acknowledgedAt: '2026-11-02T12:00:00.000Z',
				materialHiddenAt: '2026-11-02T12:00:00.000Z'
			},
			new Date('2026-11-05T00:00:00Z')
		);
		expect(deadlines.map((deadline) => [deadline.label, deadline.due.slice(0, 10)])).toEqual([
			['Decide by', '2026-12-02']
		]);
	});

	it('offers reconsideration for 60 days after declining to add a nation', () => {
		const declined: DeadlineInput = {
			...base,
			kind: 'add-nation',
			status: 'resolved',
			outcome: 'declined',
			resolvedAt: '2026-11-10T00:00:00.000Z'
		};
		expect(deadlinesOf(declined, new Date('2026-12-01T00:00:00Z'))[0]?.due.slice(0, 10)).toBe('2027-01-09');
		expect(deadlinesOf(declined, new Date('2027-02-01T00:00:00Z'))).toEqual([]);
	});

	it('offers each status only to the kinds it applies to', () => {
		expect(statusesFor('restrict')).toContain('hidden-pending-review');
		expect(statusesFor('restrict')).not.toContain('checking-proof');
		expect(statusesFor('add-nation')).toContain('checking-proof');
		expect(statusesFor('add-nation')).not.toContain('hidden-pending-review');
		expect(statusesFor('question')).not.toContain('hidden-pending-review');
	});
});

describe('request references', () => {
	it('starts with the date and avoids letters that are easy to misread', () => {
		const reference = newRequestReference(new Date('2026-11-21T10:00:00Z'));
		expect(reference).toMatch(/^20261121-[0-9A-HJKMNP-TV-Z]{6}$/);
		expect(isRequestReference(reference)).toBe(true);
		expect(isRequestReference('20261121-ILOU00')).toBe(false);
		expect(isRequestReference('../../etc')).toBe(false);
	});
});
