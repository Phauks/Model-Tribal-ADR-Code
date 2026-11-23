import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { dueDate, inReviewText, isCalendarDate, isOpen, openRequestsOn, waitsOn, type ReviewRequest } from '../src/lib/essays/review-requests.ts';
import {
	closeReviewRequest,
	essayPeople,
	essayReviewRequests,
	finishReview,
	requestReview,
	reviewRequestCount,
	reviewRequestsOf
} from '#lib/server/essay-review-requests.ts';
import { testDatabase } from './database.ts';

describe('review request wording', () => {
	const request: ReviewRequest = {
		identifier: 'r1',
		essay: 'i-timeline',
		sectionSlug: 'the-cherokee-cases',
		sectionTitle: 'The Cherokee Cases',
		dueOn: '2026-11-27',
		message: null,
		versionNumber: 4,
		requestedBy: 'lead',
		requestedByName: 'Lead',
		createdAt: '2026-11-23T00:00:00Z',
		closedAt: null,
		reviewers: [
			{ personIdentifier: 'ann', personName: 'Ann', doneAt: null },
			{ personIdentifier: 'ben', personName: 'Ben', doneAt: null },
			{ personIdentifier: 'cal', personName: 'Cal', doneAt: '2026-11-24T00:00:00Z' }
		]
	};
	const thisYear = new Date('2026-11-23T12:00:00Z');

	it('names who still has to finish, and the date with its weekday', () => {
		expect(inReviewText(request, thisYear)).toBe('In review with Ann and Ben, due Friday, November 27');
		expect(dueDate('2027-01-04', thisYear)).toBe('Monday, January 4, 2027');
		expect(inReviewText({ ...request, dueOn: null }, thisYear)).toBe('In review with Ann and Ben');
	});

	it('knows whether a request is open and whom it waits on', () => {
		expect(isOpen(request)).toBe(true);
		expect(waitsOn(request, 'ann')).toBe(true);
		expect(waitsOn(request, 'cal')).toBe(false);
		expect(isOpen({ ...request, closedAt: '2026-11-25T00:00:00Z' })).toBe(false);
		expect(openRequestsOn([request], 'the-cherokee-cases')).toHaveLength(1);
		expect(openRequestsOn([request], null)).toHaveLength(0);
	});

	it('accepts only real calendar dates', () => {
		expect(isCalendarDate('2026-11-27')).toBe(true);
		expect(isCalendarDate('2026-02-30')).toBe(false);
		expect(isCalendarDate('11/27/2026')).toBe(false);
		expect(isCalendarDate(null)).toBe(false);
	});
});

describe('sharing and review requests in the database', () => {
	let database: D1Database;
	beforeEach(async () => {
		database = testDatabase();
		const person = (identifier: string, name: string, role: string, status = 'active') =>
			database
				.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES (?, ?, ?, ?, ?, '2026-11-22T00:00:00Z')`)
				.bind(identifier, `${identifier}@example.org`, name, role, status);
		await database.batch([
			person('lead', 'Lead', 'lead-author'),
			person('ann', 'Ann', 'co-author'),
			person('ben', 'Ben', 'contributor'),
			person('cal', 'Cal', 'co-author', 'removed'),
			database.prepare(`INSERT INTO essays (identifier, part, created_at) VALUES ('i-timeline', 'foundations', '2026-11-22T00:00:00Z')`),
			database.prepare(
				`INSERT INTO essay_versions (essay_identifier, number, object_key, sha256, bytes, title, person_identifier, origin, created_at)
				 VALUES ('i-timeline', 1, 'essays/i-timeline/versions/1-abc.md', 'abc', 10, 'Legal History Timeline', 'lead', 'editor', '2026-11-22T00:00:00Z')`
			)
		]);
	});

	it('lists who can open the essay from roles and grants, and everyone else for the lead author', async () => {
		expect((await essayPeople(database, 'i-timeline')).map((person) => [person.name, person.level])).toEqual([
			['Lead', 'full'],
			['Ann', 'comment']
		]);
		await database
			.prepare(
				`INSERT INTO access_grants (identifier, person_identifier, subject_kind, subject_identifier, level, granted_by, granted_at)
				 VALUES ('g1', 'ben', 'essay', 'i-timeline', 'contribute', 'lead', '2026-11-22T00:00:00Z')`
			)
			.run();
		expect((await essayPeople(database, 'i-timeline')).map((person) => person.name)).toEqual(['Lead', 'Ann', 'Ben']);
		expect((await essayPeople(database, 'other-essay', { everyone: true })).map((person) => [person.name, person.level])).toEqual([
			['Lead', 'full'],
			['Ann', 'comment'],
			['Ben', 'no-access']
		]);
	});

	it('asks for review, finishes each review, and closes when everyone is done', async () => {
		const request = await requestReview(database, {
			essay: 'i-timeline',
			requestedBy: 'lead',
			reviewers: ['ann', 'ben', 'ann'],
			section: { slug: 'the-cherokee-cases', title: 'The Cherokee Cases' },
			dueOn: '2026-11-27',
			message: '  Could you check the holdings?  ',
			versionNumber: 1
		});
		let [stored] = await essayReviewRequests(database, 'i-timeline');
		expect(stored).toMatchObject({ sectionTitle: 'The Cherokee Cases', dueOn: '2026-11-27', message: 'Could you check the holdings?', requestedByName: 'Lead' });
		expect(stored.reviewers.map((reviewer) => reviewer.personName)).toEqual(['Ann', 'Ben']);
		expect(await reviewRequestCount(database, 'ann')).toBe(1);

		const ann = await reviewRequestsOf(database, 'ann');
		expect(ann.forYou[0]).toMatchObject({ essayTitle: 'Legal History Timeline', link: '/foundations/timeline?review=the-cherokee-cases' });
		expect((await reviewRequestsOf(database, 'lead')).yours).toHaveLength(1);

		expect(await finishReview(database, { essay: 'i-timeline', request, person: 'lead' })).toBe(false);
		expect(await finishReview(database, { essay: 'i-timeline', request, person: 'ann' })).toBe(true);
		[stored] = await essayReviewRequests(database, 'i-timeline');
		expect(isOpen(stored)).toBe(true);
		expect(await reviewRequestCount(database, 'ann')).toBe(0);
		await finishReview(database, { essay: 'i-timeline', request, person: 'ben' });
		[stored] = await essayReviewRequests(database, 'i-timeline');
		expect(stored.closedAt).not.toBeNull();

		const logged = await database.prepare(`SELECT action FROM events WHERE target_identifier = 'essay:i-timeline' ORDER BY sequence`).all<{ action: string }>();
		expect(logged.results.map((row) => row.action)).toEqual([
			'Asked 2 people to review "The Cherokee Cases"',
			'Finished reviewing "The Cherokee Cases"',
			'Finished reviewing "The Cherokee Cases"'
		]);
	});

	it('lets only the asker or full access close a request, and never deletes one', async () => {
		const request = await requestReview(database, {
			essay: 'i-timeline',
			requestedBy: 'ann',
			reviewers: ['ben'],
			section: null,
			dueOn: null,
			message: null,
			versionNumber: null
		});
		expect(await closeReviewRequest(database, { essay: 'i-timeline', request, person: 'ben', mayCloseAny: false })).toBe(false);
		expect(await closeReviewRequest(database, { essay: 'other', request, person: 'ann', mayCloseAny: true })).toBe(false);
		expect(await closeReviewRequest(database, { essay: 'i-timeline', request, person: 'lead', mayCloseAny: true })).toBe(true);
		expect((await reviewRequestsOf(database, 'ben')).forYou).toHaveLength(0);
		await expect(database.prepare('DELETE FROM essay_review_requests').run()).rejects.toThrow();
		await expect(database.prepare(`UPDATE essay_review_requests SET message = 'changed'`).run()).rejects.toThrow();
		await expect(requestReview(database, { essay: 'i-timeline', requestedBy: 'ann', reviewers: [], section: null, dueOn: null, message: null, versionNumber: null })).rejects.toThrow(
			'Choose who should review it.'
		);
	});
});
