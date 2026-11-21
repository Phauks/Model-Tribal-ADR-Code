/**
 * Who may do what in the co-author workspace (site/COLLABORATION.md).
 *
 * Roles are stored in the database, not in Auth0, so the lead author can
 * change them from the website and every change is recorded. Each permission
 * is checked on the server for every request; the page only hides controls
 * a person cannot use.
 */

export const roles = ['lead-author', 'editor', 'co-author', 'advisor', 'nation-reviewer'] as const;
export type Role = (typeof roles)[number];

export const roleLabels: Record<Role, string> = {
	'lead-author': 'Lead author',
	editor: 'Editor',
	'co-author': 'Co-author',
	advisor: 'Advisor',
	'nation-reviewer': 'Nation reviewer'
};

export const roleDescriptions: Record<Role, string> = {
	'lead-author':
		'Everything editors can do, and adds, changes and removes people. Only the lead author manages access.',
	editor:
		'Handles requests from nations (reads them, opens uploaded proof, changes their status and decides them) and signs off on content.',
	'co-author':
		'Reads the review list and comments on content. Changes to content are still made by pull request.',
	advisor: 'Signs off on content or asks for changes, as a project advisor, and comments.',
	'nation-reviewer':
		'Reviews the record of one nation, for that nation: approves it, asks for changes or comments. Sees nothing else.'
};

export type Permission =
	| 'manage-people'
	| 'read-requests'
	| 'handle-requests'
	| 'read-reviews'
	| 'comment'
	| 'sign-off'
	| 'review-for-nation';

const grants: Record<Role, readonly Permission[]> = {
	'lead-author': [
		'manage-people',
		'read-requests',
		'handle-requests',
		'read-reviews',
		'comment',
		'sign-off'
	],
	editor: ['read-requests', 'handle-requests', 'read-reviews', 'comment', 'sign-off'],
	'co-author': ['read-reviews', 'comment'],
	advisor: ['read-reviews', 'comment', 'sign-off'],
	'nation-reviewer': ['review-for-nation']
};

export interface Grantee {
	role: Role;
	/** Set only for a nation reviewer. */
	nationIdentifier: string | null;
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

export interface Subject {
	kind: SubjectKind;
	identifier: string;
}

/**
 * Whether a person may see a piece of content in the review list and its
 * review history. A nation reviewer sees only their own nation's record.
 */
export function canSeeSubject(person: Grantee, subject: Subject): boolean {
	if (can(person, 'read-reviews')) return true;
	return (
		can(person, 'review-for-nation') &&
		subject.kind === 'nation' &&
		subject.identifier === person.nationIdentifier
	);
}

/**
 * The decisions a person may record on a piece of content, and the capacity
 * the review is recorded in. An empty list means they may not review it.
 * Only a nation reviewer can record a nation's approval; only the lead
 * author, editors and advisors can sign off for the project.
 */
export function allowedDecisions(
	person: Grantee,
	subject: Subject
): { capacity: Capacity; decisions: readonly Decision[] } | undefined {
	if (!canSeeSubject(person, subject)) return undefined;
	if (person.role === 'nation-reviewer') return { capacity: 'nation', decisions };
	if (can(person, 'sign-off')) return { capacity: person.role, decisions };
	if (can(person, 'comment')) return { capacity: person.role, decisions: ['comment'] };
	return undefined;
}
