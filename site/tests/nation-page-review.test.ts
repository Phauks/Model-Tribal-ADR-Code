import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { isOverdue, pauseProblem, reviewDue } from '#lib/nation-page-review.ts';
import { termEnd } from '#lib/nation-teams.ts';
import { checkSeals, sealNewEntries } from '#lib/server/activity-seals.ts';
import { liveChanges, publishChange, saveDraft } from '#lib/server/nation-page-changes.ts';
import {
	answerPause,
	currentPause,
	currentPauses,
	markRead,
	pausePublishing,
	recentReviews,
	resumePublishing,
	reviewCounts,
	reviewQueue,
	undoChange,
	undoneChanges
} from '#lib/server/nation-page-review.ts';
import { addPlace } from '#lib/server/nation-teams.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { testDatabase } from './database.ts';

const navajo = 'navajo-nation';
const time = new Date('2026-11-23T12:00:00Z');

describe('the rules for the project’s review', () => {
	it('gives the project seven days to read a change', () => {
		expect(reviewDue('2026-11-23T12:00:00.000Z')).toBe('2026-11-30T12:00:00.000Z');
		expect(isOverdue('2026-11-23T12:00:00.000Z', new Date('2026-11-30T11:59:00Z'))).toBe(false);
		expect(isOverdue('2026-11-23T12:00:00.000Z', new Date('2026-11-30T12:00:00Z'))).toBe(true);
	});

	it('stops publishing while paused, but never stops a nation hiding something', () => {
		expect(pauseProblem(false, 'about')).toBeUndefined();
		expect(pauseProblem(true, 'about')).toMatch(/paused/);
		expect(pauseProblem(true, 'contacts')).toMatch(/paused/);
		expect(pauseProblem(true, 'hidden')).toBeUndefined();
	});
});

describe('the project’s review in the database', () => {
	let database: D1Database;
	let lead: SignedInPerson;
	let editor: SignedInPerson;

	async function signIn(subject: string, email: string): Promise<SignedInPerson> {
		const result = await matchSignIn(database, { subject, email, emailVerified: true, name: email }, 'lead@example.org');
		if (result.outcome !== 'signed-in') throw new Error(result.outcome);
		return result.person;
	}

	const about = (text: string) => ({ nationIdentifier: navajo, kind: 'about' as const, content: { text }, credit: 'Navajo Nation' });

	beforeEach(async () => {
		database = testDatabase();
		lead = await signIn('account-lead', 'lead@example.org');
		await database
			.prepare(`INSERT INTO accounts (identifier, email, email_verified_at, created_at) VALUES (?, ?, ?, ?)`)
			.bind('account-e', 'e@navajo.example', time.toISOString(), time.toISOString())
			.run();
		await addPlace(
			database,
			{ nationIdentifier: navajo, email: 'e@navajo.example', displayName: 'e', level: 'editor', parts: null, office: null, expiresAt: termEnd(365), basis: null, addedByProject: false },
			lead
		);
		editor = await signIn('account-e', 'e@navajo.example');
	});

	it('lists published changes oldest first, including contacts still waiting, but not drafts', async () => {
		await publishChange(database, about('First words.'), editor, new Date('2026-11-01T00:00:00Z'));
		await publishChange(
			database,
			{ nationIdentifier: navajo, kind: 'contacts', content: { contacts: [{ office: 'Courts', kind: 'email', value: 'courts@navajo.example' }] }, credit: 'Navajo Nation' },
			editor,
			new Date('2026-11-22T00:00:00Z')
		);
		await saveDraft(database, about('Not yet.'), editor);
		const queue = await reviewQueue(database);
		expect(queue.map((change) => change.kind)).toEqual(['about', 'contacts']);
		expect(await reviewCounts(database, '2026-11-16T00:00:00Z')).toEqual({ waiting: 2, overdue: 1 });
	});

	it('takes a change off the list once the project reads it', async () => {
		await publishChange(database, about('Our words.'), editor, time);
		const [change] = await reviewQueue(database);
		await markRead(database, change, lead, null);
		expect(await reviewQueue(database)).toEqual([]);
		const [recent] = await recentReviews(database);
		expect(recent.outcome).toBe('read');
		expect(recent.change.identifier).toBe(change.identifier);
		expect(recent.reviewedByName).toBeTruthy();
		// The change stays on the page.
		expect((await liveChanges(database, navajo, '2026-11-24T00:00:00Z')).about?.content.text).toBe('Our words.');
	});

	it('puts the page back to the version before when the project undoes a change, and tells the team why', async () => {
		await publishChange(database, about('Earlier words.'), editor, new Date('2026-11-20T00:00:00Z'));
		await publishChange(database, about('Later words.'), editor, new Date('2026-11-21T00:00:00Z'));
		const later = (await reviewQueue(database)).find((change) => (change.content as { text?: string }).text === 'Later words.');
		if (!later) throw new Error('missing');
		await undoChange(database, later, lead, 'This names a private person.');
		expect((await liveChanges(database, navajo)).about?.content.text).toBe('Earlier words.');
		expect((await undoneChanges(database, navajo)).get(later.identifier)).toBe('This names a private person.');
		expect((await reviewQueue(database)).map((change) => (change.content as { text?: string }).text)).toEqual(['Earlier words.']);
	});

	it('pauses a nation’s publishing once, takes the team’s answer, and resumes', async () => {
		expect(await pausePublishing(database, navajo, 'Who took this picture?', lead)).toBe(true);
		expect(await pausePublishing(database, navajo, 'Again?', lead)).toBe(false);
		const pause = await currentPause(database, navajo);
		expect(pause?.question).toBe('Who took this picture?');
		if (!pause) throw new Error('missing');
		await answerPause(database, pause, 'Our tribal photographer, with permission.', editor);
		expect((await currentPause(database, navajo))?.answer).toBe('Our tribal photographer, with permission.');
		expect(await currentPauses(database)).toHaveLength(1);
		await resumePublishing(database, pause, lead);
		expect(await currentPause(database, navajo)).toBeUndefined();
		// A new pause can follow once the last one is over.
		expect(await pausePublishing(database, navajo, 'One more question.', lead)).toBe(true);
	});

	it('writes every step to the sealed activity log under the nation’s page', async () => {
		await publishChange(database, about('Our words.'), editor, time);
		const [change] = await reviewQueue(database);
		await markRead(database, change, lead, 'Fine.');
		await pausePublishing(database, navajo, 'A question.', lead);
		const actions = await database
			.prepare(`SELECT action FROM events WHERE target_identifier = ? ORDER BY sequence`)
			.bind(`nation-page/${navajo}`)
			.all<{ action: string }>();
		expect(actions.results.map((row) => row.action)).toEqual([
			'Published: About: Our words.',
			'Read by the project: About: Our words.',
			'Publishing paused by the project'
		]);
		await sealNewEntries(database);
		expect((await checkSeals(database)).intact).toBe(true);
	});
});
