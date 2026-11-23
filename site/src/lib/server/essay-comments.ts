/**
 * Comments on essay drafts, in D1 (src/lib/essays/comments.ts;
 * migrations/20261123T0613_add_essay_comments.sql). Each comment and each
 * thread marked done or reopened is recorded in the activity log in the
 * same batch.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import { isCommentAsk, type CommentAsk, type EssayComment } from '../essays/comments.ts';

interface CommentRow extends Omit<EssayComment, 'asks'> {
	asks: string;
}

function readAsks(text: string): CommentAsk[] {
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
			`SELECT essay_comments.identifier, thread_identifier AS threadIdentifier, person_identifier AS personIdentifier,
				author.display_name AS personName, body, asks, quote, quote_prefix AS quotePrefix, quote_suffix AS quoteSuffix,
				essay_comments.created_at AS createdAt, resolved_at AS resolvedAt, resolver.display_name AS resolvedByName
			 FROM essay_comments
			 JOIN people AS author ON author.identifier = essay_comments.person_identifier
			 LEFT JOIN people AS resolver ON resolver.identifier = essay_comments.resolved_by
			 WHERE essay_identifier = ?
			 ORDER BY essay_comments.created_at, essay_comments.identifier`
		)
		.bind(essay)
		.all<CommentRow>();
	return result.results.map((row) => ({ ...row, asks: readAsks(row.asks) }));
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
}

/** Adds a comment or a reply, and answers its identifier. */
export async function addComment(database: D1Database, input: NewComment): Promise<string> {
	const body = input.body.trim();
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
				JSON.stringify(input.thread ? [] : [...new Set(input.asks ?? [])]),
				input.thread ? null : input.quote!.quote.slice(0, 2000),
				input.thread ? null : input.quote!.prefix.slice(0, 64),
				input.thread ? null : input.quote!.suffix.slice(0, 64),
				input.versionNumber ?? null,
				now()
			),
		eventStatement(database, {
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
		eventStatement(database, {
			personIdentifier: input.personIdentifier,
			action: input.resolved ? `Marked the comment on "${short}" done` : `Reopened the comment on "${short}"`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
	return true;
}
