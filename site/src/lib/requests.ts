/**
 * Requests from Native nations and contributors: the words and rules from
 * docs/requests.md, shared by the request form and the co-author workspace.
 */

export const requestKinds = [
	'correct',
	'restrict',
	'remove',
	'replace-name',
	'add-nation',
	'contribute',
	'question'
] as const;
export type RequestKind = (typeof requestKinds)[number];

export const requestKindLabels: Record<RequestKind, string> = {
	correct: 'Correct something',
	restrict: 'Make something private',
	remove: 'Delete something',
	'replace-name': 'Replace a name with initials',
	'add-nation': 'Add a nation that is missing',
	contribute: 'Contribute (sources, review, terms, writing)',
	question: 'Ask a question'
};

export const requestKindHints: Record<RequestKind, string> = {
	correct: 'A fact, name, spelling or citation is wrong.',
	restrict:
		'We keep it in our private records but stop showing it, for example because it is sensitive or belongs to the community. We hide it within 7 days, then review it.',
	remove:
		'We delete it from the website and from later editions of the book. We hide it within 7 days, then review it.',
	'replace-name':
		'You, your child or a relative is named in a court opinion on this site. We replace the name with initials within 7 days. No court order needed.',
	'add-nation':
		'A nation is not listed. One federal or state government source that names it is enough.',
	contribute: 'Offer sources, review, preferred terms or writing.',
	question: 'Anything else about the site, the code or the book.'
};

export function isRequestKind(value: unknown): value is RequestKind {
	return typeof value === 'string' && (requestKinds as readonly string[]).includes(value);
}

export const requestStatuses = [
	'received',
	'acknowledged',
	'hidden-pending-review',
	'checking-proof',
	'confirming-with-nation',
	'waiting-for-requester',
	'resolved'
] as const;
export type RequestStatus = (typeof requestStatuses)[number];

export const requestStatusLabels: Record<RequestStatus, string> = {
	received: 'Received',
	acknowledged: 'Acknowledged',
	'hidden-pending-review': 'Hidden, pending review',
	'checking-proof': 'Checking proof',
	'confirming-with-nation': 'Confirming with the nation',
	'waiting-for-requester': 'Waiting for the requester',
	resolved: 'Resolved'
};

/** Statuses that apply to a kind of request (docs/requests.md, "Request statuses"). */
export function statusesFor(kind: RequestKind): RequestStatus[] {
	return requestStatuses.filter((status) => {
		if (status === 'hidden-pending-review') return kind === 'restrict' || kind === 'remove';
		if (status === 'checking-proof') return kind === 'add-nation';
		return true;
	});
}

export const requestOutcomes = [
	'corrected',
	'restricted',
	'withdrawn',
	'added',
	'answered',
	'declined'
] as const;
export type RequestOutcome = (typeof requestOutcomes)[number];

export const requestOutcomeLabels: Record<RequestOutcome, string> = {
	corrected: 'Corrected',
	restricted: 'Restricted',
	withdrawn: 'Withdrawn',
	added: 'Added',
	answered: 'Answered',
	declined: 'Declined (reason given to the requester)'
};

export const sourceKinds = ['federal', 'state', 'petitioning', 'other-official'] as const;
export type SourceKind = (typeof sourceKinds)[number];

export const sourceKindLabels: Record<SourceKind, string> = {
	federal: 'Federal recognition (the federal list, or an act of Congress)',
	state: 'State recognition (a statute, resolution, commission list or executive order)',
	petitioning: 'Federal acknowledgment petition (25 C.F.R. part 83)',
	'other-official':
		'Another official source (a termination statute, a Census tribal area, a federal report or award)'
};

export const authorityStatements = ['authorized-by-government', 'not-writing-for-government'] as const;
export type AuthorityStatement = (typeof authorityStatements)[number];

export const authorityStatementLabels: Record<AuthorityStatement, string> = {
	'authorized-by-government':
		'I am authorized by this nation’s government to make this request, and the information I gave is accurate to the best of my knowledge.',
	'not-writing-for-government':
		'I am not writing for the nation’s government. We will contact the nation ourselves.'
};

const day = 24 * 60 * 60 * 1000;

function addDays(time: string, days: number): string {
	return new Date(new Date(time).getTime() + days * day).toISOString();
}

export interface DeadlineInput {
	kind: RequestKind;
	status: RequestStatus;
	outcome: RequestOutcome | null;
	receivedAt: string;
	acknowledgedAt: string | null;
	materialHiddenAt: string | null;
	resolvedAt: string | null;
}

export interface Deadline {
	label: string;
	due: string;
	overdue: boolean;
}

/**
 * The project's own targets from docs/requests.md, "What happens after a
 * request": acknowledge within 7 days; hide material named in a restrict or
 * remove request within 7 days, before review; decide within 30 days of
 * acknowledgment. A declined application to add a nation can be
 * reconsidered within 60 days.
 */
export function deadlinesOf(request: DeadlineInput, at: Date = new Date()): Deadline[] {
	const deadlines: Deadline[] = [];
	const add = (label: string, due: string) =>
		deadlines.push({ label, due, overdue: new Date(due).getTime() < at.getTime() });

	if (request.status === 'resolved') {
		if (request.kind === 'add-nation' && request.outcome === 'declined' && request.resolvedAt) {
			const until = addDays(request.resolvedAt, 60);
			if (new Date(until).getTime() >= at.getTime()) {
				deadlines.push({ label: 'Reconsideration can be asked until', due: until, overdue: false });
			}
		}
		return deadlines;
	}
	if (!request.acknowledgedAt) add('Acknowledge by', addDays(request.receivedAt, 7));
	if ((request.kind === 'restrict' || request.kind === 'remove') && !request.materialHiddenAt) {
		add('Hide the material by', addDays(request.receivedAt, 7));
	}
	if (request.acknowledgedAt) add('Decide by', addDays(request.acknowledgedAt, 30));
	return deadlines;
}

/** Personal details are deleted this long after a request is resolved, unless credited. */
export const personalDetailsKeptDays = 365;
