/**
 * Comments on essay drafts, in D1 (src/lib/essays/comments.ts;
 * migrations/20261123T0613_add_essay_comments.sql and
 * 20261123T2300_add_essay_comment_mentions.sql,
 * 20261123T2340_add_essay_comment_assignments.sql). Each comment, each
 * thread marked done or reopened, and each assignment is recorded in the
 * activity log in the same batch.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { activityStatement } from './activity-log.ts';
import { newIdentifier, now } from './identifiers.ts';
import { askSentence, commentHelpers, isCommentAsk, isCommentHelper, type CommentAsk, type CommentAssignee, type CommentHelper, type EssayComment } from '../essays/comments.ts';
import { essayPath, type EssayPart } from './essays.ts';

interface CommentRow extends Omit<EssayComment, 'asks' | 'assignee'> {
	asks: string;
	assigneePerson: string | null;
	assigneeName: string | null;
	assigneeHelper: string | null;
}

/** Who a thread is assigned to, from the newest assignment's columns. */
export function readAssignee(row: Pick<CommentRow, 'assigneePerson' | 'assigneeName' | 'assigneeHelper'>): CommentAssignee | null {
	if (row.assigneePerson) return { kind: 'person', identifier: row.assigneePerson, name: row.assigneeName ?? 'Someone' };
	if (isCommentHelper(row.assigneeHelper)) return { kind: 'helper', helper: row.assigneeHelper, name: commentHelpers[row.assigneeHelper] };
	return null;
}

/** The newest assignment of the thread whose first comment is `first`, from the essay's assignments or another table of the same shape. */
export const latestAssignment = (first: string, table = 'essay_comment_assignments') =>
	`(SELECT identifier FROM ${table} WHERE thread_identifier = ${first} ORDER BY assigned_at DESC, rowid DESC LIMIT 1)`;

/** The quick asks kept as a JSON array, without any word no longer offered. */
export function readAsks(text: string): CommentAsk[] {
	try {
		const parsed = JSON.parse(text) as unknown;
		return Array.isArray(parsed) ? parsed.filter(isCommentAsk) : [];
	} catch {
		return [];
	}
}

/** Every comment on an essay, oldest first. */
export async function essayComments(database: D1Database, essay: string): Promise<EssayComment[]> {
	const result = await database
		.prepare(
			`SELECT essay_comments.identifier, essay_comments.thread_identifier AS threadIdentifier, essay_comments.person_identifier AS personIdentifier,
				author.display_name AS personName, essay_comments.body, essay_comments.asks, essay_comments.quote, essay_comments.quote_prefix AS quotePrefix,
				essay_comments.quote_suffix AS quoteSuffix, essay_comments.created_at AS createdAt, essay_comments.resolved_at AS resolvedAt, resolver.display_name AS resolvedByName,
				assignment.person_identifier AS assigneePerson, assignee.display_name AS assigneeName, assignment.helper AS assigneeHelper
			 FROM essay_comments
			 JOIN people AS author ON author.identifier = essay_comments.person_identifier
			 LEFT JOIN people AS resolver ON resolver.identifier = essay_comments.resolved_by
			 LEFT JOIN essay_comment_assignments AS assignment ON assignment.identifier = ${latestAssignment('essay_comments.identifier')}
			 LEFT JOIN people AS assignee ON assignee.identifier = assignment.person_identifier
			 WHERE essay_comments.essay_identifier = ?
			 ORDER BY essay_comments.created_at, essay_comments.identifier`
		)
		.bind(essay)
		.all<CommentRow>();
	return result.results.map(({ assigneePerson, assigneeName, assigneeHelper, ...row }) => ({
		...row,
		asks: readAsks(row.asks),
		assignee: readAssignee({ assigneePerson, assigneeName, assigneeHelper })
	}));
}

/** Who to assign a thread to: a person, by identifier, or an AI helper; null takes the assignment away. */
export type AssignTo = { person: string } | { helper: CommentHelper } | null;

/** Reads "person:<identifier>", "helper:claude" or null, as the editor sends them. */
export function readAssignTo(value: unknown): AssignTo | undefined {
	if (value === null) return null;
	if (typeof value !== 'string') return undefined;
	const [kind, rest] = [value.slice(0, value.indexOf(':')), value.slice(value.indexOf(':') + 1)];
	if (kind === 'person' && rest) return { person: rest };
	if (kind === 'helper' && isCommentHelper(rest)) return { helper: rest };
	return undefined;
}

/**
 * Assigns a thread to a person or an AI helper, or takes the assignment
 * away. The thread's author may, and so may anyone who can edit the essay;
 * the caller checks that a person assigned can open the essay. Answers false
 * when the thread is not there or the person may not.
 */
export async function assignThread(
	database: D1Database,
	input: { essay: string; thread: string; personIdentifier: string; mayAssignAny: boolean; to: AssignTo }
): Promise<boolean> {
	const first = await database
		.prepare(
			`SELECT person_identifier AS personIdentifier, quote FROM essay_comments
			 WHERE identifier = ? AND essay_identifier = ? AND thread_identifier IS NULL`
		)
		.bind(input.thread, input.essay)
		.first<{ personIdentifier: string; quote: string }>();
	if (!first || (!input.mayAssignAny && first.personIdentifier !== input.personIdentifier)) return false;
	const person = input.to && 'person' in input.to ? input.to.person : null;
	const helper = input.to && 'helper' in input.to ? input.to.helper : null;
	const name = person
		? ((await database.prepare('SELECT display_name AS name FROM people WHERE identifier = ?').bind(person).first<{ name: string }>())?.name ?? 'someone')
		: helper
			? commentHelpers[helper]
			: null;
	const short = first.quote.length > 60 ? `${first.quote.slice(0, 57)}...` : first.quote;
	await database.batch([
		database
			.prepare(
				`INSERT INTO essay_comment_assignments (identifier, thread_identifier, person_identifier, helper, assigned_by, assigned_at)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.bind(newIdentifier(), input.thread, person, helper, input.personIdentifier, now()),
		activityStatement(database, {
			personIdentifier: input.personIdentifier,
			action: name ? `Assigned the comment on "${short}" to ${name}` : `Took back the assignment of the comment on "${short}"`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
	return true;
}

export interface NewComment {
	essay: string;
	personIdentifier: string;
	body: string;
	/** For a reply: the thread's first comment. */
	thread?: string | null;
	asks?: CommentAsk[];
	quote?: { quote: string; prefix: string; suffix: string } | null;
	versionNumber?: number | null;
	/** People chosen with "@ mention"; the caller checks that each can open the essay. */
	mentions?: string[];
}

/** Adds a comment or a reply, and answers its identifier. */
export async function addComment(database: D1Database, input: NewComment): Promise<string> {
	// A one-click ask ("Show your sources") needs no words of its own.
	const asks = input.thread ? [] : [...new Set(input.asks ?? [])];
	const body = input.body.trim() || (asks.length ? askSentence(asks) : '');
	if (!body) throw new Error('Write the comment first.');
	if (body.length > 5000) throw new Error('A comment can be at most 5,000 characters.');
	let excerpt: string;
	if (input.thread) {
		const first = await database
			.prepare('SELECT quote FROM essay_comments WHERE identifier = ? AND essay_identifier = ? AND thread_identifier IS NULL')
			.bind(input.thread, input.essay)
			.first<{ quote: string }>();
		if (!first) throw new Error('That comment thread is not on this essay.');
		excerpt = first.quote;
	} else {
		if (!input.quote?.quote.trim()) throw new Error('Select the words to comment on.');
		excerpt = input.quote.quote;
	}
	const identifier = newIdentifier();
	const short = excerpt.length > 60 ? `${excerpt.slice(0, 57)}...` : excerpt;
	await database.batch([
		database
			.prepare(
				`INSERT INTO essay_comments (identifier, essay_identifier, thread_identifier, person_identifier, body, asks,
					quote, quote_prefix, quote_suffix, version_number, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				input.essay,
				input.thread ?? null,
				input.personIdentifier,
				body,
				JSON.stringify(asks),
				input.thread ? null : input.quote!.quote.slice(0, 2000),
				input.thread ? null : input.quote!.prefix.slice(0, 64),
				input.thread ? null : input.quote!.suffix.slice(0, 64),
				input.versionNumber ?? null,
				now()
			),
		...[...new Set(input.mentions ?? [])]
			.filter((person) => person !== input.personIdentifier)
			.slice(0, 20)
			.map((person) =>
				database.prepare('INSERT INTO essay_comment_mentions (comment_identifier, person_identifier) VALUES (?, ?)').bind(identifier, person)
			),
		activityStatement(database, {
			personIdentifier: input.personIdentifier,
			action: input.thread ? `Replied to a comment on "${short}"` : `Commented on "${short}"`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
	return identifier;
}

/**
 * Marks a thread done, or reopens it. The thread's author may, and so may
 * anyone who can edit the essay (`mayResolveAny`). Answers false when the
 * thread is not there or the person may not.
 */
export async function setThreadResolved(
	database: D1Database,
	input: { essay: string; thread: string; personIdentifier: string; mayResolveAny: boolean; resolved: boolean }
): Promise<boolean> {
	const first = await database
		.prepare(
			`SELECT person_identifier AS personIdentifier, quote, resolved_at AS resolvedAt FROM essay_comments
			 WHERE identifier = ? AND essay_identifier = ? AND thread_identifier IS NULL`
		)
		.bind(input.thread, input.essay)
		.first<{ personIdentifier: string; quote: string; resolvedAt: string | null }>();
	if (!first || (!input.mayResolveAny && first.personIdentifier !== input.personIdentifier)) return false;
	if ((first.resolvedAt !== null) === input.resolved) return true;
	const short = first.quote.length > 60 ? `${first.quote.slice(0, 57)}...` : first.quote;
	await database.batch([
		database
			.prepare('UPDATE essay_comments SET resolved_at = ?, resolved_by = ? WHERE identifier = ?')
			.bind(input.resolved ? now() : null, input.resolved ? input.personIdentifier : null, input.thread),
		activityStatement(database, {
			personIdentifier: input.personIdentifier,
			action: input.resolved ? `Marked the comment on "${short}" done` : `Reopened the comment on "${short}"`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
	return true;
}

/** A thread on someone's Comments for you page. */
export interface CommentForYou {
	thread: string;
	essay: string;
	essayTitle: string;
	quote: string;
	asks: CommentAsk[];
	/** Why it is here: it was assigned to the person, someone mentioned them, or someone answered them. */
	reason: 'assigned' | 'mentioned' | 'answered';
	lastName: string;
	lastBody: string;
	lastAt: string;
	/** The essay page, opened for commenting at the thread. */
	link: string;
}

/*
 * Open threads waiting on a person: those assigned to them, those where
 * someone mentioned them, and those they wrote in where someone else wrote
 * last. Marking a thread done takes it off the page.
 */
const threadsForYou = `
	SELECT first.identifier AS thread, first.essay_identifier AS essay, first.quote, first.asks,
		EXISTS (SELECT 1 FROM essay_comment_mentions AS mention JOIN essay_comments AS entry ON entry.identifier = mention.comment_identifier
			WHERE mention.person_identifier = ?1 AND (entry.identifier = first.identifier OR entry.thread_identifier = first.identifier)) AS mentioned,
		EXISTS (SELECT 1 FROM essay_comment_assignments AS assignment
			WHERE assignment.identifier = ${latestAssignment('first.identifier')} AND assignment.person_identifier = ?1) AS assigned,
		last.person_identifier AS lastPerson, author.display_name AS lastName, last.body AS lastBody, last.created_at AS lastAt
	FROM essay_comments AS first
	JOIN essay_comments AS last ON last.identifier = (
		SELECT identifier FROM essay_comments AS entry WHERE entry.identifier = first.identifier OR entry.thread_identifier = first.identifier
		ORDER BY created_at DESC, identifier DESC LIMIT 1)
	JOIN people AS author ON author.identifier = last.person_identifier
	WHERE first.thread_identifier IS NULL AND first.resolved_at IS NULL`;

/** The open threads waiting on a person, newest activity first, for the Comments for you page. */
export async function commentsForYou(database: D1Database, person: string): Promise<CommentForYou[]> {
	const result = await database
		.prepare(
			`SELECT threads.*,
				(SELECT title FROM essay_versions WHERE essay_versions.essay_identifier = threads.essay ORDER BY number DESC LIMIT 1) AS essayTitle,
				(SELECT part FROM essays WHERE essays.identifier = threads.essay) AS essayPart
			 FROM (${threadsForYou}) AS threads
			 WHERE threads.assigned OR threads.mentioned OR EXISTS (SELECT 1 FROM essay_comments AS entry
				WHERE (entry.identifier = threads.thread OR entry.thread_identifier = threads.thread) AND entry.person_identifier = ?1)
			 ORDER BY threads.lastAt DESC`
		)
		.bind(person)
		.all<{
			thread: string;
			essay: string;
			quote: string;
			asks: string;
			mentioned: number;
			assigned: number;
			lastPerson: string;
			lastName: string;
			lastBody: string;
			lastAt: string;
			essayTitle: string | null;
			essayPart: EssayPart | null;
		}>();
	return result.results
		// Once the person has written last, the thread waits on someone else, unless it is assigned to them.
		.filter((row) => row.assigned || row.lastPerson !== person)
		.map((row) => ({
			thread: row.thread,
			essay: row.essay,
			essayTitle: row.essayTitle ?? row.essay,
			quote: row.quote,
			asks: readAsks(row.asks),
			reason: row.assigned ? 'assigned' : row.mentioned ? 'mentioned' : 'answered',
			lastName: row.lastName,
			lastBody: row.lastBody,
			lastAt: row.lastAt,
			link: `${essayPath(row.essay, row.essayPart ?? 'essays')}?comment=${encodeURIComponent(row.thread)}`
		}));
}

/** How many open threads wait on a person, for the workspace Overview. */
export async function commentsForYouCount(database: D1Database, person: string): Promise<number> {
	return (await commentsForYou(database, person)).length;
}
