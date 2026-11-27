import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { bestMatch, quoteIn } from '../src/lib/essays/comment-anchors.ts';
import { commentThreads } from '../src/lib/essays/comments.ts';
import { pageAddress, pagePath } from '../src/lib/page-comment-paths.ts';
import {
	addPageComment,
	assignPageThread,
	everyCommentForYou,
	pageCommentLevel,
	pageComments,
	pageCommentsForYou,
	pageNation,
	pagePeople,
	setPageThreadResolved
} from '#lib/server/page-comments.ts';
import { testDatabase } from './database.ts';

describe('which pages take comments', () => {
	it('names a page by its path, and leaves out the workspace, accounts and essays', () => {
		expect(pagePath('/laws/indian-removal-act-1830/')).toBe('laws/indian-removal-act-1830');
		expect(pagePath('/nations/cherokee-nation?comment=x#government')).toBe('nations/cherokee-nation');
		expect(pagePath('/workspace/comments')).toBeNull();
		expect(pagePath('/essays/i-legal-history-timeline')).toBeNull();
		expect(pagePath('/laws/../workspace')).toBeNull();
		expect(pagePath('/Laws/Bad Name')).toBeNull();
		expect(pageNation('nations/cherokee-nation')).toBe('cherokee-nation');
	});

	it('takes comments on every other page, the home page, lists, search and source documents included', () => {
		expect(pagePath('/')).toBe('home');
		expect(pageAddress('home')).toBe('/');
		expect(pageAddress('laws/x')).toBe('/laws/x');
		expect(pagePath('/search?q=removal')).toBe('search');
		expect(pagePath('/essays')).toBe('essays');
		expect(pagePath('/foundations/i-x/history')).toBe('foundations/i-x/history');
		expect(pagePath('/copies/view/govinfo/STATUTE-100/STATUTE-100-Pg849.pdf')).toBe('copies/view/govinfo/STATUTE-100/STATUTE-100-Pg849.pdf');
		expect(pagePath('/verify?sha256=abc')).toBe('verify');
		expect(pagePath('/offline')).toBe('offline');
		expect(pagePath('/nations/map')).toBe('nations/map');
		expect(pagePath('/stats/cases')).toBe('stats/cases');
	});

	it('leaves out private pages, addresses with a secret and video calls', () => {
		expect(pagePath('/uploads')).toBeNull();
		expect(pagePath('/orders/O-1')).toBeNull();
		expect(pagePath('/mail/unsubscribe/secret')).toBeNull();
		expect(pagePath('/sponsorship/invite/secret')).toBeNull();
		expect(pagePath('/rooms/r')).toBeNull();
		expect(pagePath('/events/council/room')).toBeNull();
		expect(pagePath('/events/council')).toBe('events/council');
		expect(pageNation('laws/x')).toBeNull();
	});
});

describe('finding the words on a page', () => {
	const text = 'Kind Federal statute  Enacted May 28, 1830  Citation Act of May 28, 1830, ch. 148';
	it('keeps the words with the text around them, and finds the right one of two', () => {
		const second = text.indexOf('May 28, 1830');
		const selector = quoteIn(text, second, second + 'May 28, 1830'.length)!;
		expect(selector).toMatchObject({ quote: 'May 28, 1830', prefix: 'Kind Federal statute  Enacted ' });
		expect(bestMatch(text, selector)).toBe(second);
		expect(bestMatch(`New line. ${text}`, selector)).toBe(second + 'New line. '.length);
		expect(bestMatch(text.replace('Enacted May 28, 1830', 'Enacted May 26, 1830').replace('Act of May 28, 1830', 'Act of 1830'), selector)).toBe(-1);
	});

	it('trims spaces from the selected words', () => {
		expect(quoteIn('one  two three', 3, 9)?.quote).toBe('two');
		expect(quoteIn('one   two', 3, 6)).toBeNull();
	});
});

describe('comments on pages in the database', () => {
	let database: D1Database;
	const law = 'laws/indian-removal-act-1830';
	const nation = 'nations/cherokee-nation';
	const words = { quote: 'May 28, 1830', prefix: 'Enacted ', suffix: '' };

	beforeEach(async () => {
		database = testDatabase();
		const person = (identifier: string, role: string, nationIdentifier: string | null = null) =>
			database
				.prepare(`INSERT INTO people (identifier, email, display_name, role, nation_identifier, status, added_at) VALUES (?, ?, ?, ?, ?, 'active', '2026-11-22T00:00:00Z')`)
				.bind(identifier, `${identifier}@example.org`, identifier[0].toUpperCase() + identifier.slice(1), role, nationIdentifier);
		await database.batch([
			person('lead', 'lead-author'),
			person('advisor', 'advisor'),
			person('editor', 'editor'),
			person('contributor', 'contributor'),
			person('cherokee', 'nation-reviewer', 'cherokee-nation'),
			person('navajo', 'nation-reviewer', 'navajo-nation')
		]);
	});

	it('lets people with comment access or above comment: the writing team everywhere, a nation’s own people on its page', async () => {
		const level = (identifier: string, role: string, path: string, nationIdentifier: string | null = null) =>
			pageCommentLevel(database, { identifier, role: role as never, nationIdentifier }, path);
		expect(await level('lead', 'lead-author', law)).toBe('full');
		expect(await level('editor', 'editor', law)).toBe('contribute');
		expect(await level('advisor', 'advisor', law)).toBe('comment');
		expect(await level('contributor', 'contributor', law)).toBe('no-access');
		expect(await level('cherokee', 'nation-reviewer', law, 'cherokee-nation')).toBe('no-access');
		expect(await level('cherokee', 'nation-reviewer', nation, 'cherokee-nation')).toBe('comment');
		expect(await level('navajo', 'nation-reviewer', nation, 'navajo-nation')).toBe('no-access');
		expect((await pagePeople(database, nation)).map((each) => each.identifier).sort()).toEqual(['advisor', 'cherokee', 'editor', 'lead']);
		expect((await pagePeople(database, law)).map((each) => each.identifier).sort()).toEqual(['advisor', 'editor', 'lead']);
	});

	it('keeps threads with their replies and the page’s title, logs each, and never changes or deletes a comment', async () => {
		const first = await addPageComment(database, { path: law, title: 'Indian Removal Act', personIdentifier: 'advisor', body: 'Signed or passed?', asks: ['check'], quote: words });
		await addPageComment(database, { path: law, personIdentifier: 'lead', body: 'Signed.', thread: first });
		const [thread] = commentThreads(await pageComments(database, law));
		expect(thread.first).toMatchObject({ body: 'Signed or passed?', asks: ['check'], quote: 'May 28, 1830', personName: 'Advisor' });
		expect(thread.replies.map((reply) => reply.body)).toEqual(['Signed.']);
		expect(await pageComments(database, nation)).toEqual([]);
		const logged = await database.prepare(`SELECT action FROM events WHERE target_identifier = ? ORDER BY sequence`).bind(`page:${law}`).all<{ action: string }>();
		expect(logged.results.map((entry) => entry.action)).toEqual(['Commented on "May 28, 1830"', 'Replied to a comment on "May 28, 1830"']);
		await expect(database.prepare(`UPDATE page_comments SET body = 'changed'`).run()).rejects.toThrow(/cannot be changed/);
		await expect(database.prepare('DELETE FROM page_comments').run()).rejects.toThrow(/cannot be deleted/);
		await expect(addPageComment(database, { path: nation, personIdentifier: 'lead', body: 'Hi', thread: first })).rejects.toThrow(/not on this page/);
	});

	it('lets the thread’s author or an editor mark it done or assign it, and lists it for the people it waits on', async () => {
		const first = await addPageComment(database, { path: nation, title: 'Cherokee Nation', personIdentifier: 'cherokee', body: '@Lead is this right?', quote: words, mentions: ['lead'] });
		expect((await pageCommentsForYou(database, { identifier: 'lead', role: 'lead-author', nationIdentifier: null }))[0]).toMatchObject({
			reason: 'mentioned',
			essayTitle: 'Cherokee Nation',
			link: `/${nation}?comment=${first}`
		});
		expect(await assignPageThread(database, { path: nation, thread: first, personIdentifier: 'advisor', mayAssignAny: false, to: { person: 'editor' } })).toBe(false);
		expect(await assignPageThread(database, { path: nation, thread: first, personIdentifier: 'cherokee', mayAssignAny: false, to: { person: 'editor' } })).toBe(true);
		expect((await pageComments(database, nation))[0].assignee).toEqual({ kind: 'person', identifier: 'editor', name: 'Editor' });
		expect(await everyCommentForYou(database, { identifier: 'editor', role: 'editor', nationIdentifier: null })).toHaveLength(1);
		// Someone who cannot see the page's comments is not shown them, even if named.
		expect(await pageCommentsForYou(database, { identifier: 'navajo', role: 'nation-reviewer', nationIdentifier: 'navajo-nation' })).toEqual([]);

		expect(await setPageThreadResolved(database, { path: nation, thread: first, personIdentifier: 'advisor', mayResolveAny: false, resolved: true })).toBe(false);
		expect(await setPageThreadResolved(database, { path: nation, thread: first, personIdentifier: 'editor', mayResolveAny: true, resolved: true })).toBe(true);
		expect((await pageComments(database, nation))[0].resolvedByName).toBe('Editor');
		expect(await everyCommentForYou(database, { identifier: 'editor', role: 'editor', nationIdentifier: null })).toEqual([]);
	});
});
