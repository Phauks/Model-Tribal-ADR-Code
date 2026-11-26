/**
 * The source watch's tables (migrations/20261126T1930_add_source_watch.sql):
 * candidates, cursors, runs, watched pages and model spend. The watch Worker
 * writes them; the workspace's Source watch page reads them.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import type { Feed, HostingRule, MatchKind, ProposedAction, SensitivityFlag, Tier } from './watcher.ts';

export const candidateStatuses = ['waiting-for-model', 'to-review', 'held', 'closed-by-rules', 'added', 'new-version', 'same-as', 'not-relevant'] as const;
export type CandidateStatus = (typeof candidateStatuses)[number];

/** One step of triage, as the candidate records it. */
export interface TriageStep {
	step: 'rules' | 'cheap-model' | 'top-model' | 'sample-check' | 'person';
	/** The rule's name, or the model's identifier. */
	by: string;
	answer: string;
	reason: string;
	at: string;
}

/** A candidate as it is written: everything after a watcher found it and the rules looked. */
export interface Candidate {
	watcher: string;
	sourceIdentifier: string;
	kind: string;
	title: string;
	publishedOn: string | null;
	link: string | null;
	feeds: Feed[];
	nations: string[];
	facts: Record<string, unknown>;
	summary: string | null;
	captureKey: string | null;
	captureSha256: string | null;
	previousCaptureKey: string | null;
	difference: string | null;
	matchKind: MatchKind;
	matchRecord: string | null;
	proposed: ProposedAction | null;
	relevance: number | null;
	triage: TriageStep[];
	sensitivity: SensitivityFlag[];
	noModelText: boolean;
	hosting: HostingRule;
	tier: Tier;
	status: CandidateStatus;
}

export interface StoredCandidate extends Candidate {
	identifier: number;
	decidedBy: string | null;
	decidedAt: string | null;
	decisionNote: string | null;
	foundAt: string;
	updatedAt: string;
}

export interface CandidateRow {
	identifier: number;
	watcher: string;
	source_identifier: string;
	kind: string;
	title: string;
	published_on: string | null;
	link: string | null;
	feeds: string;
	nations: string;
	facts: string;
	summary: string | null;
	capture_key: string | null;
	capture_sha256: string | null;
	previous_capture_key: string | null;
	difference: string | null;
	match_kind: MatchKind;
	match_record: string | null;
	proposed: ProposedAction | null;
	relevance: number | null;
	triage: string;
	sensitivity: string;
	no_model_text: number;
	hosting: HostingRule;
	tier: string;
	status: CandidateStatus;
	decided_by: string | null;
	decided_at: string | null;
	decision_note: string | null;
	found_at: string;
	updated_at: string;
}

function parsed<Value>(text: string, fallback: Value): Value {
	try {
		return JSON.parse(text) as Value;
	} catch {
		return fallback;
	}
}

export function candidateFromRow(row: CandidateRow): StoredCandidate {
	return {
		identifier: row.identifier,
		watcher: row.watcher,
		sourceIdentifier: row.source_identifier,
		kind: row.kind,
		title: row.title,
		publishedOn: row.published_on,
		link: row.link,
		feeds: parsed(row.feeds, []),
		nations: parsed(row.nations, []),
		facts: parsed(row.facts, {}),
		summary: row.summary,
		captureKey: row.capture_key,
		captureSha256: row.capture_sha256,
		previousCaptureKey: row.previous_capture_key,
		difference: row.difference,
		matchKind: row.match_kind,
		matchRecord: row.match_record,
		proposed: row.proposed,
		relevance: row.relevance,
		triage: parsed(row.triage, []),
		sensitivity: parsed(row.sensitivity, []),
		noModelText: row.no_model_text === 1,
		hosting: row.hosting,
		tier: (row.tier === 'nations' ? 'nations' : Number(row.tier)) as Tier,
		status: row.status,
		decidedBy: row.decided_by,
		decidedAt: row.decided_at,
		decisionNote: row.decision_note,
		foundAt: row.found_at,
		updatedAt: row.updated_at
	};
}

/** Whether an item is already known, so a run fetches and stores nothing for it again. */
export async function candidateExists(database: D1Database, watcher: string, sourceIdentifier: string): Promise<boolean> {
	const row = await database.prepare('SELECT 1 AS found FROM watch_candidates WHERE watcher = ? AND source_identifier = ?').bind(watcher, sourceIdentifier).first<{ found: number }>();
	return row !== null;
}

/** Writes a new candidate. Seeing the same item again changes nothing; answers whether it was new. */
export async function addCandidate(database: D1Database, candidate: Candidate, now: Date): Promise<boolean> {
	const at = now.toISOString();
	const result = await database
		.prepare(
			`INSERT INTO watch_candidates (watcher, source_identifier, kind, title, published_on, link, feeds, nations, facts, summary,
				capture_key, capture_sha256, previous_capture_key, difference, match_kind, match_record, proposed, relevance, triage,
				sensitivity, no_model_text, hosting, tier, status, found_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (watcher, source_identifier) DO NOTHING`
		)
		.bind(
			candidate.watcher,
			candidate.sourceIdentifier,
			candidate.kind,
			candidate.title,
			candidate.publishedOn,
			candidate.link,
			JSON.stringify(candidate.feeds),
			JSON.stringify(candidate.nations),
			JSON.stringify(candidate.facts),
			candidate.summary,
			candidate.captureKey,
			candidate.captureSha256,
			candidate.previousCaptureKey,
			candidate.difference,
			candidate.matchKind,
			candidate.matchRecord,
			candidate.proposed,
			candidate.relevance,
			JSON.stringify(candidate.triage),
			JSON.stringify(candidate.sensitivity),
			candidate.noModelText ? 1 : 0,
			candidate.hosting,
			String(candidate.tier),
			candidate.status,
			at,
			at
		)
		.run();
	return (result.meta.changes ?? 0) > 0;
}

/** Candidates in a status, newest first. */
export async function candidatesWithStatus(database: D1Database, statuses: readonly CandidateStatus[], limit = 200): Promise<StoredCandidate[]> {
	const { results } = await database
		.prepare(`SELECT * FROM watch_candidates WHERE status IN (${statuses.map(() => '?').join(', ')}) ORDER BY COALESCE(published_on, found_at) DESC, identifier DESC LIMIT ?`)
		.bind(...statuses, limit)
		.all<CandidateRow>();
	return results.map(candidateFromRow);
}

/** Adds a triage step and sets the outcome it leads to. */
export async function recordTriage(
	database: D1Database,
	identifier: number,
	step: TriageStep,
	outcome: { status?: CandidateStatus; feeds?: Feed[]; nations?: string[]; proposed?: ProposedAction | null; relevance?: number | null; sensitivity?: SensitivityFlag[] },
	now: Date
): Promise<void> {
	const row = await database.prepare('SELECT * FROM watch_candidates WHERE identifier = ?').bind(identifier).first<CandidateRow>();
	if (!row) return;
	const current = candidateFromRow(row);
	await database
		.prepare('UPDATE watch_candidates SET triage = ?, status = ?, feeds = ?, nations = ?, proposed = ?, relevance = ?, sensitivity = ?, updated_at = ? WHERE identifier = ?')
		.bind(
			JSON.stringify([...current.triage, step]),
			outcome.status ?? current.status,
			JSON.stringify(outcome.feeds ?? current.feeds),
			JSON.stringify(outcome.nations ?? current.nations),
			outcome.proposed === undefined ? current.proposed : outcome.proposed,
			outcome.relevance === undefined ? current.relevance : outcome.relevance,
			JSON.stringify(outcome.sensitivity ?? current.sensitivity),
			now.toISOString(),
			identifier
		)
		.run();
}

/** How many candidates are in each status. */
export async function candidateCounts(database: D1Database): Promise<Record<CandidateStatus, number>> {
	const counts = Object.fromEntries(candidateStatuses.map((status) => [status, 0])) as Record<CandidateStatus, number>;
	const { results } = await database.prepare('SELECT status, COUNT(*) AS count FROM watch_candidates GROUP BY status').all<{ status: CandidateStatus; count: number }>();
	for (const row of results) if (row.status in counts) counts[row.status] = row.count;
	return counts;
}

/* Cursors ------------------------------------------------------------------ */

export async function readCursor(database: D1Database, watcher: string): Promise<string | null> {
	const row = await database.prepare('SELECT cursor FROM watch_cursors WHERE watcher = ?').bind(watcher).first<{ cursor: string | null }>();
	return row?.cursor ?? null;
}

export async function writeCursor(database: D1Database, watcher: string, cursor: string | null, now: Date): Promise<void> {
	await database
		.prepare('INSERT INTO watch_cursors (watcher, cursor, updated_at) VALUES (?, ?, ?) ON CONFLICT (watcher) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at')
		.bind(watcher, cursor, now.toISOString())
		.run();
}

/* Runs --------------------------------------------------------------------- */

export type RunOutcome = 'running' | 'finished' | 'come-back-later' | 'failed';

export interface RunCounts {
	found: number;
	newItems: number;
	closedByRules: number;
	toReview: number;
}

export async function startRun(database: D1Database, identifier: string, watcher: string, now: Date): Promise<void> {
	await database
		.prepare(`INSERT INTO watch_runs (identifier, watcher, started_at, outcome) VALUES (?, ?, ?, 'running') ON CONFLICT (identifier) DO NOTHING`)
		.bind(identifier, watcher, now.toISOString())
		.run();
}

export async function finishRun(database: D1Database, identifier: string, outcome: RunOutcome, counts: RunCounts, problem: string | null, now: Date): Promise<void> {
	await database
		.prepare('UPDATE watch_runs SET finished_at = ?, outcome = ?, found = ?, new_items = ?, closed_by_rules = ?, to_review = ?, problem = ? WHERE identifier = ?')
		.bind(now.toISOString(), outcome, counts.found, counts.newItems, counts.closedByRules, counts.toReview, problem, identifier)
		.run();
}

export interface RunSummary {
	watcher: string;
	startedAt: string;
	finishedAt: string | null;
	outcome: RunOutcome;
	found: number;
	newItems: number;
	closedByRules: number;
	toReview: number;
	problem: string | null;
}

/** Each watcher's latest run. */
export async function latestRuns(database: D1Database): Promise<RunSummary[]> {
	const { results } = await database
		.prepare(
			`SELECT watcher, started_at, finished_at, outcome, found, new_items, closed_by_rules, to_review, problem FROM watch_runs AS outer_run
			 WHERE started_at = (SELECT MAX(started_at) FROM watch_runs WHERE watcher = outer_run.watcher) ORDER BY watcher`
		)
		.all<{ watcher: string; started_at: string; finished_at: string | null; outcome: RunOutcome; found: number; new_items: number; closed_by_rules: number; to_review: number; problem: string | null }>();
	return results.map((row) => ({
		watcher: row.watcher,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		outcome: row.outcome,
		found: row.found,
		newItems: row.new_items,
		closedByRules: row.closed_by_rules,
		toReview: row.to_review,
		problem: row.problem
	}));
}

/* Watched pages ------------------------------------------------------------ */

export interface PageState {
	entityTag: string | null;
	lastModified: string | null;
	sha256: string | null;
	captureKey: string | null;
	status: number | null;
	checkedAt: string;
}

/** Per-address memory for watchers that re-check pages and files. */
export interface PageMemory {
	read(address: string): Promise<PageState | null>;
	write(address: string, state: PageState): Promise<void>;
}

export function pageMemory(database: D1Database, watcher: string): PageMemory {
	return {
		async read(address) {
			const row = await database
				.prepare('SELECT entity_tag, last_modified, sha256, capture_key, status, checked_at FROM watch_pages WHERE watcher = ? AND address = ?')
				.bind(watcher, address)
				.first<{ entity_tag: string | null; last_modified: string | null; sha256: string | null; capture_key: string | null; status: number | null; checked_at: string }>();
			return row ? { entityTag: row.entity_tag, lastModified: row.last_modified, sha256: row.sha256, captureKey: row.capture_key, status: row.status, checkedAt: row.checked_at } : null;
		},
		async write(address, state) {
			await database
				.prepare(
					`INSERT INTO watch_pages (watcher, address, entity_tag, last_modified, sha256, capture_key, status, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT (watcher, address) DO UPDATE SET entity_tag = excluded.entity_tag, last_modified = excluded.last_modified, sha256 = excluded.sha256,
						capture_key = excluded.capture_key, status = excluded.status, checked_at = excluded.checked_at`
				)
				.bind(watcher, address, state.entityTag, state.lastModified, state.sha256, state.captureKey, state.status, state.checkedAt)
				.run();
		}
	};
}

/* Model spend -------------------------------------------------------------- */

export interface ModelUse {
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	costMicrodollars: number;
}

export async function recordModelUse(database: D1Database, use: ModelUse, now: Date): Promise<void> {
	await database
		.prepare(
			`INSERT INTO watch_model_spend (day, model, calls, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_microdollars)
			 VALUES (?, ?, 1, ?, ?, ?, ?, ?)
			 ON CONFLICT (day, model) DO UPDATE SET calls = calls + 1, input_tokens = input_tokens + excluded.input_tokens,
				output_tokens = output_tokens + excluded.output_tokens, cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
				cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens, cost_microdollars = cost_microdollars + excluded.cost_microdollars`
		)
		.bind(now.toISOString().slice(0, 10), use.model, use.inputTokens, use.outputTokens, use.cacheReadTokens, use.cacheWriteTokens, use.costMicrodollars)
		.run();
}

export interface SpendRow {
	model: string;
	calls: number;
	costMicrodollars: number;
}

/** Spend per model since a day (YYYY-MM-DD). */
export async function spendSince(database: D1Database, day: string): Promise<SpendRow[]> {
	const { results } = await database
		.prepare('SELECT model, SUM(calls) AS calls, SUM(cost_microdollars) AS cost FROM watch_model_spend WHERE day >= ? GROUP BY model ORDER BY model')
		.bind(day)
		.all<{ model: string; calls: number; cost: number }>();
	return results.map((row) => ({ model: row.model, calls: row.calls, costMicrodollars: row.cost }));
}
