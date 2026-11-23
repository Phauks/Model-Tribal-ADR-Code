/**
 * Who may do what in the co-author workspace (site/COLLABORATION.md).
 *
 * Two layers decide it:
 *
 * 1. A role, for workspace-wide tasks such as managing people or handling
 *    requests. The lead author is the administrator.
 * 2. An access level for each document (decision record 0023): no access,
 *    comment, contribute or full. A role gives a default level; the lead
 *    author can raise or lower it for one document, or for every document
 *    of a kind, with a grant.
 *
 * Roles and grants are stored in the database, apart from accounts, so the lead
 * author can change them from the website and every change is recorded. Each
 * check runs on the server for every request; the page only hides controls a
 * person cannot use.
 */

export const roles = [
	'lead-author',
	'editor',
	'co-author',
	'advisor',
	'contributor',
	'nation-reviewer'
] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
	'lead-author': 'Lead author',
	editor: 'Editor',
	'co-author': 'Co-author',
	advisor: 'Advisor',
	contributor: 'Contributor',
	'nation-reviewer': 'Nation reviewer'
};

export const roleDescriptions: Record<Role, string> = {
	'lead-author':
		'The administrator: full access to every document, and adds, changes and removes people, grants and restricts access, and sees the activity log; welcomes people who register to help. Only the lead author manages access.',
	editor:
		'Handles requests from nations (reads them, opens uploaded proof, changes their status and decides them), reviews and files the files people send, reads registrations from people who want to help, runs events, and signs off on content.',
	'co-author':
		'Comments on every document unless the lead author grants more or less. Changes to content are still made by pull request.',
	advisor: 'Signs off on content or asks for changes, as a project advisor, and comments.',
	contributor:
		'Sees only the documents the lead author grants them, at the level granted: for example, writes and edits an assigned essay draft. Cannot sign off or publish.',
	'nation-reviewer':
		'Reviews the record of one nation, for that nation: approves it, asks for changes or comments, and comments on files people sent about that nation. Sees nothing else.'
};

export type Permission =
	| 'manage-people'
	| 'read-contributors'
	| 'manage-contributors'
	| 'read-requests'
	| 'handle-requests'
	| 'review-uploads'
	| 'read-reviews'
	| 'comment'
	| 'sign-off'
	| 'review-for-nation'
	// Reading and commenting on files people sent about one's own nation (docs/uploads.md).
	| 'comment-on-nation-uploads'
	// The private address book (migrations/0012_address_book.sql): the lead author only.
	| 'manage-address-book'
	// The project inbox (site/MAIL.md): reading and answering mail, sending
	// outreach batches, and changing tags, folders, rules and the
	// do-not-email list. Only the lead author for now (Trevor, Nov. 23,
	// 2026: an admin-only inbox).
	| 'read-mail'
	| 'send-outreach'
	| 'manage-mail'
	// Hiding parts of a change in Recent changes (migrations/0017_page_changes.sql): the lead author only.
	| 'hide-changes'
	// The nonprofit corporation's record and due dates (migrations/20261123T0440_add_nonprofit_records.sql): the lead author only.
	| 'manage-nonprofit'
	// Checking the services the site depends on (src/lib/server/service-checks.ts): the lead author only.
	| 'check-services'
	// Adding and running events, and seeing who registered (migrations/20261123T0450_add_event_calendar.sql).
	| 'manage-events';

const grants: Record<Role, readonly Permission[]> = {
	'lead-author': [
		'manage-people',
		'read-contributors',
		'manage-contributors',
		'read-requests',
		'handle-requests',
		'review-uploads',
		'read-reviews',
		'comment',
		'sign-off',
		'manage-address-book',
		'read-mail',
		'send-outreach',
		'manage-mail',
		'hide-changes',
		'manage-nonprofit',
		'check-services',
		'manage-events'
	],
	editor: ['read-contributors', 'read-requests', 'handle-requests', 'review-uploads', 'read-reviews', 'comment', 'sign-off', 'manage-events'],
	'co-author': ['read-reviews', 'comment'],
	advisor: ['read-reviews', 'comment', 'sign-off'],
	contributor: ['comment'],
	'nation-reviewer': ['review-for-nation', 'comment-on-nation-uploads']
};

export interface Grantee {
	role: Role;
	/** Set only for a nation reviewer. */
	nationIdentifier: string | null;
}

/** The administrator tier: the lead author. Cannot be restricted by a grant. */
export function isAdministrator(person: Grantee): boolean {
	return person.role === 'lead-author';
}

export function permissionsOf(role: Role): readonly Permission[] {
	return grants[role];
}

export function can(person: Grantee, permission: Permission): boolean {
	return grants[person.role].includes(permission);
}

export const subjectKinds = ['nation', 'glossary-term', 'provision', 'essay'] as const;
export type SubjectKind = (typeof subjectKinds)[number];

export const subjectKindLabels: Record<SubjectKind, string> = {
	nation: 'Nation record',
	'glossary-term': 'Glossary term',
	provision: 'Provision',
	essay: 'Essay'
};

export const decisions = ['approved', 'changes-requested', 'comment'] as const;
export type Decision = (typeof decisions)[number];

export const decisionLabels: Record<Decision, string> = {
	approved: 'Approved',
	'changes-requested': 'Changes requested',
	comment: 'Comment'
};

/** The capacity a review is recorded in: the person's role, or "nation" for a nation reviewer. */
export type Capacity = Exclude<Role, 'nation-reviewer'> | 'nation';

// ---------------------------------------------------------------------------
// Access to each document (decision record 0023)
// ---------------------------------------------------------------------------

/**
 * Levels, lowest first. There is no "view only" level on purpose: anyone who
 * can open a document can comment on it, because the project wants their
 * feedback (Trevor, 2026-11-21).
 */
export const accessLevels = ['no-access', 'comment', 'contribute', 'full'] as const;
export type AccessLevel = (typeof accessLevels)[number];

export const accessLevelLabels: Record<AccessLevel, string> = {
	'no-access': 'No access',
	comment: 'Comment',
	contribute: 'Contribute',
	full: 'Full'
};

export const accessLevelDescriptions: Record<AccessLevel, string> = {
	'no-access': 'Cannot open the document or see that it is being worked on.',
	comment: 'Reads the document and its drafts, and comments.',
	contribute: 'Everything in Comment, and edits the draft and saves versions of it.',
	full: 'Everything in Contribute, and restores an earlier version, resolves or hides others’ comments, and submits the draft for publishing.'
};

/** Whether a level is at least another. */
export function atLeast(level: AccessLevel, minimum: AccessLevel): boolean {
	return accessLevels.indexOf(level) >= accessLevels.indexOf(minimum);
}

/** The level each role starts with on every document, before any grant. */
export const roleDefaultLevels: Record<Role, AccessLevel> = {
	'lead-author': 'full',
	editor: 'contribute',
	advisor: 'comment',
	'co-author': 'comment',
	contributor: 'no-access',
	// Except their own nation's record, which they comment on and approve.
	'nation-reviewer': 'no-access'
};

/** A grant for "every document of this kind" uses this in place of an identifier. */
export const everyDocument = '*';

export interface Subject {
	kind: SubjectKind;
	identifier: string;
}

export interface AccessGrant {
	subjectKind: SubjectKind;
	/** A document's identifier, or everyDocument. */
	subjectIdentifier: string;
	level: AccessLevel;
	/** ISO 8601 time after which the grant no longer counts, or null. */
	expiresAt: string | null;
	/**
	 * Set when the level comes from a place on a nation's team
	 * (src/lib/nation-teams.ts), not from a grant the lead author made.
	 */
	from?: 'nation-team';
}

export type AccessSource = 'administrator' | 'document-grant' | 'nation-team' | 'kind-grant' | 'role';

export interface DocumentAccess {
	level: AccessLevel;
	/** Where the level comes from, shown to the lead author on the Access page. */
	source: AccessSource;
}

/**
 * A person's level on one document. The most specific rule wins:
 *
 * 1. the lead author always has full access (it cannot be restricted, so the
 *    project can never be locked out of its own work);
 * 2. a current grant for this document, made by the lead author;
 * 3. a current place on the nation's team, for a nation's record;
 * 4. a current grant for every document of its kind;
 * 5. the role's default (a nation reviewer comments on their own nation).
 *
 * Because the lead author's own grant comes before a team place, the lead
 * author can always lower or remove anyone's access to a nation's page.
 *
 * A grant of "no access" is how access is restricted; it beats the role's
 * default, and a document grant beats a kind grant either way. Expired grants
 * do not count. The grants passed in must be the person's own, current ones.
 */
export function documentAccess(
	person: Grantee,
	subject: Subject,
	grants: readonly AccessGrant[],
	time: Date = new Date()
): DocumentAccess {
	if (isAdministrator(person)) return { level: 'full', source: 'administrator' };
	const current = grants.filter(
		(grant) =>
			grant.subjectKind === subject.kind &&
			(grant.expiresAt === null || new Date(grant.expiresAt) > time)
	);
	const forDocument = current.find(
		(grant) => grant.subjectIdentifier === subject.identifier && grant.from !== 'nation-team'
	);
	if (forDocument) return { level: forDocument.level, source: 'document-grant' };
	const fromTeam = current.find(
		(grant) => grant.subjectIdentifier === subject.identifier && grant.from === 'nation-team'
	);
	if (fromTeam) return { level: fromTeam.level, source: 'nation-team' };
	const forKind = current.find((grant) => grant.subjectIdentifier === everyDocument);
	if (forKind) return { level: forKind.level, source: 'kind-grant' };
	if (
		person.role === 'nation-reviewer' &&
		subject.kind === 'nation' &&
		subject.identifier === person.nationIdentifier
	) {
		return { level: 'comment', source: 'role' };
	}
	return { level: roleDefaultLevels[person.role], source: 'role' };
}

/**
 * Whether a person may see a piece of content in the review list and its
 * review history: anyone with at least comment access.
 */
export function canSeeSubject(
	person: Grantee,
	subject: Subject,
	grants: readonly AccessGrant[] = []
): boolean {
	return atLeast(documentAccess(person, subject, grants).level, 'comment');
}

/**
 * The decisions a person may record on a piece of content, and the capacity
 * the review is recorded in. An empty list means they may not review it.
 * Anyone with comment access may comment. Only a nation reviewer, on their
 * own nation's record, can record a nation's approval; only the lead author,
 * editors and advisors can sign off for the project.
 */
export function allowedDecisions(
	person: Grantee,
	subject: Subject,
	grants: readonly AccessGrant[] = []
): { capacity: Capacity; decisions: readonly Decision[] } | undefined {
	if (!canSeeSubject(person, subject, grants)) return undefined;
	// Anyone on a nation's team approves that nation's record for the nation,
	// whatever their role in the project.
	const onTeam =
		subject.kind === 'nation' &&
		grants.some(
			(grant) =>
				grant.from === 'nation-team' &&
				grant.subjectKind === 'nation' &&
				grant.subjectIdentifier === subject.identifier &&
				(grant.expiresAt === null || new Date(grant.expiresAt) > new Date())
		);
	if (onTeam) return { capacity: 'nation', decisions };
	if (person.role === 'nation-reviewer') {
		const ownNation = subject.kind === 'nation' && subject.identifier === person.nationIdentifier;
		return { capacity: 'nation', decisions: ownNation ? decisions : ['comment'] };
	}
	if (can(person, 'sign-off')) return { capacity: person.role, decisions };
	return { capacity: person.role, decisions: ['comment'] };
}
