/**
 * Comments on the site's other pages, such as laws, cases and nations, in D1
 * (docs/editing.md, "Comments on other pages";
 * migrations/20261126T1822_add_page_comments.sql). They work like comments
 * on essay drafts (essay-comments.ts) and share their quick asks, @ mention,
 * Assign and Done. A page is named by its path without the leading slash.
 *
 * Who may comment (Trevor, Nov. 26, 2026: "Comment access or above"): on a
 * nation's page, anyone with comment access or above on that nation, which
 * counts the nation's team (src/lib/permissions.ts, documentAccess); on any
 * other page, the person's role default, so advisors and co-authors comment
 * and editors and the lead author may also mark any thread done. Everyone
 * else keeps the flag to report a problem. Each comment, each thread marked
 * done or reopened, and each assignment is recorded in the activity log in
 * the same batch.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { activityStatement } from './activity-log.ts';
import { grantsOf } from './access.ts';
import { placeAsGrant, type TeamLevel } from '../nation-teams.ts';
import { newIdentifier, now } from './identifiers.ts';
import { commentsForYou, latestAssignment, readAsks, readAssignee, type AssignTo, type CommentForYou } from './essay-comments.ts';
import { pageAddress, pagePath } from '../page-comment-paths.ts';
import { askSentence, commentHelpers, type CommentAsk, type EssayComment } from '../essays/comments.ts';
import {
	atLeast,
	documentAccess,
	everyDocument,
	isAdministrator,
	roleDefaultLevels,
	type AccessGrant,
	type AccessLevel,
	type AccessSubject,
	type Grantee,
	type Role
} from '../permissions.ts';

export { pagePath };

/** The nation whose page this is, for a path such as "nations/cherokee-nation". */
export function pageNation(path: string): string | null {
	const [first, nation] = path.split('/');
	return first === 'nations' && nation ? nation : null;
}

function levelFrom(person: Grantee, path: string, grants: readonly AccessGrant[]): AccessLevel {
	const nation = pageNation(path);
	if (nation) return documentAccess(person, { kind: 'nation', identifier: nation } as AccessSubject, grants).level;
	if (isAdministrator(person)) return 'full';
	return roleDefaultLevels[person.role];
}

/** A person's level for the comments on one page. */
export async function pageCommentLevel(database: D1Database, person: Grantee & { identifier: string }, path: string): Promise<AccessLevel> {
	return levelFrom(person, path, pageNation(path) ? await grantsOf(database, person.identifier) : []);
}

/** Everyone who can see the page's comments, for @ mention and Assign. */
export async function pagePeople(database: D1Database, path: string): Promise<{ identifier: string; name: string }[]> {
	const nation = pageNation(path);
	const [people, grants, places] = await Promise.all([
		database
			.prepare(
				`SELECT identifier, display_name AS name, role, nation_identifier AS nationIdentifier FROM people
				 WHERE status != 'removed' ORDER BY role != 'lead-author', display_name COLLATE NOCASE`
			)
			.all<{ identifier: string; name: string; role: Role; nationIdentifier: string | null }>(),
		nation
			? database
					.prepare(
						`SELECT person_identifier AS personIdentifier, subject_kind AS subjectKind, subject_identifier AS subjectIdentifier,
							level, expires_at AS expiresAt
						 FROM access_grants WHERE ended_at IS NULL AND subject_kind = 'nation' AND subject_identifier IN (?, ?)`
					)
					.bind(nation, everyDocument)
					.all<AccessGrant & { personIdentifier: string }>()
			: Promise.resolve({ results: [] as (AccessGrant & { personIdentifier: string })[] }),
		nation
			? database
					.prepare(
						`SELECT person_identifier AS personIdentifier, level, expires_at AS expiresAt
						 FROM nation_team_members WHERE nation_identifier = ? AND ended_at IS NULL`
					)
					.bind(nation)
					.all<{ personIdentifier: string; level: TeamLevel; expiresAt: string }>()
			: Promise.resolve({ results: [] as { personIdentifier: string; level: TeamLevel; expiresAt: string }[] })
	]);
	const byPerson = new Map<string, AccessGrant[]>();
	const add = (person: string, grant: AccessGrant) => byPerson.set(person, [...(byPerson.get(person) ?? []), grant]);
	for (const { personIdentifier, ...grant } of grants.results) add(personIdentifier, grant);
	if (nation) {
		for (const place of places.results) add(place.personIdentifier, placeAsGrant(nation, place.level, place.expiresAt));
	}
	return people.results
		.filter((person) => atLeast(levelFrom(person, path, byPerson.get(person.identifier) ?? []), 'comment'))
		.map(({ identifier, name }) => ({ identifier, name }));
}

/** Every comment on a page, oldest first, in the shape the comment cards show. */
export async function pageComments(database: D1Database, path: string): Promise<EssayComment[]> {
	const result = await database
		.prepare(
			`SELECT page_comments.identifier, page_comments.thread_identifier AS threadIdentifier, page_comments.person_identifier AS personIdentifier,
				author.display_name AS personName, page_comments.body, page_comments.asks, page_comments.quote, page_comments.quote_prefix AS quotePrefix,
				page_comments.quote_suffix AS quoteSuffix, page_comments.created_at AS createdAt, page_comments.resolved_at AS resolvedAt, resolver.display_name AS resolvedByName,
				assignment.person_identifier AS assigneePerson, assignee.display_name AS assigneeName, assignment.helper AS assigneeHelper
			 FROM page_comments
			 JOIN people AS author ON author.identifier = page_comments.person_identifier
			 LEFT JOIN people AS resolver ON resolver.identifier = page_comments.resolved_by
			 LEFT JOIN page_comment_assignments AS assignment ON assignment.identifier = ${latestAssignment('page_comments.identifier', 'page_comment_assignments')}
			 LEFT JOIN people AS assignee ON assignee.identifier = assignment.person_identifier
			 WHERE page_comments.page_path = ?
			 ORDER BY page_comments.created_at, page_comments.identifier`
		)
		.bind(path)
		.all<Omit<EssayComment, 'asks' | 'assignee'> & { asks: string; assigneePerson: string | null; assigneeName: string | null; assigneeHelper: string | null }>();
	return result.results.map(({ assigneePerson, assigneeName, assigneeHelper, ...row }) => ({
		...row,
		asks: readAsks(row.asks),
		assignee: readAssignee({ assigneePerson, assigneeName, assigneeHelper })
	}));
}

const short = (words: string) => (words.length > 60 ? `${words.slice(0, 57)}...` : words);
const target = (path: string) => ({ targetKind: 'document' as const, targetIdentifier: `page:${path}` });

/** The first comment of a thread on a page, or null. */
async function threadStart(database: D1Database, path: string, thread: string) {
	return database
		.prepare(
			`SELECT person_identifier AS personIdentifier, quote, resolved_at AS resolvedAt FROM page_comments
			 WHERE identifier = ? AND page_path = ? AND thread_identifier IS NULL`
		)
		.bind(thread, path)
		.first<{ personIdentifier: string; quote: string; resolvedAt: string | null }>();
}

export interface NewPageComment {
	path: string;
	/** The page's title, kept on a thread's first comment for the Comments for you page. */
	title?: string | null;
	personIdentifier: string;
	body: string;
	/** For a reply: the thread's first comment. */
	thread?: string | null;
	asks?: CommentAsk[];
	quote?: { quote: string; prefix: string; suffix: string } | null;
	/** People chosen with "@ mention"; the caller checks that each can see the page's comments. */
	mentions?: string[];
}

/** Adds a comment or a reply to a page, and answers its identifier. */
export async function addPageComment(database: D1Database, input: NewPageComment): Promise<string> {
	const asks = input.thread ? [] : [...new Set(input.asks ?? [])];
	const body = input.body.trim() || (asks.length ? askSentence(asks) : '');
	if (!body) throw new Error('Write the comment first.');
	if (body.length > 5000) throw new Error('A comment can be at most 5,000 characters.');
	let excerpt: string;
	if (input.thread) {
		const first = await threadStart(database, input.path, input.thread);
		if (!first) throw new Error('That comment thread is not on this page.');
		excerpt = first.quote;
	} else {
		if (!input.quote?.quote.trim()) throw new Error('Select the words to comment on.');
		excerpt = input.quote.quote;
	}
	const identifier = newIdentifier();
	await database.batch([
		database
			.prepare(
				`INSERT INTO page_comments (identifier, page_path, page_title, thread_identifier, person_identifier, body, asks,
					quote, quote_prefix, quote_suffix, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				input.path,
				input.thread ? null : (input.title?.trim().slice(0, 200) ?? null) || null,
				input.thread ?? null,
				input.personIdentifier,
				body,
				JSON.stringify(asks),
				input.thread ? null : input.quote!.quote.slice(0, 2000),
				input.thread ? null : input.quote!.prefix.slice(0, 64),
				input.thread ? null : input.quote!.suffix.slice(0, 64),
				now()
			),
		...[...new Set(input.mentions ?? [])]
			.filter((person) => person !== input.personIdentifier)
			.slice(0, 20)
			.map((person) => database.prepare('INSERT INTO page_comment_mentions (comment_identifier, person_identifier) VALUES (?, ?)').bind(identifier, person)),
		activityStatement(database, {
			personIdentifier: input.personIdentifier,
			action: input.thread ? `Replied to a comment on "${short(excerpt)}"` : `Commented on "${short(excerpt)}"`,
			...target(input.path)
		})
	]);
	return identifier;
}

/**
 * Marks a thread done, or reopens it. The thread's author may, and so may
 * anyone who can edit (`mayResolveAny`). Answers false when the thread is not
 * on the page or the person may not.
 */
export async function setPageThreadResolved(
	database: D1Database,
	input: { path: string; thread: string; personIdentifier: string; mayResolveAny: boolean; resolved: boolean }
): Promise<boolean> {
	const first = await threadStart(database, input.path, input.thread);
	if (!first || (!input.mayResolveAny && first.personIdentifier !== input.personIdentifier)) return false;
	if ((first.resolvedAt !== null) === input.resolved) return true;
	await database.batch([
		database
			.prepare('UPDATE page_comments SET resolved_at = ?, resolved_by = ? WHERE identifier = ?')
			.bind(input.resolved ? now() : null, input.resolved ? input.personIdentifier : null, input.thread),
		activityStatement(database, {
			personIdentifier: input.personIdentifier,
			action: input.resolved ? `Marked the comment on "${short(first.quote)}" done` : `Reopened the comment on "${short(first.quote)}"`,
			...target(input.path)
		})
	]);
	return true;
}

/**
 * Assigns a thread to a person or an AI helper, or takes the assignment
 * away. The thread's author may, and so may anyone who can edit; the caller
 * checks that a person assigned can see the page's comments.
 */
export async function assignPageThread(
	database: D1Database,
	input: { path: string; thread: string; personIdentifier: string; mayAssignAny: boolean; to: AssignTo }
): Promise<boolean> {
	const first = await threadStart(database, input.path, input.thread);
	if (!first || (!input.mayAssignAny && first.personIdentifier !== input.personIdentifier)) return false;
	const person = input.to && 'person' in input.to ? input.to.person : null;
	const helper = input.to && 'helper' in input.to ? input.to.helper : null;
	const name = person
		? ((await database.prepare('SELECT display_name AS name FROM people WHERE identifier = ?').bind(person).first<{ name: string }>())?.name ?? 'someone')
		: helper
			? commentHelpers[helper]
			: null;
	await database.batch([
		database
			.prepare(
				`INSERT INTO page_comment_assignments (identifier, thread_identifier, person_identifier, helper, assigned_by, assigned_at)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.bind(newIdentifier(), input.thread, person, helper, input.personIdentifier, now()),
		activityStatement(database, {
			personIdentifier: input.personIdentifier,
			action: name ? `Assigned the comment on "${short(first.quote)}" to ${name}` : `Took back the assignment of the comment on "${short(first.quote)}"`,
			...target(input.path)
		})
	]);
	return true;
}

/**
 * The open threads on pages that wait on a person, for the Comments for you
 * page: assigned to them, mentioning them, or answered after they wrote.
 * Threads on a page they can no longer see are left out.
 */
export async function pageCommentsForYou(database: D1Database, person: Grantee & { identifier: string }): Promise<CommentForYou[]> {
	const result = await database
		.prepare(
			`SELECT threads.* FROM (
				SELECT first.identifier AS thread, first.page_path AS path, first.page_title AS title, first.quote, first.asks,
					EXISTS (SELECT 1 FROM page_comment_mentions AS mention JOIN page_comments AS entry ON entry.identifier = mention.comment_identifier
						WHERE mention.person_identifier = ?1 AND (entry.identifier = first.identifier OR entry.thread_identifier = first.identifier)) AS mentioned,
					EXISTS (SELECT 1 FROM page_comment_assignments AS assignment
						WHERE assignment.identifier = ${latestAssignment('first.identifier', 'page_comment_assignments')} AND assignment.person_identifier = ?1) AS assigned,
					last.person_identifier AS lastPerson, author.display_name AS lastName, last.body AS lastBody, last.created_at AS lastAt
				FROM page_comments AS first
				JOIN page_comments AS last ON last.identifier = (
					SELECT identifier FROM page_comments AS entry WHERE entry.identifier = first.identifier OR entry.thread_identifier = first.identifier
					ORDER BY created_at DESC, identifier DESC LIMIT 1)
				JOIN people AS author ON author.identifier = last.person_identifier
				WHERE first.thread_identifier IS NULL AND first.resolved_at IS NULL) AS threads
			 WHERE threads.assigned OR threads.mentioned OR EXISTS (SELECT 1 FROM page_comments AS entry
				WHERE (entry.identifier = threads.thread OR entry.thread_identifier = threads.thread) AND entry.person_identifier = ?1)
			 ORDER BY threads.lastAt DESC`
		)
		.bind(person.identifier)
		.all<{
			thread: string;
			path: string;
			title: string | null;
			quote: string;
			asks: string;
			mentioned: number;
			assigned: number;
			lastPerson: string;
			lastName: string;
			lastBody: string;
			lastAt: string;
		}>();
	const rows = result.results.filter((row) => row.assigned || row.lastPerson !== person.identifier);
	if (rows.length === 0) return [];
	const grants = await grantsOf(database, person.identifier);
	return rows
		.filter((row) => atLeast(levelFrom(person, row.path, grants), 'comment'))
		.map((row) => ({
			thread: row.thread,
			essay: row.path,
			essayTitle: row.title ?? row.path,
			quote: row.quote,
			asks: readAsks(row.asks),
			reason: row.assigned ? 'assigned' : row.mentioned ? 'mentioned' : 'answered',
			lastName: row.lastName,
			lastBody: row.lastBody,
			lastAt: row.lastAt,
			link: `${pageAddress(row.path)}?comment=${encodeURIComponent(row.thread)}`
		}));
}

/** Every open thread waiting on a person, on essays and on other pages, newest activity first. */
export async function everyCommentForYou(database: D1Database, person: Grantee & { identifier: string }): Promise<CommentForYou[]> {
	const [onEssays, onPages] = await Promise.all([commentsForYou(database, person.identifier), pageCommentsForYou(database, person)]);
	return [...onEssays, ...onPages].sort((first, second) => second.lastAt.localeCompare(first.lastAt));
}

/** How many open threads wait on a person, for the workspace Overview and the sidebar. */
export async function everyCommentForYouCount(database: D1Database, person: Grantee & { identifier: string }): Promise<number> {
	return (await everyCommentForYou(database, person)).length;
}
