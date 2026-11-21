/**
 * Sign-offs and comments on content (site/COLLABORATION.md, "Reviews").
 * Content itself still changes only by pull request; a review records who
 * approved or questioned which version of a record.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	decisionLabels,
	subjectKindLabels,
	type Capacity,
	type Decision,
	type Subject,
	type SubjectKind
} from '#lib/permissions.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';

export interface ReviewRow {
	identifier: string;
	subjectKind: SubjectKind;
	subjectIdentifier: string;
	contentVersion: string;
	capacity: Capacity;
	decision: Decision;
	note: string | null;
	createdAt: string;
	personName: string;
}

const reviewColumns = `reviews.identifier, reviews.subject_kind AS subjectKind,
	reviews.subject_identifier AS subjectIdentifier, reviews.content_version AS contentVersion,
	reviews.capacity, reviews.decision, reviews.note, reviews.created_at AS createdAt,
	people.display_name AS personName`;

export async function reviewsOf(database: D1Database, subject: Subject): Promise<ReviewRow[]> {
	const result = await database
		.prepare(
			`SELECT ${reviewColumns} FROM reviews JOIN people ON people.identifier = reviews.person_identifier
			 WHERE subject_kind = ? AND subject_identifier = ? ORDER BY reviews.created_at DESC`
		)
		.bind(subject.kind, subject.identifier)
		.all<ReviewRow>();
	return result.results;
}

/** The latest review of each subject, newest first. */
export async function latestReviews(database: D1Database, limit = 200): Promise<ReviewRow[]> {
	const result = await database
		.prepare(
			`SELECT ${reviewColumns} FROM reviews JOIN people ON people.identifier = reviews.person_identifier
			 WHERE reviews.created_at = (
			   SELECT MAX(latest.created_at) FROM reviews AS latest
			   WHERE latest.subject_kind = reviews.subject_kind
			     AND latest.subject_identifier = reviews.subject_identifier)
			 ORDER BY reviews.created_at DESC LIMIT ?`
		)
		.bind(limit)
		.all<ReviewRow>();
	return result.results;
}

export async function recordReview(
	database: D1Database,
	review: {
		subject: Subject;
		contentVersion: string;
		capacity: Capacity;
		decision: Decision;
		note: string | null;
	},
	person: SignedInPerson
): Promise<void> {
	const identifier = newIdentifier();
	await database.batch([
		database
			.prepare(
				`INSERT INTO reviews (identifier, subject_kind, subject_identifier, content_version, person_identifier, capacity, decision, note, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				review.subject.kind,
				review.subject.identifier,
				review.contentVersion,
				person.identifier,
				review.capacity,
				review.decision,
				review.note,
				now()
			),
		eventStatement(database, {
			personIdentifier: person.identifier,
			action: `${decisionLabels[review.decision]}: ${subjectKindLabels[review.subject.kind].toLocaleLowerCase('en-US')} ${review.subject.identifier}`,
			targetKind: 'review',
			targetIdentifier: identifier
		})
	]);
}
