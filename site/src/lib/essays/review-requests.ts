/**
 * Asking people to review an essay draft, or one section of it, by a date
 * and with a message (docs/editing.md, "Sharing and asking for review";
 * migrations/20261123T0624_add_essay_review_requests.sql). The lead author
 * approved the "Share and review" mockup on Nov. 22, 2026. Used by the
 * editor and the server alike.
 */
import { joinNames } from './credits.ts';

export interface Reviewer {
	personIdentifier: string;
	personName: string;
	doneAt: string | null;
}

export interface ReviewRequest {
	identifier: string;
	essay: string;
	/** The section's heading id, or null for the whole essay. */
	sectionSlug: string | null;
	sectionTitle: string | null;
	/** YYYY-MM-DD, or null. */
	dueOn: string | null;
	message: string | null;
	versionNumber: number | null;
	requestedBy: string;
	requestedByName: string;
	createdAt: string;
	closedAt: string | null;
	reviewers: Reviewer[];
}

/** Whether a request still waits on someone. */
export function isOpen(request: ReviewRequest): boolean {
	return request.closedAt === null && request.reviewers.some((reviewer) => reviewer.doneAt === null);
}

/** Whether this person was asked and has not finished. */
export function waitsOn(request: ReviewRequest, person: string | null): boolean {
	return isOpen(request) && request.reviewers.some((reviewer) => reviewer.personIdentifier === person && reviewer.doneAt === null);
}

/** The open requests on one section, or on the whole essay when the slug is null. */
export function openRequestsOn(requests: ReviewRequest[], slug: string | null): ReviewRequest[] {
	return requests.filter((request) => request.sectionSlug === slug && isOpen(request));
}

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Friday, November 27" for "2026-11-27"; the year is added when it is not this one. */
export function dueDate(dueOn: string, today = new Date()): string {
	const [year, month, day] = dueOn.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	const text = `${weekdays[date.getUTCDay()]}, ${months[month - 1]} ${day}`;
	return year === today.getFullYear() ? text : `${text}, ${year}`;
}

/** Whether a YYYY-MM-DD date is a real calendar date. */
export function isCalendarDate(value: unknown): value is string {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** "In review with Ann and Ben, due Friday, November 27": who still has to finish. */
export function inReviewText(request: ReviewRequest, today = new Date()): string {
	const waiting = request.reviewers.filter((reviewer) => reviewer.doneAt === null).map((reviewer) => reviewer.personName);
	const due = request.dueOn ? `, due ${dueDate(request.dueOn, today)}` : '';
	return `In review with ${joinNames(waiting)}${due}`;
}
