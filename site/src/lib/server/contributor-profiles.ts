/**
 * Contributor profiles in the database (docs/contributor-profiles.md).
 *
 * Anyone signed in may register and keep a
 * profile. A profile gives no access to the workspace: the lead author
 * decides that separately, by linking the profile to a row in `people`.
 */
import type { D1Database, D1PreparedStatement, R2Bucket } from '@cloudflare/workers-types/index.ts';
import {
	ageGroupOf,
	answersFromSnapshot,
	creditOf,
	creditsOf,
	defaultCreditSection,
	emptyPlacements,
	pageNameOf,
	placedAnswers,
	pronounChoices,
	slugOf,
	type AgeGroup,
	type Availability,
	type CreditSection,
	type Interest,
	type NameKind,
	type NationAnswer,
	type NationRelationship,
	type PlacedAnswer,
	type ProfileAnswers,
	type ProfileStatus,
	type PronounChoice,
	type Specialty
} from '#lib/contributors.ts';
import { roleLabels, type Role } from '#lib/permissions.ts';
import { activityStatement } from './activity-log.ts';
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
	/** The address of the person's public page, /contributors/<slug>, when they have one. */
	publicSlug: string | null;
	/** The person's picture in the private bucket. */
	pictureKey: string | null;
	pictureUpdatedAt: string | null;
	/** The person's CV or resume in the private bucket, with the file name they sent. Never published. */
	curriculumVitaeKey: string | null;
	curriculumVitaeName: string | null;
	curriculumVitaeUpdatedAt: string | null;
	/** On the nonprofit's board, as the lead author marks it; shown first on the People page. */
	boardMember: boolean;
	/** The board office, such as President, once the lead author sets it. */
	boardOffice: string | null;
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
	pronoun_other: string | null;
	birth_year: number | null;
	birthday_answer: 'yes' | 'no' | null;
	birthday_answer_year: number | null;
	age_group: AgeGroup | null;
	nation_answer: NationAnswer | null;
	background: string | null;
	organization: string | null;
	availability: Availability | null;
	description: string | null;
	biography: string | null;
	credit_section: CreditSection | null;
	created_at: string;
	updated_at: string;
	confirmed_version: number | null;
	confirmed_at: string | null;
	submitted_at: string | null;
	decided_at: string | null;
	decision_note: string | null;
	public_slug: string | null;
	picture_key: string | null;
	picture_updated_at: string | null;
	curriculum_vitae_key: string | null;
	curriculum_vitae_name: string | null;
	curriculum_vitae_updated_at: string | null;
	board_member: number;
	board_office: string | null;
}

/** The current year in UTC, which birth years are measured against. */
export function currentYear(today: Date = new Date()): number {
	return today.getUTCFullYear();
}

async function completeProfile(database: D1Database, row: ProfileRow): Promise<Profile> {
	const id = row.identifier;
	const all = <T>(sql: string) => database.prepare(sql).bind(id).all<T>();
	const [names, pronouns, contacts, nations, relationships, languages, chosenSpecialties, placements, chosen] = await Promise.all([
		all<{ name: string; kind: NameKind; book: number; website: number }>(
			'SELECT name, kind, in_book AS book, on_website AS website FROM contributor_names WHERE profile_identifier = ? ORDER BY position'
		),
		all<{ pronoun: PronounChoice }>('SELECT pronoun FROM contributor_pronouns WHERE profile_identifier = ?'),
		all<{ kind: 'email' | 'phone'; value: string; country: string | null; signIn: number; mayEmail: number; mayCall: number; mayText: number; preferred: number }>(
			`SELECT kind, value, country, sign_in AS signIn, may_email AS mayEmail, may_call AS mayCall, may_text AS mayText, preferred
			 FROM contributor_contacts WHERE profile_identifier = ? ORDER BY position`
		),
		all<{ identifier: string; nationIdentifier: string | null; nationName: string; relationshipOther: string | null; book: number; website: number }>(
			`SELECT identifier, nation_identifier AS nationIdentifier, nation_name AS nationName, relationship_other AS relationshipOther,
			        in_book AS book, on_website AS website
			 FROM contributor_nations WHERE profile_identifier = ? ORDER BY position`
		),
		all<{ nation: string; relationship: NationRelationship }>(
			`SELECT relationships.nation_row_identifier AS nation, relationships.relationship
			 FROM contributor_nation_relationships AS relationships
			 JOIN contributor_nations AS nations ON nations.identifier = relationships.nation_row_identifier
			 WHERE nations.profile_identifier = ?`
		),
		all<{ code: string | null; otherName: string | null; speaks: number; reads: number; writes: number; website: number }>(
			`SELECT language_code AS code, other_name AS otherName, speaks, reads, writes, on_website AS website
			 FROM contributor_languages WHERE profile_identifier = ? ORDER BY position`
		),
		all<{ specialty: Specialty | null; otherName: string | null }>(
			'SELECT specialty, other_name AS otherName FROM contributor_specialties WHERE profile_identifier = ? ORDER BY position'
		),
		all<{ item: PlacedAnswer; book: number; website: number }>(
			'SELECT item, in_book AS book, on_website AS website FROM contributor_placements WHERE profile_identifier = ?'
		),
		all<{ interest: Interest }>('SELECT interest FROM contributor_interests WHERE profile_identifier = ? ORDER BY interest')
	]);
	const placed = emptyPlacements();
	for (const placement of placements.results) placed[placement.item] = { book: Boolean(placement.book), website: Boolean(placement.website) };
	const answers: ProfileAnswers = {
		givenName: row.given_name,
		familyName: row.family_name,
		names: names.results.map((name) => ({ name: name.name, kind: name.kind, book: Boolean(name.book), website: Boolean(name.website) })),
		pronouns: pronounChoices.filter((choice) => pronouns.results.some((item) => item.pronoun === choice)),
		pronounOther: row.pronoun_other,
		birthYear: row.birth_year,
		birthdayAnswer: row.birthday_answer,
		birthdayAnswerYear: row.birthday_answer_year,
		ageGroup: null,
		// The sign-in row always shows the address the person signs in with now.
		contacts: contacts.results.map((contact) => ({
			kind: contact.kind,
			value: contact.signIn ? row.email : contact.value,
			country: contact.country,
			signIn: Boolean(contact.signIn),
			mayEmail: Boolean(contact.mayEmail),
			mayCall: Boolean(contact.mayCall),
			mayText: Boolean(contact.mayText),
			preferred: Boolean(contact.preferred)
		})),
		nationAnswer: row.nation_answer,
		nations: nations.results.map((nation) => ({
			nationIdentifier: nation.nationIdentifier,
			nationName: nation.nationName,
			relationships: relationships.results.filter((item) => item.nation === nation.identifier).map((item) => item.relationship),
			relationshipOther: nation.relationshipOther,
			book: Boolean(nation.book),
			website: Boolean(nation.website)
		})),
		background: row.background,
		languages: languages.results.map((language) => ({
			code: language.code,
			otherName: language.otherName,
			speaks: Boolean(language.speaks),
			reads: Boolean(language.reads),
			writes: Boolean(language.writes),
			website: Boolean(language.website)
		})),
		organization: row.organization,
		interests: chosen.results.map((item) => item.interest),
		specialties: chosenSpecialties.results.flatMap((item) => (item.specialty ? [item.specialty] : [])),
		specialtyOthers: chosenSpecialties.results.flatMap((item) => (item.otherName ? [item.otherName] : [])),
		availability: row.availability,
		description: row.description,
		biography: row.biography,
		placements: placed
	};
	// Someone who answered before birth years were asked keeps the age group they chose until they give a year.
	const age = row.birth_year === null ? row.age_group : ageGroupOf(answers, currentYear());
	answers.ageGroup = age === 'under-13' ? null : age;
	return {
		identifier: row.identifier,
		email: row.email,
		personIdentifier: row.person_identifier,
		status: row.status,
		answers,
		creditSection: row.credit_section,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		confirmedVersion: row.confirmed_version,
		confirmedAt: row.confirmed_at,
		submittedAt: row.submitted_at,
		decidedAt: row.decided_at,
		decisionNote: row.decision_note,
		publicSlug: row.public_slug,
		pictureKey: row.picture_key,
		pictureUpdatedAt: row.picture_updated_at,
		curriculumVitaeKey: row.curriculum_vitae_key,
		curriculumVitaeName: row.curriculum_vitae_name,
		curriculumVitaeUpdatedAt: row.curriculum_vitae_updated_at,
		boardMember: Boolean(row.board_member),
		boardOffice: row.board_office,
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

/** Rewrites every repeatable answer of a profile: each kind in its own table, one row per entry. */
function answerStatements(database: D1Database, identifier: string, answers: ProfileAnswers, email: string): D1PreparedStatement[] {
	const statement = (sql: string, ...values: unknown[]) => database.prepare(sql).bind(...values);
	const flag = (value: boolean) => (value ? 1 : 0);
	const tables = ['contributor_names', 'contributor_pronouns', 'contributor_contacts', 'contributor_nations', 'contributor_languages', 'contributor_specialties', 'contributor_placements', 'contributor_interests'];
	const contacts = answers.contacts.some((contact) => contact.signIn)
		? answers.contacts
		: [{ kind: 'email' as const, value: email, country: null, signIn: true, mayEmail: true, mayCall: false, mayText: false, preferred: !answers.contacts.some((contact) => contact.preferred) }, ...answers.contacts];
	return [
		// Removing a nation row removes its relationships too (ON DELETE CASCADE).
		...tables.map((table) => statement(`DELETE FROM ${table} WHERE profile_identifier = ?`, identifier)),
		...answers.names.map((name, position) =>
			statement(
				'INSERT INTO contributor_names (identifier, profile_identifier, position, name, kind, in_book, on_website) VALUES (?, ?, ?, ?, ?, ?, ?)',
				newIdentifier(), identifier, position, name.name, name.kind, flag(name.book), flag(name.website)
			)
		),
		...answers.pronouns.map((pronoun) => statement('INSERT INTO contributor_pronouns (profile_identifier, pronoun) VALUES (?, ?)', identifier, pronoun)),
		...contacts.map((contact, position) =>
			statement(
				`INSERT INTO contributor_contacts (identifier, profile_identifier, position, kind, value, country, sign_in, may_email, may_call, may_text, preferred)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				newIdentifier(), identifier, position, contact.kind, contact.signIn ? email : contact.value, contact.country,
				flag(contact.signIn), flag(contact.mayEmail), flag(contact.mayCall), flag(contact.mayText), flag(contact.preferred)
			)
		),
		...answers.nations.flatMap((nation, position) => {
			const row = newIdentifier();
			return [
				statement(
					`INSERT INTO contributor_nations (identifier, profile_identifier, nation_identifier, nation_name, relationship_other, in_book, on_website, show_in_credit, position)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					row, identifier, nation.nationIdentifier, nation.nationName, nation.relationshipOther, flag(nation.book), flag(nation.website),
					flag(nation.book || nation.website), position
				),
				...nation.relationships.map((relationship) =>
					statement('INSERT INTO contributor_nation_relationships (nation_row_identifier, relationship) VALUES (?, ?)', row, relationship)
				)
			];
		}),
		...answers.languages.map((language, position) =>
			statement(
				`INSERT INTO contributor_languages (identifier, profile_identifier, position, language_code, other_name, speaks, reads, writes, on_website)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				newIdentifier(), identifier, position, language.code, language.otherName, flag(language.speaks), flag(language.reads),
				flag(language.writes), flag(language.website)
			)
		),
		...[...answers.specialties.map((specialty) => ({ specialty, otherName: null })), ...answers.specialtyOthers.map((otherName) => ({ specialty: null, otherName }))].map(
			(item, position) =>
				statement(
					'INSERT INTO contributor_specialties (identifier, profile_identifier, position, specialty, other_name) VALUES (?, ?, ?, ?, ?)',
					newIdentifier(), identifier, position, item.specialty, item.otherName
				)
		),
		...placedAnswers
			.filter((item) => answers.placements[item]?.book || answers.placements[item]?.website)
			.map((item) =>
				statement(
					'INSERT INTO contributor_placements (profile_identifier, item, in_book, on_website) VALUES (?, ?, ?, ?)',
					identifier, item, flag(answers.placements[item].book), flag(answers.placements[item].website)
				)
			),
		...answers.interests.map((interest) =>
			statement('INSERT INTO contributor_interests (profile_identifier, interest) VALUES (?, ?)', identifier, interest)
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

	const age = ageGroupOf(answers, currentYear());
	const values = [
		answers.givenName,
		answers.familyName,
		answers.pronounOther,
		answers.birthYear,
		answers.birthdayAnswer,
		answers.birthdayAnswerYear,
		age === '13-to-17' || age === '18-or-older' ? 1 : 0,
		age === '13-to-17' || age === '18-or-older' ? age : null,
		answers.nationAnswer,
		answers.background,
		answers.organization,
		answers.availability,
		answers.description,
		answers.biography
	];
	const columns = `given_name, family_name, pronoun_other, birth_year, birthday_answer, birthday_answer_year, thirteen_or_older, age_group,
		nation_answer, background, organization, availability, description, biography`;

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
		...answerStatements(database, identifier, answers, account.email),
		...(existing
			? []
			: [
					activityStatement(database, {
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
	const slug = await freeSlug(database, profile.identifier, pageNameOf(profile.answers));
	// The snapshot keeps the age group worked out today, so a credit confirmed by someone under 18 stays as it was until they confirm again.
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
				     credit_section = COALESCE(credit_section, ?),
				     public_slug = ?
				 WHERE identifier = ?`
			)
			.bind(version, time, time, time, time, defaultCreditSection(profile.answers.interests), slug, profile.identifier),
		activityStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: firstSend ? 'Confirmed the profile and signed up' : `Confirmed version ${version} of the profile`,
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	return version;
}

/** The page address for a name, made unique among other people's pages with -2, -3 and so on. */
async function freeSlug(database: D1Database, profileIdentifier: string, name: string | null): Promise<string | null> {
	if (!name) return null;
	// A name with no Latin letters or digits, such as one in Cherokee syllabary, gets a neutral address.
	const base = slugOf(name) || `contributor-${profileIdentifier.slice(0, 8)}`;
	const taken = await database
		.prepare(`SELECT public_slug AS slug FROM contributor_profiles WHERE identifier != ? AND (public_slug = ? OR public_slug LIKE ?)`)
		.bind(profileIdentifier, base, `${base}-%`)
		.all<{ slug: string }>();
	const used = new Set(taken.results.map((row) => row.slug));
	if (!used.has(base)) return base;
	for (let number = 2; ; number++) if (!used.has(`${base}-${number}`)) return `${base}-${number}`;
}

/**
 * Deletes a profile and everything in it, at the person's request. The
 * history keeps only that a profile was deleted, without personal details.
 * Workspace access, if any, is not changed: that is the lead author's to end.
 */
export async function deleteProfile(database: D1Database, profile: Profile, bucket?: R2Bucket): Promise<void> {
	await database.batch([
		database.prepare('DELETE FROM contributor_profiles WHERE identifier = ?').bind(profile.identifier),
		activityStatement(database, {
			personIdentifier: profile.personIdentifier,
			action: 'Deleted the contributor profile at the person’s request',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	const files = [profile.pictureKey, profile.curriculumVitaeKey].filter((key): key is string => Boolean(key));
	if (bucket && files.length > 0) await bucket.delete(files);
}

/** How long a declined registration is kept before it is deleted. */
export const declinedRetentionMonths = 12;

/**
 * Deletes registrations declined more than 12 months ago, with everything in
 * them, the same period requests are kept after they are resolved. Runs when
 * the lead author or an editor opens the contributors list, so no scheduled
 * job is needed. Returns how many were deleted.
 */
export async function deleteExpiredDeclinedProfiles(
	database: D1Database,
	today: Date = new Date(),
	bucket?: R2Bucket
): Promise<number> {
	const cutoff = new Date(today);
	cutoff.setUTCMonth(cutoff.getUTCMonth() - declinedRetentionMonths);
	const expired = await database
		.prepare(
			`SELECT identifier, picture_key AS pictureKey, curriculum_vitae_key AS curriculumVitaeKey
			 FROM contributor_profiles WHERE status = 'declined' AND decided_at < ?`
		)
		.bind(cutoff.toISOString())
		.all<{ identifier: string; pictureKey: string | null; curriculumVitaeKey: string | null }>();
	if (expired.results.length === 0) return 0;
	await database.batch(
		expired.results.flatMap(({ identifier }) => [
			database.prepare('DELETE FROM contributor_profiles WHERE identifier = ?').bind(identifier),
			activityStatement(database, {
				personIdentifier: null,
				action: `Deleted ${declinedRetentionMonths} months after the registration was declined`,
				targetKind: 'profile',
				targetIdentifier: identifier
			})
		])
	);
	const pictures = expired.results.flatMap((profile) => [profile.pictureKey, profile.curriculumVitaeKey].filter((key): key is string => Boolean(key)));
	if (bucket && pictures.length > 0) await bucket.delete(pictures);
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
	return result.results.map(({ snapshot, ...version }) => ({ ...version, answers: { email: (JSON.parse(snapshot) as { email: string }).email, ...answersFromSnapshot(snapshot) } }));
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
	/** The person's page, /contributors/<slug>, when they have one. */
	slug: string | null;
}

/**
 * The credits as they would be printed today: welcomed people with a
 * credit section, from the version each person last confirmed, sorted by
 * family name. Unconfirmed edits are never used.
 */
export async function confirmedCredits(database: D1Database): Promise<CreditEntry[]> {
	const rows = await database
		.prepare(
			`SELECT profiles.credit_section AS section, profiles.public_slug AS slug, versions.snapshot
			 FROM contributor_profiles AS profiles
			 JOIN contributor_profile_versions AS versions
			   ON versions.profile_identifier = profiles.identifier AND versions.version = profiles.confirmed_version
			 WHERE profiles.status = 'welcomed' AND profiles.credit_section IS NOT NULL`
		)
		.all<{ section: CreditSection; slug: string | null; snapshot: string }>();
	const entries: CreditEntry[] = [];
	for (const row of rows.results) {
		const answers = answersFromSnapshot(row.snapshot);
		// One entry when the book and the website read the same, otherwise one for each.
		for (const credit of creditsOf(answers)) entries.push({ section: row.section, ...credit, slug: credit.onWebsite && pageNameOf(answers) ? row.slug : null });
	}
	// Credits of people who deleted their account and chose to keep their name (src/lib/server/account-deletion.ts).
	const retained = await database
		.prepare(
			`SELECT section, line, sort_key AS sortKey, biography, in_book AS inBook, on_website AS onWebsite
			 FROM retained_credits`
		)
		.all<{ section: CreditSection; line: string; sortKey: string; biography: string | null; inBook: number; onWebsite: number }>();
	for (const row of retained.results) {
		// Their page went with their account.
		entries.push({ ...row, inBook: Boolean(row.inBook), onWebsite: Boolean(row.onWebsite), slug: null });
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
		activityStatement(database, {
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
		activityStatement(database, {
			personIdentifier: changedBy.identifier,
			action: section ? `Credit placed in ${section}` : 'Credit section cleared',
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
}

/** Marks the person as on the nonprofit's board or not, with their office if set. Lead author only. */
export async function setBoardMembership(
	database: D1Database,
	profile: Profile,
	member: boolean,
	office: string | null,
	changedBy: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare('UPDATE contributor_profiles SET board_member = ?, board_office = ? WHERE identifier = ?')
			.bind(member ? 1 : 0, member ? office : null, profile.identifier),
		activityStatement(database, {
			personIdentifier: changedBy.identifier,
			action: member ? `Marked as a board member${office ? ` (${office})` : ''}` : 'Marked as not on the board',
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
		activityStatement(database, {
			personIdentifier: givenBy.identifier,
			action: `Given workspace access as ${roleLabels[subject.role].toLocaleLowerCase('en-US')}, from a contributor profile`,
			targetKind: 'person',
			targetIdentifier: identifier,
			note: subject.nationIdentifier ? `For nation ${subject.nationIdentifier}` : null
		}),
		activityStatement(database, {
			personIdentifier: givenBy.identifier,
			action: `Given workspace access as ${roleLabels[subject.role].toLocaleLowerCase('en-US')}`,
			targetKind: 'profile',
			targetIdentifier: profile.identifier
		})
	]);
	return 'given';
}
