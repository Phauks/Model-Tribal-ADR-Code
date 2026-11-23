/**
 * Sharing an essay draft and asking for review (src/lib/essays/review-requests.ts;
 * migrations/20261123T0624_add_essay_review_requests.sql): who can open the
 * essay and at what level, and the requests to review it. Each request and
 * each change is recorded in the activity log in the same batch.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { atLeast, documentAccess, everyDocument, type AccessGrant, type AccessLevel, type AccessSource, type Role } from '../permissions.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import type { Reviewer, ReviewRequest } from '../essays/review-requests.ts';
import { essayPath, type EssayPart } from './essays.ts';

export interface EssayPerson {
	identifier: string;
	name: string;
	role: Role;
	level: AccessLevel;
	source: AccessSource;
}

/**
 * Everyone who can open an essay (comment access or above), from their role
 * and the lead author's grants, with the lead author first and then by name.
 * With `everyone`, people without access are included too, for the lead
 * author to add.
 */
export async function essayPeople(database: D1Database, essay: string, { everyone = false } = {}): Promise<EssayPerson[]> {
	const [people, grants] = await Promise.all([
		database
			.prepare(
				`SELECT identifier, display_name AS name, role, nation_identifier AS nationIdentifier FROM people
				 WHERE status != 'removed' ORDER BY role != 'lead-author', display_name COLLATE NOCASE`
			)
			.all<{ identifier: string; name: string; role: Role; nationIdentifier: string | null }>(),
		database
			.prepare(
				`SELECT person_identifier AS personIdentifier, subject_kind AS subjectKind, subject_identifier AS subjectIdentifier,
					level, expires_at AS expiresAt
				 FROM access_grants
				 WHERE ended_at IS NULL AND subject_kind = 'essay' AND subject_identifier IN (?, ?)`
			)
			.bind(essay, everyDocument)
			.all<AccessGrant & { personIdentifier: string }>()
	]);
	const byPerson = new Map<string, AccessGrant[]>();
	for (const grant of grants.results) byPerson.set(grant.personIdentifier, [...(byPerson.get(grant.personIdentifier) ?? []), grant]);
	return people.results
		.map((person) => {
			const access = documentAccess(person, { kind: 'essay', identifier: essay }, byPerson.get(person.identifier) ?? []);
			return { identifier: person.identifier, name: person.name, role: person.role, level: access.level, source: access.source };
		})
		.filter((person) => everyone || atLeast(person.level, 'comment'));
}

interface RequestRow extends Omit<ReviewRequest, 'reviewers'> {
	reviewers: string | null;
}

const requestColumns = `essay_review_requests.identifier, essay_identifier AS essay, section_slug AS sectionSlug,
	section_title AS sectionTitle, due_on AS dueOn, message, version_number AS versionNumber, requested_by AS requestedBy,
	asker.display_name AS requestedByName, essay_review_requests.created_at AS createdAt, closed_at AS closedAt,
	(SELECT json_group_array(json_object('personIdentifier', reviewer.person_identifier, 'personName', person.display_name,
		'doneAt', reviewer.done_at))
	 FROM essay_review_reviewers AS reviewer JOIN people AS person ON person.identifier = reviewer.person_identifier
	 WHERE reviewer.request_identifier = essay_review_requests.identifier) AS reviewers`;

function readRow(row: RequestRow): ReviewRequest {
	let reviewers: Reviewer[] = [];
	try {
		reviewers = (JSON.parse(row.reviewers ?? '[]') as Reviewer[]).sort((first, second) => first.personName.localeCompare(second.personName));
	} catch {
		reviewers = [];
	}
	return { ...row, reviewers };
}

/** Every review request on an essay, newest first. */
export async function essayReviewRequests(database: D1Database, essay: string): Promise<ReviewRequest[]> {
	const result = await database
		.prepare(
			`SELECT ${requestColumns} FROM essay_review_requests
			 JOIN people AS asker ON asker.identifier = essay_review_requests.requested_by
			 WHERE essay_identifier = ? ORDER BY essay_review_requests.created_at DESC, essay_review_requests.identifier`
		)
		.bind(essay)
		.all<RequestRow>();
	return result.results.map(readRow);
}

export interface ReviewRequestWithTitle extends ReviewRequest {
	essayTitle: string;
	/** The essay page, opened for commenting at the section to review. */
	link: string;
}

/**
 * The open requests a person was asked to review and has not finished, and
 * the open ones they asked others, soonest due first, for the Review
 * requests page.
 */
export async function reviewRequestsOf(
	database: D1Database,
	person: string
): Promise<{ forYou: ReviewRequestWithTitle[]; yours: ReviewRequestWithTitle[] }> {
	const result = await database
		.prepare(
			`SELECT ${requestColumns},
				(SELECT title FROM essay_versions WHERE essay_versions.essay_identifier = essay_review_requests.essay_identifier
				 ORDER BY number DESC LIMIT 1) AS essayTitle,
				(SELECT part FROM essays WHERE essays.identifier = essay_review_requests.essay_identifier) AS essayPart
			 FROM essay_review_requests
			 JOIN people AS asker ON asker.identifier = essay_review_requests.requested_by
			 WHERE closed_at IS NULL AND (requested_by = ?1 OR EXISTS (
				SELECT 1 FROM essay_review_reviewers WHERE request_identifier = essay_review_requests.identifier
					AND person_identifier = ?1 AND done_at IS NULL))
			 ORDER BY due_on IS NULL, due_on, essay_review_requests.created_at`
		)
		.bind(person)
		.all<RequestRow & { essayTitle: string | null; essayPart: EssayPart | null }>();
	const requests = result.results.map((row) => {
		const { essayTitle, essayPart, ...rest } = row;
		const link = `${essayPath(row.essay, essayPart ?? 'essays')}?review=${encodeURIComponent(row.sectionSlug ?? '')}`;
		return { ...readRow(rest as RequestRow), essayTitle: essayTitle ?? row.essay, link };
	});
	const open = requests.filter((request) => request.reviewers.some((reviewer) => reviewer.doneAt === null));
	return {
		forYou: open.filter((request) => request.reviewers.some((reviewer) => reviewer.personIdentifier === person && reviewer.doneAt === null)),
		yours: open.filter((request) => request.requestedBy === person)
	};
}

/** How many open requests wait on a person, for the sidebar. */
export async function reviewRequestCount(database: D1Database, person: string): Promise<number> {
	const row = await database
		.prepare(
			`SELECT count(*) AS count FROM essay_review_reviewers
			 JOIN essay_review_requests ON essay_review_requests.identifier = essay_review_reviewers.request_identifier
			 WHERE person_identifier = ? AND done_at IS NULL AND closed_at IS NULL`
		)
		.bind(person)
		.first<{ count: number }>();
	return row?.count ?? 0;
}

export interface NewReviewRequest {
	essay: string;
	requestedBy: string;
	reviewers: string[];
	section: { slug: string; title: string } | null;
	dueOn: string | null;
	message: string | null;
	versionNumber: number | null;
}

/** Asks people to review; the caller checks that each of them can open the essay. */
export async function requestReview(database: D1Database, input: NewReviewRequest): Promise<string> {
	const reviewers = [...new Set(input.reviewers)];
	if (reviewers.length === 0) throw new Error('Choose who should review it.');
	if (reviewers.length > 20) throw new Error('Ask at most 20 people at once.');
	const message = input.message?.trim() || null;
	if (message && message.length > 2000) throw new Error('A message can be at most 2,000 characters.');
	const identifier = newIdentifier();
	const what = input.section ? `"${input.section.title.slice(0, 80)}"` : 'the whole draft';
	await database.batch([
		database
			.prepare(
				`INSERT INTO essay_review_requests (identifier, essay_identifier, section_slug, section_title, due_on, message,
					version_number, requested_by, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				input.essay,
				input.section?.slug ?? null,
				input.section?.title.slice(0, 300) ?? null,
				input.dueOn,
				message,
				input.versionNumber,
				input.requestedBy,
				now()
			),
		...reviewers.map((person) =>
			database
				.prepare('INSERT INTO essay_review_reviewers (request_identifier, person_identifier) VALUES (?, ?)')
				.bind(identifier, person)
		),
		eventStatement(database, {
			personIdentifier: input.requestedBy,
			action: `Asked ${reviewers.length === 1 ? 'one person' : `${reviewers.length} people`} to review ${what}`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`,
			note: input.dueOn ? `By ${input.dueOn}` : null
		})
	]);
	return identifier;
}

async function requestOn(database: D1Database, essay: string, request: string): Promise<ReviewRequest | null> {
	const row = await database
		.prepare(
			`SELECT ${requestColumns} FROM essay_review_requests
			 JOIN people AS asker ON asker.identifier = essay_review_requests.requested_by
			 WHERE essay_review_requests.identifier = ? AND essay_identifier = ?`
		)
		.bind(request, essay)
		.first<RequestRow>();
	return row ? readRow(row) : null;
}

function describe(request: ReviewRequest): string {
	return request.sectionTitle ? `"${request.sectionTitle.slice(0, 80)}"` : 'the whole draft';
}

/**
 * A reviewer marks their own review done. When every reviewer has, the
 * request closes. Answers false when the person was not asked.
 */
export async function finishReview(database: D1Database, input: { essay: string; request: string; person: string }): Promise<boolean> {
	const request = await requestOn(database, input.essay, input.request);
	const mine = request?.reviewers.find((reviewer) => reviewer.personIdentifier === input.person);
	if (!request || !mine) return false;
	if (mine.doneAt !== null || request.closedAt !== null) return true;
	const time = now();
	const last = request.reviewers.every((reviewer) => reviewer.personIdentifier === input.person || reviewer.doneAt !== null);
	await database.batch([
		database
			.prepare('UPDATE essay_review_reviewers SET done_at = ? WHERE request_identifier = ? AND person_identifier = ?')
			.bind(time, request.identifier, input.person),
		...(last
			? [database.prepare('UPDATE essay_review_requests SET closed_at = ?, closed_by = ? WHERE identifier = ?').bind(time, input.person, request.identifier)]
			: []),
		eventStatement(database, {
			personIdentifier: input.person,
			action: `Finished reviewing ${describe(request)}`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
	return true;
}

/**
 * Closes a request before everyone has finished: the person who asked may,
 * and so may anyone with full access (`mayCloseAny`). Answers false when the
 * request is not there or the person may not.
 */
export async function closeReviewRequest(
	database: D1Database,
	input: { essay: string; request: string; person: string; mayCloseAny: boolean }
): Promise<boolean> {
	const request = await requestOn(database, input.essay, input.request);
	if (!request || (!input.mayCloseAny && request.requestedBy !== input.person)) return false;
	if (request.closedAt !== null) return true;
	await database.batch([
		database.prepare('UPDATE essay_review_requests SET closed_at = ?, closed_by = ? WHERE identifier = ?').bind(now(), input.person, request.identifier),
		eventStatement(database, {
			personIdentifier: input.person,
			action: `Closed the request to review ${describe(request)}`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
	return true;
}
