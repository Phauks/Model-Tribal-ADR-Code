/**
 * The workspace's Source watch page (src/lib/server/watch/review.ts): the
 * views, the filters and what a person decides, against a test database.
 */
import { describe, expect, it } from 'vitest';
import { decide, readFilters, readView, reviewList, viewsFor } from '../src/lib/server/watch/review.ts';
import { addCandidate, type Candidate } from '../src/lib/server/watch/store.ts';
import { can } from '../src/lib/permissions.ts';
import { feedLabel } from '../src/lib/watch-labels.ts';
import { testDatabase } from './database.ts';

const now = new Date('2026-11-26T12:00:00Z');

function candidate(overrides: Partial<Candidate>): Candidate {
	return {
		watcher: 'federal-register',
		sourceIdentifier: '2026-1',
		kind: 'notice',
		title: 'A notice',
		publishedOn: '2026-11-18',
		link: 'https://www.federalregister.gov/d/2026-1',
		feeds: ['federal-register-notices'],
		nations: [],
		facts: {},
		summary: null,
		captureKey: null,
		captureSha256: null,
		previousCaptureKey: null,
		difference: null,
		matchKind: 'none',
		matchRecord: null,
		proposed: 'add',
		relevance: 0.9,
		triage: [],
		sensitivity: [],
		noModelText: false,
		hosting: 'serve',
		tier: 1,
		status: 'to-review',
		...overrides
	};
}

async function seeded() {
	const database = testDatabase();
	await database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'lead@example.org', 'Lead', 'lead-author', 'active', '2026-11-01')`).run();
	await addCandidate(database, candidate({ sourceIdentifier: '2026-1', feeds: ['intergovernmental-agreements', 'nation:gaming'], nations: ['pechanga'], proposed: 'new-version', matchRecord: 'pechanga-compact-2020' }), now);
	await addCandidate(database, candidate({ sourceIdentifier: '2026-2', title: 'Another', publishedOn: '2026-11-20' }), now);
	await addCandidate(database, candidate({ sourceIdentifier: '2026-3', status: 'held', sensitivity: ['child-or-family-case'] }), now);
	await addCandidate(database, candidate({ sourceIdentifier: '2026-4', status: 'closed-by-rules', proposed: null }), now);
	await addCandidate(database, candidate({ sourceIdentifier: '2026-5', status: 'waiting-for-model' }), now);
	return database;
}

describe('the Source watch review page', () => {
	it('lets the lead author and editors review, and keeps Held for the lead author', () => {
		expect(can({ role: 'lead-author', nationIdentifier: null }, 'review-watch')).toBe(true);
		expect(can({ role: 'editor', nationIdentifier: null }, 'review-watch')).toBe(true);
		expect(can({ role: 'co-author', nationIdentifier: null }, 'review-watch')).toBe(false);
		expect(viewsFor(false)).not.toContain('held');
		expect(readView('held', false)).toBe('to-review');
		expect(readView('held', true)).toBe('held');
		expect(readView('nonsense', true)).toBe('to-review');
	});

	it('lists a view newest first with counts, and filters by collection and nation', async () => {
		const database = await seeded();
		const list = await reviewList(database, 'to-review', {});
		expect(list.items.map((item) => item.sourceIdentifier)).toEqual(['2026-2', '2026-1']);
		expect(list.counts).toEqual({ 'to-review': 2, held: 1, closed: 1, done: 0 });
		expect(list.waitingForModel).toBe(1);
		expect(list.choices.collection).toContain('intergovernmental-agreements');
		expect((await reviewList(database, 'to-review', readFilters(new URLSearchParams('collection=intergovernmental-agreements')))).total).toBe(1);
		expect((await reviewList(database, 'to-review', { nation: 'pechanga' })).items[0].sourceIdentifier).toBe('2026-1');
		expect((await reviewList(database, 'to-review', { proposed: 'new-version' })).total).toBe(1);
	});

	it('records a decision, and lets it be undone', async () => {
		const database = await seeded();
		const [first] = (await reviewList(database, 'to-review', { nation: 'pechanga' })).items;
		expect(await decide(database, { identifier: first.identifier, decision: 'new-version' }, { identifier: 'lead', isLeadAuthor: true }, now)).toEqual({ status: 'new-version' });
		const done = await reviewList(database, 'done', {});
		expect(done.items[0]).toMatchObject({ status: 'new-version', decidedBy: 'lead' });
		expect(done.items[0].triage.at(-1)).toMatchObject({ step: 'person', answer: 'new-version' });
		await decide(database, { identifier: first.identifier, decision: 'reopen' }, { identifier: 'lead', isLeadAuthor: true }, now);
		expect((await reviewList(database, 'to-review', {})).total).toBe(2);
	});

	it('asks which record an item is the same as, and keeps held items from editors', async () => {
		const database = await seeded();
		const another = (await reviewList(database, 'to-review', {})).items[0];
		expect(await decide(database, { identifier: another.identifier, decision: 'same-as' }, { identifier: 'lead', isLeadAuthor: true }, now)).toHaveProperty('problem');
		expect(await decide(database, { identifier: another.identifier, decision: 'same-as', record: 'some-record' }, { identifier: 'lead', isLeadAuthor: true }, now)).toEqual({ status: 'same-as' });
		const [held] = (await reviewList(database, 'held', {})).items;
		expect(await decide(database, { identifier: held.identifier, decision: 'add' }, { identifier: 'lead', isLeadAuthor: false }, now)).toHaveProperty('problem');
	});

	it('names collections and nation page parts', () => {
		expect(feedLabel('treaties', { treaties: 'Treaties and Agreements' })).toBe('Treaties and Agreements');
		expect(feedLabel('unknown-collection', {})).toBe('unknown-collection');
		expect(feedLabel('nation:land_establishment', {})).toBe('Nation page: land establishment');
	});
});
