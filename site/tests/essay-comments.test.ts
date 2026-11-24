import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseEssay } from '../src/lib/essays/document.ts';
import { findQuote, quoteAt } from '../src/lib/essays/comment-anchors.ts';
import { askSentence, commentThreads } from '../src/lib/essays/comments.ts';
import { addComment, assignThread, commentsForYou, commentsForYouCount, essayComments, readAssignTo, setThreadResolved } from '#lib/server/essay-comments.ts';
import { testDatabase } from './database.ts';

const body = 'In 1832 the Court treats the Cherokee Nation as a distinct political community.\n\nLater the Court treats the Cherokee Nation differently.\n';

function rangeOf(doc: ReturnType<typeof parseEssay>, words: string, nth = 0): { from: number; to: number } {
	let found = -1;
	let seen = 0;
	let result = { from: 0, to: 0 };
	doc.descendants((node, position) => {
		if (!node.isText || !node.text) return;
		for (let index = node.text.indexOf(words); index !== -1; index = node.text.indexOf(words, index + 1)) {
			if (seen === nth && found === -1) {
				found = index;
				result = { from: position + index, to: position + index + words.length };
			}
			seen += 1;
		}
	});
	return result;
}

describe('finding the words a comment is about', () => {
	it('keeps the words with the text around them, across paragraphs', () => {
		const doc = parseEssay(body);
		const { from, to } = rangeOf(doc, 'distinct political community');
		expect(quoteAt(doc, from, to)).toEqual({
			quote: 'distinct political community',
			prefix: 'treats the Cherokee Nation as a ',
			suffix: '.\nLater the Court treats the Che'
		});
	});

	it('finds the right one of two places with the same words, after edits elsewhere', () => {
		const doc = parseEssay(body);
		const second = rangeOf(doc, 'the Court treats the Cherokee Nation', 1);
		const selector = quoteAt(doc, second.from, second.to)!;
		const edited = parseEssay(`A new opening paragraph.\n\n${body.replace('In 1832', 'In the year 1832')}`);
		const found = findQuote(edited, selector)!;
		expect(edited.textBetween(found.from, found.to)).toBe('the Court treats the Cherokee Nation');
		expect(found).toEqual(rangeOf(edited, 'the Court treats the Cherokee Nation', 1));
	});

	it('answers null when the words were changed', () => {
		const doc = parseEssay(body);
		const selector = quoteAt(doc, ...Object.values(rangeOf(doc, 'distinct political community')) as [number, number])!;
		expect(findQuote(parseEssay(body.replace('distinct political community', 'separate people')), selector)).toBeNull();
	});
});

describe('comments in the database', () => {
	let database: D1Database;
	beforeEach(async () => {
		database = testDatabase();
		await database.batch([
			database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`),
			database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('reader', 'r@example.org', 'Reader', 'co-author', 'active', '2026-11-22T00:00:00Z')`),
			database.prepare(`INSERT INTO essays (identifier, part, created_at) VALUES ('i-timeline', 'foundations', '2026-11-22T00:00:00Z')`)
		]);
	});

	it('keeps threads with their replies and asks, and logs each', async () => {
		const first = await addComment(database, {
			essay: 'i-timeline',
			personIdentifier: 'reader',
			body: 'Which page says this?',
			asks: ['sources', 'sources', 'unclear'],
			quote: { quote: 'distinct political community', prefix: 'as a ', suffix: '.' },
			versionNumber: 3
		});
		await addComment(database, { essay: 'i-timeline', personIdentifier: 'lead', body: 'Page 561.', thread: first });
		const [thread] = commentThreads(await essayComments(database, 'i-timeline'));
		expect(thread.first).toMatchObject({ body: 'Which page says this?', asks: ['sources', 'unclear'], quote: 'distinct political community', personName: 'Reader' });
		expect(thread.replies.map((reply) => reply.body)).toEqual(['Page 561.']);
		const logged = await database.prepare(`SELECT action FROM events WHERE target_identifier = 'essay:i-timeline' ORDER BY sequence`).all<{ action: string }>();
		expect(logged.results.map((entry) => entry.action)).toEqual(['Commented on "distinct political community"', 'Replied to a comment on "distinct political community"']);
	});

	it('lets the thread’s author or an editor mark it done, and never deletes or changes a comment', async () => {
		const first = await addComment(database, { essay: 'i-timeline', personIdentifier: 'lead', body: 'Shorten.', quote: { quote: 'words', prefix: '', suffix: '' } });
		expect(await setThreadResolved(database, { essay: 'i-timeline', thread: first, personIdentifier: 'reader', mayResolveAny: false, resolved: true })).toBe(false);
		expect(await setThreadResolved(database, { essay: 'i-timeline', thread: first, personIdentifier: 'reader', mayResolveAny: true, resolved: true })).toBe(true);
		const [comment] = await essayComments(database, 'i-timeline');
		expect(comment.resolvedByName).toBe('Reader');
		await expect(database.prepare(`UPDATE essay_comments SET body = 'changed'`).run()).rejects.toThrow(/cannot be changed/);
		await expect(database.prepare('DELETE FROM essay_comments').run()).rejects.toThrow(/cannot be deleted/);
	});

	it('refuses a reply to a thread on another essay, and an empty comment', async () => {
		await expect(addComment(database, { essay: 'i-timeline', personIdentifier: 'lead', body: 'Hi', thread: 'nope' })).rejects.toThrow(/not on this essay/);
		await expect(addComment(database, { essay: 'i-timeline', personIdentifier: 'lead', body: '  ', quote: { quote: 'x', prefix: '', suffix: '' } })).rejects.toThrow(/Write/);
	});

	it('saves a one-click ask with the ask as its words', async () => {
		await addComment(database, { essay: 'i-timeline', personIdentifier: 'reader', body: '', asks: ['sources'], quote: { quote: 'words', prefix: '', suffix: '' } });
		const [comment] = await essayComments(database, 'i-timeline');
		expect(comment.body).toBe('Show your sources.');
		expect(comment.body).toBe(askSentence(comment.asks));
	});

	it('lists comments that mention someone or answer them, until they reply or it is done', async () => {
		const first = await addComment(database, {
			essay: 'i-timeline',
			personIdentifier: 'reader',
			body: '@Lead which page?',
			quote: { quote: 'distinct political community', prefix: '', suffix: '' },
			mentions: ['lead', 'reader']
		});
		let lead = await commentsForYou(database, 'lead');
		expect(lead).toHaveLength(1);
		expect(lead[0]).toMatchObject({ reason: 'mentioned', lastName: 'Reader', essayTitle: 'i-timeline', link: '/foundations/timeline?comment=' + first });
		// Mentioning yourself does nothing, and your own comment does not wait on you.
		expect(await commentsForYouCount(database, 'reader')).toBe(0);

		await addComment(database, { essay: 'i-timeline', personIdentifier: 'lead', body: 'Page 561.', thread: first });
		expect(await commentsForYouCount(database, 'lead')).toBe(0);
		expect((await commentsForYou(database, 'reader'))[0]).toMatchObject({ reason: 'answered', lastBody: 'Page 561.' });

		await setThreadResolved(database, { essay: 'i-timeline', thread: first, personIdentifier: 'reader', mayResolveAny: false, resolved: true });
		expect(await commentsForYouCount(database, 'reader')).toBe(0);
		await expect(database.prepare('DELETE FROM essay_comment_mentions').run()).rejects.toThrow(/cannot be deleted/);
	});

	it('assigns a thread to a person or an AI helper, keeps each assignment, and lists it for the person assigned', async () => {
		const first = await addComment(database, { essay: 'i-timeline', personIdentifier: 'reader', body: 'Lead with the civil cases.', quote: { quote: 'words', prefix: '', suffix: '' } });
		expect(await assignThread(database, { essay: 'i-timeline', thread: first, personIdentifier: 'lead', mayAssignAny: false, to: { helper: 'claude' } })).toBe(false);
		expect(await assignThread(database, { essay: 'i-timeline', thread: first, personIdentifier: 'reader', mayAssignAny: false, to: { helper: 'nemesis' } })).toBe(true);
		expect((await essayComments(database, 'i-timeline'))[0].assignee).toEqual({ kind: 'helper', helper: 'nemesis', name: 'Nemesis' });

		await assignThread(database, { essay: 'i-timeline', thread: first, personIdentifier: 'reader', mayAssignAny: false, to: { person: 'lead' } });
		expect((await essayComments(database, 'i-timeline'))[0].assignee).toEqual({ kind: 'person', identifier: 'lead', name: 'Lead' });
		expect((await commentsForYou(database, 'lead'))[0]).toMatchObject({ reason: 'assigned' });
		// Still waiting on the person assigned after they reply, until it is done or assigned away.
		await addComment(database, { essay: 'i-timeline', personIdentifier: 'lead', body: 'Will do.', thread: first });
		expect(await commentsForYouCount(database, 'lead')).toBe(1);

		await assignThread(database, { essay: 'i-timeline', thread: first, personIdentifier: 'lead', mayAssignAny: true, to: null });
		expect((await essayComments(database, 'i-timeline'))[0].assignee).toBeNull();
		expect(await commentsForYouCount(database, 'lead')).toBe(0);
		const logged = await database.prepare(`SELECT action FROM events WHERE action LIKE '%assign%' ORDER BY sequence`).all<{ action: string }>();
		expect(logged.results.map((entry) => entry.action)).toEqual([
			'Assigned the comment on "words" to Nemesis',
			'Assigned the comment on "words" to Lead',
			'Took back the assignment of the comment on "words"'
		]);
		await expect(database.prepare('DELETE FROM essay_comment_assignments').run()).rejects.toThrow(/cannot be deleted/);
	});

	it('reads who to assign to as the editor sends it', () => {
		expect(readAssignTo('person:abc')).toEqual({ person: 'abc' });
		expect(readAssignTo('helper:claude')).toEqual({ helper: 'claude' });
		expect(readAssignTo(null)).toBeNull();
		expect(readAssignTo('helper:someone')).toBeUndefined();
		expect(readAssignTo('person:')).toBeUndefined();
		expect(readAssignTo(3)).toBeUndefined();
	});
});
