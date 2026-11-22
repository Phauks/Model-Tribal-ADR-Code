/**
 * People who may sign in, and how a sign-in is matched to one of them
 * (site/COLLABORATION.md, "Who can sign in").
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { roleLabels, type Role } from '#lib/permissions.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';

export interface SignedInPerson {
	identifier: string;
	displayName: string;
	email: string;
	role: Role;
	nationIdentifier: string | null;
}

export type PersonStatus = 'invited' | 'active' | 'removed';

export interface PersonRow extends SignedInPerson {
	status: PersonStatus;
	hasSignedIn: boolean;
	addedAt: string;
	lastSignedInAt: string | null;
	addedByName: string | null;
}

const personColumns = `people.identifier, people.display_name AS displayName, people.email,
	people.role, people.nation_identifier AS nationIdentifier`;

/** The claims from Auth0 that matching needs. */
export interface SignInClaims {
	subject: string;
	email: string | undefined;
	emailVerified: boolean;
	name: string | undefined;
}

export type SignInResult =
	| { outcome: 'signed-in'; person: SignedInPerson }
	| { outcome: 'not-on-list' | 'removed' | 'email-not-verified' | 'different-account' };

/**
 * Matches a completed Auth0 sign-in to a person in the database.
 *
 * 1. Someone who has signed in before is matched by their Auth0 identifier.
 * 2. Someone signing in for the first time is matched to an invitation by
 *    email, but only when Auth0 says the email address is verified, so
 *    nobody can claim an invitation by typing someone else's address.
 * 3. The very first lead author is matched by the LEAD_AUTHOR_EMAIL secret,
 *    so the workspace can be set up without editing the database by hand.
 *
 * Everyone else is refused: there is no open sign-up.
 */
export async function matchSignIn(
	database: D1Database,
	claims: SignInClaims,
	leadAuthorEmail: string | undefined
): Promise<SignInResult> {
	const returning = await database
		.prepare(`SELECT ${personColumns}, people.status FROM people WHERE sign_in_subject = ?`)
		.bind(claims.subject)
		.first<SignedInPerson & { status: PersonStatus }>();
	if (returning) {
		if (returning.status === 'removed') return { outcome: 'removed' };
		await database
			.prepare('UPDATE people SET last_signed_in_at = ?, status = ? WHERE identifier = ?')
			.bind(now(), 'active', returning.identifier)
			.run();
		const { status: _status, ...person } = returning;
		return { outcome: 'signed-in', person };
	}

	if (!claims.email || !claims.emailVerified) return { outcome: 'email-not-verified' };

	const invited = await database
		.prepare(
			`SELECT ${personColumns}, people.status, people.sign_in_subject AS signInSubject
			 FROM people WHERE email = ?`
		)
		.bind(claims.email)
		.first<SignedInPerson & { status: PersonStatus; signInSubject: string | null }>();
	if (invited) {
		if (invited.status === 'removed') return { outcome: 'removed' };
		// The address already belongs to another Auth0 account, for example one
		// made with a password when the person first used Google.
		if (invited.signInSubject) return { outcome: 'different-account' };
		await database.batch([
			database
				.prepare(
					`UPDATE people SET sign_in_subject = ?, status = 'active', last_signed_in_at = ?
					 WHERE identifier = ?`
				)
				.bind(claims.subject, now(), invited.identifier),
			// Someone who registered before they were invited keeps their profile.
			database
				.prepare(
					`UPDATE contributor_profiles SET person_identifier = ?
					 WHERE sign_in_subject = ? AND person_identifier IS NULL`
				)
				.bind(invited.identifier, claims.subject),
			eventStatement(database, {
				personIdentifier: invited.identifier,
				action: 'Accepted the invitation and signed in for the first time',
				targetKind: 'person',
				targetIdentifier: invited.identifier
			})
		]);
		const { status: _status, signInSubject: _subject, ...person } = invited;
		return { outcome: 'signed-in', person };
	}

	if (
		leadAuthorEmail &&
		claims.email.toLocaleLowerCase('en-US') === leadAuthorEmail.trim().toLocaleLowerCase('en-US')
	) {
		const person: SignedInPerson = {
			identifier: newIdentifier(),
			displayName: claims.name?.trim() || claims.email,
			email: claims.email,
			role: 'lead-author',
			nationIdentifier: null
		};
		const time = now();
		await database.batch([
			database
				.prepare(
					`INSERT INTO people (identifier, sign_in_subject, email, display_name, role, status, added_at, last_signed_in_at)
					 VALUES (?, ?, ?, ?, 'lead-author', 'active', ?, ?)`
				)
				.bind(person.identifier, claims.subject, person.email, person.displayName, time, time),
			eventStatement(database, {
				personIdentifier: person.identifier,
				action: 'Signed in as the lead author named in the site settings',
				targetKind: 'person',
				targetIdentifier: person.identifier
			})
		]);
		return { outcome: 'signed-in', person };
	}

	return { outcome: 'not-on-list' };
}

/** The active person with this Auth0 identifier, if any. Checked on every request. */
export async function activePersonBySubject(
	database: D1Database,
	subject: string
): Promise<SignedInPerson | undefined> {
	const person = await database
		.prepare(`SELECT ${personColumns} FROM people WHERE sign_in_subject = ? AND status = 'active'`)
		.bind(subject)
		.first<SignedInPerson>();
	return person ?? undefined;
}

export async function listPeople(database: D1Database): Promise<PersonRow[]> {
	const result = await database
		.prepare(
			`SELECT ${personColumns}, people.status, people.sign_in_subject IS NOT NULL AS hasSignedIn,
			        people.added_at AS addedAt, people.last_signed_in_at AS lastSignedInAt,
			        adder.display_name AS addedByName
			 FROM people LEFT JOIN people AS adder ON adder.identifier = people.added_by
			 ORDER BY people.status = 'removed', people.display_name COLLATE NOCASE`
		)
		.all<Omit<PersonRow, 'hasSignedIn'> & { hasSignedIn: number }>();
	return result.results.map((row) => ({ ...row, hasSignedIn: Boolean(row.hasSignedIn) }));
}

export async function personByIdentifier(
	database: D1Database,
	identifier: string
): Promise<(SignedInPerson & { status: PersonStatus }) | undefined> {
	const person = await database
		.prepare(`SELECT ${personColumns}, people.status FROM people WHERE identifier = ?`)
		.bind(identifier)
		.first<SignedInPerson & { status: PersonStatus }>();
	return person ?? undefined;
}

export async function personByEmail(
	database: D1Database,
	email: string
): Promise<{ identifier: string; status: PersonStatus } | undefined> {
	const person = await database
		.prepare('SELECT identifier, status FROM people WHERE email = ?')
		.bind(email)
		.first<{ identifier: string; status: PersonStatus }>();
	return person ?? undefined;
}

export interface Invitation {
	email: string;
	displayName: string;
	role: Role;
	nationIdentifier: string | null;
}

export async function invitePerson(
	database: D1Database,
	invitation: Invitation,
	addedBy: SignedInPerson
): Promise<void> {
	const identifier = newIdentifier();
	await database.batch([
		database
			.prepare(
				`INSERT INTO people (identifier, email, display_name, role, nation_identifier, status, added_by, added_at)
				 VALUES (?, ?, ?, ?, ?, 'invited', ?, ?)`
			)
			.bind(
				identifier,
				invitation.email,
				invitation.displayName,
				invitation.role,
				invitation.nationIdentifier,
				addedBy.identifier,
				now()
			),
		eventStatement(database, {
			personIdentifier: addedBy.identifier,
			action: `Invited as ${roleLabels[invitation.role].toLocaleLowerCase('en-US')}`,
			targetKind: 'person',
			targetIdentifier: identifier,
			note: invitation.nationIdentifier ? `For nation ${invitation.nationIdentifier}` : null
		})
	]);
}

export async function changeRole(
	database: D1Database,
	identifier: string,
	role: Role,
	nationIdentifier: string | null,
	changedBy: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare('UPDATE people SET role = ?, nation_identifier = ? WHERE identifier = ?')
			.bind(role, nationIdentifier, identifier),
		eventStatement(database, {
			personIdentifier: changedBy.identifier,
			action: `Role changed to ${roleLabels[role].toLocaleLowerCase('en-US')}`,
			targetKind: 'person',
			targetIdentifier: identifier,
			note: nationIdentifier ? `For nation ${nationIdentifier}` : null
		})
	]);
}

/**
 * Removes a person's access. The row is kept, so their earlier reviews and
 * actions still show who made them. Access ends at once, because every
 * request checks the database, not only the session cookie.
 */
export async function setRemoved(
	database: D1Database,
	identifier: string,
	removed: boolean,
	changedBy: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE people SET status = CASE
				   WHEN ? THEN 'removed'
				   WHEN sign_in_subject IS NULL THEN 'invited'
				   ELSE 'active' END
				 WHERE identifier = ?`
			)
			.bind(removed ? 1 : 0, identifier),
		eventStatement(database, {
			personIdentifier: changedBy.identifier,
			action: removed ? 'Access removed' : 'Access restored',
			targetKind: 'person',
			targetIdentifier: identifier
		})
	]);
}

/** How many active or invited lead authors there are, so the last one is never removed. */
export async function countLeadAuthors(database: D1Database): Promise<number> {
	const row = await database
		.prepare(
			`SELECT COUNT(*) AS count FROM people WHERE role = 'lead-author' AND status != 'removed'`
		)
		.first<{ count: number }>();
	return row?.count ?? 0;
}
