/**
 * Contributor profiles in the database (docs/contributor-profiles.md).
 *
 * Anyone signed in may register and keep a
 * profile. A profile gives no access to the workspace: the lead author
 * decides that separately, by linking the profile to a row in `people`.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types/index.ts';
import {
	creditOf,
	defaultCreditSection,
	type Availability,
	type ContactMethod,
	type CreditForm,
	type CreditSection,
	type Interest,
	type NationAnswer,
	type ProfileAnswers,
	type ProfileStatus
} from '#lib/contributors.ts';
import { roleLabels, type Role } from '#lib/permissions.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';

/**
 * Who is signed in, whether or not they have workspace access. `subject` is
 * the account identifier (src/lib/server/accounts.ts); every account has
 * proved it receives mail at `email`.
 */
export interface SignedInAccount {
	subject: string;
	email: string;
	name: string | null;
}

export interface Profile {
	identifier: string;
	email: string;
	personIdentifier: string | null;
	status: ProfileStatus;
	answers: ProfileAnswers;
	creditSection: CreditSection | null;
	createdAt: string;
	updatedAt: string;
	confirmedVersion: number | null;
	confirmedAt: string | null;
	submittedAt: string | null;
	decidedAt: string | null;
	decisionNote: string | null;
	/** Whether the person changed anything since they last confirmed. */
	hasUnconfirmedChanges: boolean;
}

interface ProfileRow {
	identifier: string;
	email: string;
	person_identifier: string | null;
	status: ProfileStatus;
	given_name: string | null;
	family_name: string | null;
	native_name: string | null;
	phone: string | null;
	preferred_contact: ContactMethod | null;
	thirteen_or_older: number;
	nation_answer: NationAnswer | null;
	background: string | null;
	languages: string | null;
	organization: string | null;
	availability: Availability | null;
	credit_form: CreditForm | null;
	credit_name: string | null;
	credit_role: string | null;
	credit_pseudonym: string | null;
	credit_in_book: number;
	credit_on_website: number;
	biography: string | null;
	biography_in_credits: number;
	credit_section: CreditSection | null;
	created_at: string;
	updated_at: string;
	confirmed_version: number | null;
	confirmed_at: string | null;
	submitted_at: string | null;
	decided_at: string | null;
	decision_note: string | null;
}

async function completeProfile(database: D1Database, row: ProfileRow): Promise<Profile> {
	const [nations, chosen] = await Promise.all([
		database
			.prepare(
				`SELECT nation_identifier AS nationIdentifier, nation_name AS nationName, connection,
				        show_in_credit AS showInCredit
				 FROM contributor_nations WHERE profile_identifier = ? ORDER BY position`
			)
			.bind(row.identifier)
			.all<{ nationIdentifier: string | null; nationName: string; connection: string | null; showInCredit: number }>(),
		database
			.prepare('SELECT interest FROM contributor_interests WHERE profile_identifier = ? ORDER BY interest')
			.bind(row.identifier)
			.all<{ interest: Interest }>()
	]);
	return {
		identifier: row.identifier,
		email: row.email,
		personIdentifier: row.person_identifier,
		status: row.status,
		answers: {
			givenName: row.given_name,
			familyName: row.family_name,
			nativeName: row.native_name,
			phone: row.phone,
			preferredContact: row.preferred_contact,
			thirteenOrOlder: Boolean(row.thirteen_or_older),
			nationAnswer: row.nation_answer,
			nations: nations.results.map((nation) => ({ ...nation, showInCredit: Boolean(nation.showInCredit) })),
			background: row.background,
			languages: row.languages,
			organization: row.organization,
			interests: chosen.results.map((item) => item.interest),
			availability: row.availability,
			creditForm: row.credit_form,
			creditName: row.credit_name,
			creditRole: row.credit_role,
			creditPseudonym: row.credit_pseudonym,
			creditInBook: Boolean(row.credit_in_book),
			creditOnWebsite: Boolean(row.credit_on_website),
			biography: row.biography,
			biographyInCredits: Boolean(row.biography_in_credits)
		},
		creditSection: row.credit_section,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		confirmedVersion: row.confirmed_version,
		confirmedAt: row.confirmed_at,
		submittedAt: row.submitted_at,
		decidedAt: row.decided_at,
		decisionNote: row.decision_note,
		hasUnconfirmedChanges: row.confirmed_at === null || row.updated_at > row.confirmed_at
	};
}

export async function profileBySubject(database: D1Database, subject: string): Promise<Profile | undefined> {
	const row = await database
		.prepare('SELECT * FROM contributor_profiles WHERE sign_in_subject = ?')
		.bind(subject)
		.first<ProfileRow>();
	return row ? completeProfile(database, row) : undefined;
}

export async function profileByIdentifier(database: D1Database, identifier: string): Promise<Profile | undefined> {
	const row = await database
		.prepare('SELECT * FROM contributor_profiles WHERE identifier = ?')
		.bind(identifier)
		.first<ProfileRow>();
	return row ? completeProfile(database, row) : undefined;
}

/** The profile of someone with workspace access, if they have made one. */
export async function profileOfPerson(database: D1Database, personIdentifier: string): Promise<Profile | undefined> {
	const row = await database
		.prepare('SELECT * FROM contributor_profiles WHERE person_identifier = ?')
		.bind(personIdentifier)
		.first<ProfileRow>();
	return row ? completeProfile(database, row) : undefined;
}

function answerStatements(database: D1Database, identifier: string, answers: ProfileAnswers): D1PreparedStatement[] {
	return [
		database.prepare('DELETE FROM contributor_nations WHERE profile_identifier = ?').bind(identifier),
		...answers.nations.map((nation, position) =>
			database
				.prepare(
					`INSERT INTO contributor_nations
					   (identifier, profile_identifier, nation_identifier, nation_name, connection, show_in_credit, position)
					 VALUES (?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					newIdentifier(),
					identifier,
					nation.nationIdentifier,
					nation.nationName,
					nation.connection,
					nation.showInCredit ? 1 : 0,
					position
				)
		),
		database.prepare('DELETE FROM contributor_interests WHERE profile_identifier = ?').bind(identifier),
		...answers.interests.map((interest) =>
			database
				.prepare('INSERT INTO contributor_interests (profile_identifier, interest) VALUES (?, ?)')
				.bind(identifier, interest)
		)
	];
}

/**
 * Saves what the person entered, creating their profile at the first save.
 * Saving never confirms: credits keep using the last confirmed version until
 * the person confirms again on the review page.
 */
export async function saveAnswers(
	database: D1Database,
	account: SignedInAccount,
	answers: ProfileAnswers
): Promise<string> {
	const existing = await database
		.prepare('SELECT identifier FROM contributor_profiles WHERE sign_in_subject = ?')
		.bind(account.subject)
		.first<{ identifier: string }>();
	const identifier = existing?.identifier ?? newIdentifier();
	const time = now();
	const person = await database
		.prepare(`SELECT identifier FROM people WHERE sign_in_subject = ? AND status != 'removed'`)
		.bind(account.subject)
		.first<{ identifier: string }>();

	const values = [
		answers.givenName,
		answers.familyName,
		answers.nativeName,
		answers.phone,
		answers.preferredContact,
		answers.thirteenOrOlder ? 1 : 0,
		answers.nationAnswer,
		answers.background,
		answers.languages,
		answers.organization,
		answers.availability,
		answers.creditForm,
		answers.creditName,
		answers.creditRole,
		answers.creditPseudonym,
		answers.creditInBook ? 1 : 0,
		answers.creditOnWebsite ? 1 : 0,
		answers.biography,
		answers.biographyInCredits ? 1 : 0
	];
	const columns = `given_name, family_name, native_name, phone, preferred_contact, thirteen_or_older, nation_answer,
		background, languages, organization, availability, credit_form, credit_name, credit_role,
		credit_pseudonym, credit_in_book, credit_on_website, biography, biography_in_credits`;

	const write = existing
		? database
				.prepare(
					`UPDATE contributor_profiles SET (${columns}, email, updated_at)
					   = (${values.map(() => '?').join(', ')}, ?, ?)
					 WHERE identifier = ?`
				)
				.bind(...values, account.email, time, identifier)
		: database
				.prepare(
					`INSERT INTO contributor_profiles
					   (identifier, sign_in_subject, email, person_identifier, ${columns}, created_at, updated_at)
					 VALUES (?, ?, ?, ?, ${values.map(() => '?').join(', ')}, ?, ?)`
				)
				.bind(identifier, account.subject, account.email, person?.identifier ?? null, ...values, time, time);

	await database.batch([
		write,
		...answerStatements(database, identifier, answers),
		...(existing
			? []
			: [
					eventStatement(database, {
						personIdentifier: person?.identifier ?? null,
						action: 'Started a contributor profile',
						targetKind: 'profile',
						targetIdentifier: identifier
					})
				])
	]);
	return identifier;
}

/**
 * Records that the person checked their answers and confirmed them: a new
 * version with a copy of everything they saw and the credit line exactly as
 * it was previewed. The first confirmation sends the registration to the
 * lead author.
 */
export async function confirmProfile(database: D1Database, profile: Profile): Promise<number> {
	const version = (profile.confirmedVersion ?? 0) + 1;
	const time = now();
	const credit = creditOf(profile.answers);
	const snapshot = JSON.stringify({ email: profile.email, ...profile.answers });
	const firstSend = profile.status === 'draft';
	await database.batch([
		database
			.prepare(
				`INSERT INTO contributor_profile_versions (profile_identifier, version, snapshot, credit_line, confirmed_at)
				 VALUES (?, ?, ?, ?, ?)`
			)
			.bind(profile.identifier, version, snapshot, credit?.line ?? null, time),
		database
			.prepare(
				`UPDATE contributor_profiles
				 SET confirmed_version = ?, confirmed_at = ?, updated_at = ?,
				     status = CASE WHEN status IN ('draft', 'submitted') THEN 'welcomed' ELSE status END,
				     submitted_at = COALESCE(submitted_at, ?),
				     decided_at = COALESCE(decided_at, ?),
				     credit_section = COALESCE(credit_section, ?)
				 WHERE identifier = ?`
			)
			.bind(version, time, time, time, time, defaultCreditSection(profile.answers.interests), profile.identifier),
		eventStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: firstSend ? 'Confirmed the profile and signed up' : `Confirmed version ${version} of the profile`,
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	return version;
}

/**
 * Deletes a profile and everything in it, at the person's request. The
 * history keeps only that a profile was deleted, without personal details.
 * Workspace access, if any, is not changed: that is the lead author's to end.
 */
export async function deleteProfile(database: D1Database, profile: Profile): Promise<void> {
	await database.batch([
		database.prepare('DELETE FROM contributor_profiles WHERE identifier = ?').bind(profile.identifier),
		eventStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: 'Deleted the contributor profile at the person’s request',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
}

/** How long a declined registration is kept before it is deleted. */
export const declinedRetentionMonths = 12;

/**
 * Deletes registrations declined more than 12 months ago, with everything in
 * them, the same period requests are kept after they are resolved. Runs when
 * the lead author or an editor opens the contributors list, so no scheduled
 * job is needed. Returns how many were deleted.
 */
export async function deleteExpiredDeclinedProfiles(database: D1Database, today: Date = new Date()): Promise<number> {
	const cutoff = new Date(today);
	cutoff.setUTCMonth(cutoff.getUTCMonth() - declinedRetentionMonths);
	const expired = await database
		.prepare(`SELECT identifier FROM contributor_profiles WHERE status = 'declined' AND decided_at < ?`)
		.bind(cutoff.toISOString())
		.all<{ identifier: string }>();
	if (expired.results.length === 0) return 0;
	await database.batch(
		expired.results.flatMap(({ identifier }) => [
			database.prepare('DELETE FROM contributor_profiles WHERE identifier = ?').bind(identifier),
			eventStatement(database, {
				personIdentifier: null,
				action: `Deleted ${declinedRetentionMonths} months after the registration was declined`,
				targetKind: 'profile',
				targetIdentifier: identifier
			})
		])
	);
	return expired.results.length;
}

export interface ConfirmedVersion {
	version: number;
	creditLine: string | null;
	confirmedAt: string;
	answers: ProfileAnswers & { email: string };
}

export async function profileVersions(database: D1Database, identifier: string): Promise<ConfirmedVersion[]> {
	const result = await database
		.prepare(
			`SELECT version, credit_line AS creditLine, confirmed_at AS confirmedAt, snapshot
			 FROM contributor_profile_versions WHERE profile_identifier = ? ORDER BY version DESC`
		)
		.bind(identifier)
		.all<{ version: number; creditLine: string | null; confirmedAt: string; snapshot: string }>();
	return result.results.map(({ snapshot, ...version }) => ({ ...version, answers: JSON.parse(snapshot) }));
}

export interface ProfileListing {
	identifier: string;
	name: string;
	status: ProfileStatus;
	interests: Interest[];
	nations: string[];
	submittedAt: string | null;
	updatedAt: string;
	hasWorkspaceAccess: boolean;
	creditSection: CreditSection | null;
	/** The credit from the latest confirmed version, as it will be printed. */
	confirmedCreditLine: string | null;
}

/** Every profile that has been sent to the project, newest first. Drafts stay private to their author. */
export async function listProfiles(database: D1Database): Promise<ProfileListing[]> {
	const rows = await database
		.prepare(
			`SELECT profiles.identifier, profiles.given_name AS givenName, profiles.family_name AS familyName,
			        profiles.status, profiles.submitted_at AS submittedAt, profiles.updated_at AS updatedAt,
			        profiles.person_identifier IS NOT NULL AS hasWorkspaceAccess,
			        profiles.credit_section AS creditSection, versions.credit_line AS confirmedCreditLine,
			        (SELECT group_concat(interest, ' ') FROM contributor_interests
			           WHERE profile_identifier = profiles.identifier) AS interests,
			        (SELECT group_concat(nation_name, '; ') FROM contributor_nations
			           WHERE profile_identifier = profiles.identifier) AS nations
			 FROM contributor_profiles AS profiles
			 LEFT JOIN contributor_profile_versions AS versions
			   ON versions.profile_identifier = profiles.identifier AND versions.version = profiles.confirmed_version
			 WHERE profiles.status != 'draft'
			 ORDER BY profiles.status = 'submitted' DESC, profiles.submitted_at DESC`
		)
		.all<{
			identifier: string;
			givenName: string | null;
			familyName: string | null;
			status: ProfileStatus;
			submittedAt: string | null;
			updatedAt: string;
			hasWorkspaceAccess: number;
			creditSection: CreditSection | null;
			confirmedCreditLine: string | null;
			interests: string | null;
			nations: string | null;
		}>();
	return rows.results.map((row) => ({
		identifier: row.identifier,
		name: [row.givenName, row.familyName].filter(Boolean).join(' ') || '(no name given)',
		status: row.status,
		interests: (row.interests?.split(' ') ?? []) as Interest[],
		nations: row.nations?.split('; ') ?? [],
		submittedAt: row.submittedAt,
		updatedAt: row.updatedAt,
		hasWorkspaceAccess: Boolean(row.hasWorkspaceAccess),
		creditSection: row.creditSection,
		confirmedCreditLine: row.confirmedCreditLine
	}));
}

export interface CreditEntry {
	section: CreditSection;
	line: string;
	sortKey: string;
	biography: string | null;
	inBook: boolean;
	onWebsite: boolean;
}

/**
 * The credits as they would be printed today: welcomed people with a
 * credit section, from the version each person last confirmed, sorted by
 * family name. Unconfirmed edits are never used.
 */
export async function confirmedCredits(database: D1Database): Promise<CreditEntry[]> {
	const rows = await database
		.prepare(
			`SELECT profiles.credit_section AS section, versions.snapshot
			 FROM contributor_profiles AS profiles
			 JOIN contributor_profile_versions AS versions
			   ON versions.profile_identifier = profiles.identifier AND versions.version = profiles.confirmed_version
			 WHERE profiles.status = 'welcomed' AND profiles.credit_section IS NOT NULL`
		)
		.all<{ section: CreditSection; snapshot: string }>();
	const entries: CreditEntry[] = [];
	for (const row of rows.results) {
		const credit = creditOf(JSON.parse(row.snapshot) as ProfileAnswers);
		if (credit) entries.push({ section: row.section, ...credit });
	}
	return entries.sort((first, second) => first.sortKey.localeCompare(second.sortKey, 'en-US'));
}

export type Decision = 'welcomed' | 'declined';

/** The lead author welcomes or declines a registration, with a note for the person. */
export async function decideProfile(
	database: D1Database,
	profile: Profile,
	decision: Decision,
	note: string | null,
	decidedBy: SignedInPerson
): Promise<void> {
	const time = now();
	await database.batch([
		database
			.prepare(
				`UPDATE contributor_profiles SET status = ?, decided_at = ?, decided_by = ?, decision_note = ?
				 WHERE identifier = ?`
			)
			.bind(decision, time, decidedBy.identifier, note, profile.identifier),
		eventStatement(database, {
			personIdentifier: decidedBy.identifier,
			action: decision === 'welcomed' ? 'Welcomed the contributor' : 'Declined the registration',
			targetKind: 'profile',
			targetIdentifier: profile.identifier,
			note
		})
	]);
}

export async function setCreditSection(
	database: D1Database,
	profile: Profile,
	section: CreditSection | null,
	changedBy: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare('UPDATE contributor_profiles SET credit_section = ? WHERE identifier = ?')
			.bind(section, profile.identifier),
		eventStatement(database, {
			personIdentifier: changedBy.identifier,
			action: section ? `Credit placed in ${section}` : 'Credit section cleared',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
}

/**
 * Gives a registered contributor access to the workspace. Their email address
 * was confirmed when they first signed in, so the person is added as
 * already signed in, linked to the same account, and access starts at once.
 */
export async function giveWorkspaceAccess(
	database: D1Database,
	profile: Profile,
	subject: { role: Role; nationIdentifier: string | null; displayName: string },
	givenBy: SignedInPerson
): Promise<'given' | 'email-in-use'> {
	const taken = await database
		.prepare('SELECT identifier FROM people WHERE email = ?')
		.bind(profile.email)
		.first<{ identifier: string }>();
	if (taken) return 'email-in-use';
	const owner = await database
		.prepare('SELECT sign_in_subject AS subject FROM contributor_profiles WHERE identifier = ?')
		.bind(profile.identifier)
		.first<{ subject: string }>();
	if (!owner) return 'email-in-use';
	const identifier = newIdentifier();
	const time = now();
	await database.batch([
		database
			.prepare(
				`INSERT INTO people (identifier, sign_in_subject, email, display_name, role, nation_identifier, status, added_by, added_at)
				 VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
			)
			.bind(
				identifier,
				owner.subject,
				profile.email,
				subject.displayName,
				subject.role,
				subject.nationIdentifier,
				givenBy.identifier,
				time
			),
		database
			.prepare('UPDATE contributor_profiles SET person_identifier = ? WHERE identifier = ?')
			.bind(identifier, profile.identifier),
		eventStatement(database, {
			personIdentifier: givenBy.identifier,
			action: `Given workspace access as ${roleLabels[subject.role].toLocaleLowerCase('en-US')}, from a contributor profile`,
			targetKind: 'person',
			targetIdentifier: identifier,
			note: subject.nationIdentifier ? `For nation ${subject.nationIdentifier}` : null
		}),
		eventStatement(database, {
			personIdentifier: givenBy.identifier,
			action: `Given workspace access as ${roleLabels[subject.role].toLocaleLowerCase('en-US')}`,
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	return 'given';
}
