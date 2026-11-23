/**
 * Comments on essay drafts (docs/editing.md, "Comments";
 * migrations/20261123T0613_add_essay_comments.sql). Someone selects words
 * in the draft and comments on them, with optional quick asks such as
 * "Show your sources" (Trevor approved the commenting mockup, Nov. 22,
 * 2026); others reply, and the thread is marked done when it is dealt with.
 * Used by the editor and the server alike.
 */
import type { TextQuote } from './comment-anchors.ts';

/** The quick asks a comment can carry, each a tag the authors can sort and clear by. */
export const commentAsks = ['expand', 'rewrite', 'sources', 'citation', 'shorten', 'check', 'unclear', 'case-box'] as const;
export type CommentAsk = (typeof commentAsks)[number];

export const commentAskLabels: Record<CommentAsk, string> = {
	expand: 'Expand on this',
	rewrite: 'Rewrite',
	sources: 'Show your sources',
	citation: 'Add a citation',
	shorten: 'Shorten',
	check: 'Check this fact',
	unclear: 'Unclear to me',
	'case-box': 'Make this a case box'
};

/**
 * The words a one-click ask is saved with when the person wrote none, such
 * as "Show your sources."; the comment card shows only the ask's tag then.
 */
export function askSentence(asks: readonly CommentAsk[]): string {
	return `${asks.map((ask) => commentAskLabels[ask]).join('. ')}.`;
}

export function isCommentAsk(value: unknown): value is CommentAsk {
	return typeof value === 'string' && (commentAsks as readonly string[]).includes(value);
}

/** One comment as the editor shows it. */
export interface EssayComment {
	identifier: string;
	/** The thread's first comment, or null for that first comment. */
	threadIdentifier: string | null;
	personIdentifier: string;
	personName: string;
	body: string;
	asks: CommentAsk[];
	quote: string | null;
	quotePrefix: string | null;
	quoteSuffix: string | null;
	createdAt: string;
	resolvedAt: string | null;
	resolvedByName: string | null;
}

/** A comment being written: the words it is on, and what the selection menu chose. */
export interface CommentDraft {
	quote: TextQuote;
	asks: CommentAsk[];
	/** Prefilled words, such as the selected text to rewrite for Suggest. */
	body: string;
	suggest?: boolean;
}

/** A thread: its first comment and the replies, oldest first. */
export interface CommentThread {
	first: EssayComment;
	replies: EssayComment[];
}

/** Groups comments into threads, in the order they were started. */
export function commentThreads(comments: EssayComment[]): CommentThread[] {
	const threads = new Map<string, CommentThread>();
	for (const comment of comments) {
		if (comment.threadIdentifier === null) threads.set(comment.identifier, { first: comment, replies: [] });
	}
	for (const comment of comments) {
		if (comment.threadIdentifier !== null) threads.get(comment.threadIdentifier)?.replies.push(comment);
	}
	for (const thread of threads.values()) thread.replies.sort((first, second) => first.createdAt.localeCompare(second.createdAt));
	return [...threads.values()].sort((first, second) => first.first.createdAt.localeCompare(second.first.createdAt));
}
