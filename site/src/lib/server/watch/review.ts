/**
 * The workspace's Source watch page (/workspace/watch; docs/source-watch.md,
 * "The review queue"): what the watchers found, by view, and what a person
 * decides about each item. Trevor chose the one-table layout (mockup A) on
 * Nov. 26, 2026 (/mnt/project-files/design/source-watch-review).
 *
 * Nothing is published from here. An item a person adds keeps the status
 * "added" or "new-version" until the step that turns accepted items into
 * record drafts, which land by pull request and start Unverified.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { candidateFromRow, type CandidateRow, type CandidateStatus, type StoredCandidate, type TriageStep } from './store.ts';

export const reviewViews = ['to-review', 'held', 'closed', 'done'] as const;
export type ReviewView = (typeof reviewViews)[number];

export const reviewViewLabels: Record<ReviewView, string> = {
	'to-review': 'To review',
	held: 'Held',
	closed: 'Closed by rules',
	done: 'Done'
};

/** The statuses each view shows. Items waiting for a model are counted on the page but not listed: they reach To review within minutes. */
export const viewStatuses: Record<ReviewView, readonly CandidateStatus[]> = {
	'to-review': ['to-review'],
	held: ['held'],
	closed: ['closed-by-rules'],
	done: ['added', 'new-version', 'same-as', 'not-relevant']
};

/** Held items (privacy holds and nations' restrictions) are for the lead author only (decision records 0056 and 0057). */
export function viewsFor(isLeadAuthor: boolean): readonly ReviewView[] {
	return isLeadAuthor ? reviewViews : reviewViews.filter((view) => view !== 'held');
}

export function readView(text: string | null, isLeadAuthor: boolean): ReviewView {
	const allowed = viewsFor(isLeadAuthor);
	return (allowed as readonly string[]).includes(text ?? '') ? (text as ReviewView) : 'to-review';
}

/** The filters "Add filter" offers. */
export const filterKinds = ['collection', 'nation', 'watcher', 'proposed'] as const;
export type FilterKind = (typeof filterKinds)[number];

export const filterKindLabels: Record<FilterKind, string> = {
	collection: 'Collection',
	nation: 'Nation',
	watcher: 'Watcher',
	proposed: 'Proposed'
};

export type ReviewFilters = Partial<Record<FilterKind, string>>;

export function readFilters(parameters: URLSearchParams): ReviewFilters {
	const filters: ReviewFilters = {};
	for (const kind of filterKinds) {
		const value = parameters.get(kind)?.trim();
		if (value) filters[kind] = value.slice(0, 200);
	}
	return filters;
}

export const pageSize = 100;

export interface ReviewList {
	items: StoredCandidate[];
	/** How many match the view and filters. */
	total: number;
	/** How many each view holds, without filters. */
	counts: Record<ReviewView, number>;
	waitingForModel: number;
	/** What the filters can be set to, from the view's items. */
	choices: Record<FilterKind, string[]>;
}

function whereFor(view: ReviewView, filters: ReviewFilters): { sql: string; values: string[] } {
	const statuses = viewStatuses[view];
	const parts = [`status IN (${statuses.map(() => '?').join(', ')})`];
	const values: string[] = [...statuses];
	// JSON arrays are matched on the quoted value, so "ecfr" never matches "ecfr-2".
	if (filters.collection) {
		parts.push('feeds LIKE ?');
		values.push(`%${JSON.stringify(filters.collection)}%`);
	}
	if (filters.nation) {
		parts.push('nations LIKE ?');
		values.push(`%${JSON.stringify(filters.nation)}%`);
	}
	if (filters.watcher) {
		parts.push('watcher = ?');
		values.push(filters.watcher);
	}
	if (filters.proposed) {
		parts.push(filters.proposed === 'none' ? 'proposed IS NULL' : 'proposed = ?');
		if (filters.proposed !== 'none') values.push(filters.proposed);
	}
	return { sql: parts.join(' AND '), values };
}

export async function reviewList(database: D1Database, view: ReviewView, filters: ReviewFilters): Promise<ReviewList> {
	const { sql, values } = whereFor(view, filters);
	const [{ results }, total, statusRows, choiceRows] = await Promise.all([
		database
			.prepare(`SELECT * FROM watch_candidates WHERE ${sql} ORDER BY COALESCE(published_on, substr(found_at, 1, 10)) DESC, identifier DESC LIMIT ?`)
			.bind(...values, pageSize)
			.all<CandidateRow>(),
		database
			.prepare(`SELECT COUNT(*) AS count FROM watch_candidates WHERE ${sql}`)
			.bind(...values)
			.first<{ count: number }>(),
		database.prepare('SELECT status, COUNT(*) AS count FROM watch_candidates GROUP BY status').all<{ status: CandidateStatus; count: number }>(),
		database
			.prepare(`SELECT watcher, feeds, nations, proposed FROM watch_candidates WHERE status IN (${viewStatuses[view].map(() => '?').join(', ')}) LIMIT 5000`)
			.bind(...viewStatuses[view])
			.all<{ watcher: string; feeds: string; nations: string; proposed: string | null }>()
	]);
	const counts = Object.fromEntries(reviewViews.map((name) => [name, 0])) as Record<ReviewView, number>;
	let waitingForModel = 0;
	for (const row of statusRows.results) {
		if (row.status === 'waiting-for-model') waitingForModel += row.count;
		for (const name of reviewViews) if (viewStatuses[name].includes(row.status)) counts[name] += row.count;
	}
	const sets: Record<FilterKind, Set<string>> = { collection: new Set(), nation: new Set(), watcher: new Set(), proposed: new Set() };
	for (const row of choiceRows.results) {
		sets.watcher.add(row.watcher);
		sets.proposed.add(row.proposed ?? 'none');
		for (const feed of JSON.parse(row.feeds) as string[]) sets.collection.add(feed);
		for (const nation of JSON.parse(row.nations) as string[]) sets.nation.add(nation);
	}
	const choices = Object.fromEntries(filterKinds.map((kind) => [kind, [...sets[kind]].sort()])) as Record<FilterKind, string[]>;
	return { items: results.map(candidateFromRow), total: total?.count ?? 0, counts, waitingForModel, choices };
}

/* Decisions ---------------------------------------------------------------- */

export const decisions = ['add', 'new-version', 'same-as', 'not-relevant', 'hold', 'ask-nation', 'reopen'] as const;
export type Decision = (typeof decisions)[number];

export const decisionStatuses: Record<Decision, CandidateStatus> = {
	add: 'added',
	'new-version': 'new-version',
	'same-as': 'same-as',
	'not-relevant': 'not-relevant',
	hold: 'held',
	'ask-nation': 'held',
	reopen: 'to-review'
};

export const decisionWords: Record<Decision, string> = {
	add: 'Added',
	'new-version': 'Added as a new version',
	'same-as': 'Same as a record we hold',
	'not-relevant': 'Not relevant',
	hold: 'Held',
	'ask-nation': 'Held to ask the nation',
	reopen: 'Reopened'
};

export interface DecisionInput {
	identifier: number;
	decision: Decision;
	/** The record it is the same as, or a new version of, when the person names one. */
	record?: string | null;
	note?: string | null;
}

/** Records a person's decision on an item. Answers a problem in words when it cannot. */
export async function decide(database: D1Database, input: DecisionInput, person: { identifier: string; isLeadAuthor: boolean }, now: Date): Promise<{ problem: string } | { status: CandidateStatus }> {
	const row = await database.prepare('SELECT * FROM watch_candidates WHERE identifier = ?').bind(input.identifier).first<CandidateRow>();
	if (!row) return { problem: 'That item is not in the source watch.' };
	const current = candidateFromRow(row);
	// Held items are the lead author's (privacy holds and nations' restrictions).
	if (current.status === 'held' && !person.isLeadAuthor) return { problem: 'Only the lead author can decide held items.' };
	if (input.decision === 'same-as' && !(input.record?.trim() || current.matchRecord)) return { problem: 'Name the record it is the same as.' };
	const status = decisionStatuses[input.decision];
	const record = input.record?.trim() || null;
	const note = input.note?.trim().slice(0, 1000) || null;
	const step: TriageStep = {
		step: 'person',
		by: person.identifier,
		answer: input.decision,
		reason: [decisionWords[input.decision], record ? `record ${record}` : '', note ?? ''].filter(Boolean).join(': '),
		at: now.toISOString()
	};
	await database
		.prepare(
			`UPDATE watch_candidates SET status = ?, match_record = COALESCE(?, match_record), triage = ?, decided_by = ?, decided_at = ?, decision_note = ?, updated_at = ?
			 WHERE identifier = ?`
		)
		.bind(status, record, JSON.stringify([...current.triage, step]), input.decision === 'reopen' ? null : person.identifier, input.decision === 'reopen' ? null : now.toISOString(), note, now.toISOString(), input.identifier)
		.run();
	return { status };
}
