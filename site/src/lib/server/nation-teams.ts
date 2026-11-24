/**
 * Nation teams in the database (decision record 0041; site/COLLABORATION.md,
 * "Nation teams"): who is on each nation's team, requests to join one, and
 * the records of every change in the activity log. The rules themselves are
 * in src/lib/nation-teams.ts; every function here that changes a team is
 * only called after the page has checked them.
 */
import type { D1Database, D1PreparedStatement, R2Bucket } from '@cloudflare/workers-types/index.ts';
import {
	applicationStatusLabels,
	describeParts,
	readParts,
	teamLevelLabels,
	teamLogTarget,
	writeParts,
	type ApplicationStatus,
	type Granter,
	type PagePart,
	type ProofRoute,
	type TeamLevel
} from '#lib/nation-teams.ts';
import { isAdministrator } from '#lib/permissions.ts';
import { eventStatement, eventsFor, type EventRow } from './events.ts';
import { forgetScan, storeSentFile } from './file-scans.ts';
import { newIdentifier, newRequestReference, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';
import type { UploadedFile } from './request-form.ts';

export interface PlaceRow {
	identifier: string;
	nationIdentifier: string;
	personIdentifier: string;
	personName: string;
	personEmail: string;
	personStatus: 'invited' | 'active' | 'removed';
	level: TeamLevel;
	parts: PagePart[] | null;
	office: string | null;
	basis: string | null;
	addedByProject: boolean;
	expiresAt: string;
	grantedBy: string;
	grantedByName: string | null;
	grantedAt: string;
}

interface StoredPlace extends Omit<PlaceRow, 'parts' | 'addedByProject'> {
	pageParts: string | null;
	addedByProject: number;
}

const placeColumns = `nation_team_members.identifier, nation_team_members.nation_identifier AS nationIdentifier,
	nation_team_members.person_identifier AS personIdentifier, people.display_name AS personName,
	people.email AS personEmail, people.status AS personStatus, nation_team_members.level,
	nation_team_members.page_parts AS pageParts, nation_team_members.office, nation_team_members.basis,
	nation_team_members.added_by_project AS addedByProject, nation_team_members.expires_at AS expiresAt,
	nation_team_members.granted_by AS grantedBy, granter.display_name AS grantedByName,
	nation_team_members.granted_at AS grantedAt`;

const placeTables = `nation_team_members
	JOIN people ON people.identifier = nation_team_members.person_identifier
	LEFT JOIN people AS granter ON granter.identifier = nation_team_members.granted_by`;

function fromStored(row: StoredPlace): PlaceRow {
	const { pageParts, addedByProject, ...rest } = row;
	return { ...rest, parts: readParts(pageParts), addedByProject: Boolean(addedByProject) };
}

/** Current places only: not ended and not past their end date. */
const current = `nation_team_members.ended_at IS NULL AND nation_team_members.expires_at > ?`;

/** Everyone currently on a nation's team, highest level first. */
export async function teamOf(database: D1Database, nationIdentifier: string, time = now()): Promise<PlaceRow[]> {
	const result = await database
		.prepare(
			`SELECT ${placeColumns} FROM ${placeTables}
			 WHERE nation_team_members.nation_identifier = ? AND ${current} AND people.status != 'removed'
			 ORDER BY CASE nation_team_members.level WHEN 'steward' THEN 0 WHEN 'editor' THEN 1
			          WHEN 'drafter' THEN 2 ELSE 3 END, people.display_name COLLATE NOCASE`
		)
		.bind(nationIdentifier, time)
		.all<StoredPlace>();
	return result.results.map(fromStored);
}

/** Everyone currently on each of several nations' teams, read in one query: each nation's team in the order teamOf gives it. */
export async function teamsOf(database: D1Database, nationIdentifiers: readonly string[], time = now()): Promise<Map<string, PlaceRow[]>> {
	const teams = new Map<string, PlaceRow[]>(nationIdentifiers.map((nationIdentifier) => [nationIdentifier, []]));
	if (nationIdentifiers.length === 0) return teams;
	const result = await database
		.prepare(
			`SELECT ${placeColumns} FROM ${placeTables}
			 WHERE nation_team_members.nation_identifier IN (SELECT value FROM json_each(?)) AND ${current} AND people.status != 'removed'
			 ORDER BY CASE nation_team_members.level WHEN 'steward' THEN 0 WHEN 'editor' THEN 1
			          WHEN 'drafter' THEN 2 ELSE 3 END, people.display_name COLLATE NOCASE`
		)
		.bind(JSON.stringify(nationIdentifiers), time)
		.all<StoredPlace>();
	for (const row of result.results) teams.get(row.nationIdentifier)?.push(fromStored(row));
	return teams;
}

/** Every current place on every nation's team, for the project's overview. */
export async function allPlaces(database: D1Database, time = now()): Promise<PlaceRow[]> {
	const result = await database
		.prepare(
			`SELECT ${placeColumns} FROM ${placeTables}
			 WHERE ${current} AND people.status != 'removed'
			 ORDER BY nation_team_members.nation_identifier, people.display_name COLLATE NOCASE`
		)
		.bind(time)
		.all<StoredPlace>();
	return result.results.map(fromStored);
}

/** A person's current places, on every nation's team they are on. */
export async function placesOf(database: D1Database, personIdentifier: string, time = now()): Promise<PlaceRow[]> {
	const result = await database
		.prepare(
			`SELECT ${placeColumns} FROM ${placeTables}
			 WHERE nation_team_members.person_identifier = ? AND ${current}
			 ORDER BY nation_team_members.nation_identifier`
		)
		.bind(personIdentifier, time)
		.all<StoredPlace>();
	return result.results.map(fromStored);
}

/** One current place, by its identifier. */
export async function placeByIdentifier(
	database: D1Database,
	identifier: string,
	time = now()
): Promise<PlaceRow | undefined> {
	const row = await database
		.prepare(`SELECT ${placeColumns} FROM ${placeTables} WHERE nation_team_members.identifier = ? AND ${current}`)
		.bind(identifier, time)
		.first<StoredPlace>();
	return row ? fromStored(row) : undefined;
}

/** What a signed-in person holds on one nation's team, for the rules in src/lib/nation-teams.ts. */
export async function granterOn(
	database: D1Database,
	person: SignedInPerson,
	nationIdentifier: string
): Promise<Granter & { personIdentifier: string }> {
	if (isAdministrator(person)) return { isAdministrator: true, personIdentifier: person.identifier };
	const place = (await placesOf(database, person.identifier)).find(
		(found) => found.nationIdentifier === nationIdentifier
	);
	return {
		isAdministrator: false,
		personIdentifier: person.identifier,
		level: place?.level,
		parts: place ? place.parts : undefined
	};
}

export interface NewPlace {
	nationIdentifier: string;
	email: string;
	displayName: string;
	level: TeamLevel;
	parts: readonly PagePart[] | null;
	office: string | null;
	expiresAt: string;
	/** For a place the project confirmed with the nation's office. */
	basis: string | null;
	addedByProject: boolean;
}

export type AddPlaceResult =
	| { outcome: 'added'; personIdentifier: string; placeIdentifier: string; invited: boolean }
	| { outcome: 'removed-person' };

/**
 * Gives someone a place on a nation's team, replacing any place they had on
 * that team. Someone new to the project gets a person record limited to this
 * nation (role "nation-reviewer"); if they already have an account, it is
 * linked at once, otherwise when they first sign in with this address.
 * Someone already in the project keeps their role; the place adds to it.
 */
export async function addPlace(
	database: D1Database,
	place: NewPlace,
	grantedBy: SignedInPerson
): Promise<AddPlaceResult> {
	const time = now();
	const email = place.email.trim();
	const existing = await database
		.prepare('SELECT identifier, status FROM people WHERE email = ? COLLATE NOCASE')
		.bind(email)
		.first<{ identifier: string; status: string }>();
	if (existing?.status === 'removed') return { outcome: 'removed-person' };

	const statements: D1PreparedStatement[] = [];
	let personIdentifier = existing?.identifier;
	let invited = false;
	if (!personIdentifier) {
		personIdentifier = newIdentifier();
		const account = await database
			.prepare('SELECT identifier FROM accounts WHERE email = ? COLLATE NOCASE')
			.bind(email)
			.first<{ identifier: string }>();
		invited = !account;
		statements.push(
			database
				.prepare(
					`INSERT INTO people (identifier, sign_in_subject, email, display_name, role, nation_identifier, status,
					   added_by, added_at)
					 VALUES (?, ?, ?, ?, 'nation-reviewer', ?, ?, ?, ?)`
				)
				.bind(
					personIdentifier,
					account?.identifier ?? null,
					email,
					place.displayName,
					place.nationIdentifier,
					account ? 'active' : 'invited',
					grantedBy.identifier,
					time
				),
			eventStatement(database, {
				personIdentifier: grantedBy.identifier,
				action: account ? 'Added for a nation’s team' : 'Invited for a nation’s team',
				targetKind: 'person',
				targetIdentifier: personIdentifier,
				note: `For nation ${place.nationIdentifier}`
			})
		);
	}

	const placeIdentifier = newIdentifier();
	statements.push(
		database
			.prepare(
				`UPDATE nation_team_members SET ended_at = ?, ended_by = ?, end_reason = 'changed'
				 WHERE nation_identifier = ? AND person_identifier = ? AND ended_at IS NULL`
			)
			.bind(time, grantedBy.identifier, place.nationIdentifier, personIdentifier),
		database
			.prepare(
				`INSERT INTO nation_team_members (identifier, nation_identifier, person_identifier, level, page_parts,
				   office, basis, added_by_project, expires_at, granted_by, granted_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				placeIdentifier,
				place.nationIdentifier,
				personIdentifier,
				place.level,
				writeParts(place.parts),
				place.office,
				place.basis,
				place.addedByProject ? 1 : 0,
				place.expiresAt,
				grantedBy.identifier,
				time
			),
		eventStatement(database, {
			personIdentifier: grantedBy.identifier,
			action: `${place.displayName} given the place of ${teamLevelLabels[place.level].toLocaleLowerCase('en-US')} for ${describeParts(place.parts)}`,
			targetKind: 'grant',
			targetIdentifier: teamLogTarget(place.nationIdentifier),
			note: [`Until ${place.expiresAt.slice(0, 10)}`, place.basis].filter(Boolean).join('. ')
		})
	);
	await database.batch(statements);
	return { outcome: 'added', personIdentifier, placeIdentifier, invited };
}

export type EndReason = 'ended' | 'left' | 'suspended';

const endActions: Record<EndReason, string> = {
	ended: 'place ended',
	left: 'left the team',
	suspended: 'suspended'
};

function endStatements(
	database: D1Database,
	place: PlaceRow,
	endedBy: SignedInPerson,
	reason: EndReason,
	note: string | null
): D1PreparedStatement[] {
	return [
		database
			.prepare(
				`UPDATE nation_team_members SET ended_at = ?, ended_by = ?, end_reason = ?
				 WHERE identifier = ? AND ended_at IS NULL`
			)
			.bind(now(), endedBy.identifier, reason, place.identifier),
		eventStatement(database, {
			personIdentifier: endedBy.identifier,
			action: `${place.personName}: ${endActions[reason]}`,
			targetKind: 'grant',
			targetIdentifier: teamLogTarget(place.nationIdentifier),
			note
		})
	];
}

/** Ends one place on a team. The person's record and earlier actions are kept. */
export async function endPlace(
	database: D1Database,
	place: PlaceRow,
	endedBy: SignedInPerson,
	reason: Exclude<EndReason, 'suspended'>
): Promise<void> {
	await database.batch(endStatements(database, place, endedBy, reason, null));
}

/**
 * The project's override for a suspected impersonator: ends a person's place
 * on a nation's team and the places of everyone they added to it, and
 * everyone those people added, and so on. Returns the names suspended.
 */
export async function suspendWithEveryoneAdded(
	database: D1Database,
	place: PlaceRow,
	suspendedBy: SignedInPerson
): Promise<string[]> {
	const team = await teamOf(database, place.nationIdentifier);
	const toEnd = [place];
	const seen = new Set([place.personIdentifier]);
	for (let index = 0; index < toEnd.length; index += 1) {
		for (const other of team) {
			if (other.grantedBy === toEnd[index].personIdentifier && !seen.has(other.personIdentifier)) {
				seen.add(other.personIdentifier);
				toEnd.push(other);
			}
		}
	}
	const note = toEnd.length > 1 ? `With everyone ${place.personName} added` : null;
	await database.batch(toEnd.flatMap((ended) => endStatements(database, ended, suspendedBy, 'suspended', note)));
	return toEnd.map((ended) => ended.personName);
}

/** Every recorded change to a nation's team, newest first. */
export async function teamActivity(database: D1Database, nationIdentifier: string): Promise<EventRow[]> {
	return (await eventsFor(database, 'grant', teamLogTarget(nationIdentifier))).reverse();
}

// ---------------------------------------------------------------------------
// Requests to join a nation's team
// ---------------------------------------------------------------------------

/** Where proof sent with a request is kept in the private bucket. */
export const proofPrefix = 'nation-teams';

export interface ApplicationRow {
	identifier: string;
	reference: string;
	accountIdentifier: string;
	email: string;
	displayName: string;
	nationIdentifier: string;
	office: string;
	route: ProofRoute;
	parts: PagePart[] | null;
	details: string | null;
	proofName: string | null;
	proofType: string | null;
	hasProof: boolean;
	status: ApplicationStatus;
	officeContact: string | null;
	officeContactedAt: string | null;
	decidedByName: string | null;
	decidedAt: string | null;
	decisionNote: string | null;
	submittedAt: string;
}

interface StoredApplication extends Omit<ApplicationRow, 'parts' | 'hasProof'> {
	pageParts: string | null;
	proofKey: string | null;
}

const applicationColumns = `nation_team_applications.identifier, nation_team_applications.reference,
	nation_team_applications.account_identifier AS accountIdentifier, nation_team_applications.email,
	nation_team_applications.display_name AS displayName,
	nation_team_applications.nation_identifier AS nationIdentifier, nation_team_applications.office,
	nation_team_applications.route, nation_team_applications.page_parts AS pageParts,
	nation_team_applications.details, nation_team_applications.proof_key AS proofKey,
	nation_team_applications.proof_name AS proofName, nation_team_applications.proof_type AS proofType,
	nation_team_applications.status, nation_team_applications.office_contact AS officeContact,
	nation_team_applications.office_contacted_at AS officeContactedAt, decider.display_name AS decidedByName,
	nation_team_applications.decided_at AS decidedAt, nation_team_applications.decision_note AS decisionNote,
	nation_team_applications.submitted_at AS submittedAt`;

const applicationTables = `nation_team_applications
	LEFT JOIN people AS decider ON decider.identifier = nation_team_applications.decided_by`;

function applicationFromStored(row: StoredApplication): ApplicationRow {
	const { pageParts, proofKey, ...rest } = row;
	return { ...rest, parts: readParts(pageParts), hasProof: Boolean(proofKey) };
}

export interface NewApplication {
	accountIdentifier: string;
	email: string;
	displayName: string;
	nationIdentifier: string;
	office: string;
	route: ProofRoute;
	parts: readonly PagePart[] | null;
	details: string | null;
	proof: UploadedFile | null;
}

/** Saves a request to join a nation's team, with its proof. Returns its reference. */
export async function saveApplication(
	database: D1Database,
	bucket: R2Bucket,
	application: NewApplication
): Promise<string> {
	const identifier = newIdentifier();
	const reference = newRequestReference();
	const proofKey = application.proof ? `${proofPrefix}/${identifier}/proof` : null;
	if (application.proof && proofKey) {
		// Held until the virus check passes (site/SCANNING.md).
		await storeSentFile(database, bucket, {
			objectKey: proofKey,
			purpose: 'nation-team-proof',
			subject: reference,
			bytes: application.proof.bytes,
			httpMetadata: { contentType: application.proof.type },
			customMetadata: { reference, fileName: application.proof.name }
		});
	}
	try {
		await database.batch([
			database
				.prepare(
					`INSERT INTO nation_team_applications (identifier, reference, account_identifier, email, display_name,
					   nation_identifier, office, route, page_parts, details, proof_key, proof_name, proof_type, submitted_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.bind(
					identifier,
					reference,
					application.accountIdentifier,
					application.email,
					application.displayName,
					application.nationIdentifier,
					application.office,
					application.route,
					writeParts(application.parts),
					application.details,
					proofKey,
					application.proof?.name ?? null,
					application.proof?.type ?? null,
					now()
				),
			eventStatement(database, {
				personIdentifier: null,
				action: `Request ${reference} to join the team received`,
				targetKind: 'grant',
				targetIdentifier: teamLogTarget(application.nationIdentifier),
				note: `${application.displayName}, ${application.office}`
			})
		]);
	} catch (problem) {
		if (proofKey) {
			await bucket.delete(proofKey);
			await forgetScan(database, proofKey).catch(() => undefined);
		}
		throw problem;
	}
	return reference;
}

/** Requests sent by one account, newest first. */
export async function applicationsOf(database: D1Database, accountIdentifier: string): Promise<ApplicationRow[]> {
	const result = await database
		.prepare(
			`SELECT ${applicationColumns} FROM ${applicationTables}
			 WHERE nation_team_applications.account_identifier = ? ORDER BY nation_team_applications.submitted_at DESC`
		)
		.bind(accountIdentifier)
		.all<StoredApplication>();
	return result.results.map(applicationFromStored);
}

/** Requests for the project to handle: open ones first, oldest first; then the 50 most recent decided. */
export async function listApplications(database: D1Database): Promise<ApplicationRow[]> {
	const result = await database
		.prepare(
			`SELECT * FROM (
			   SELECT ${applicationColumns}, 0 AS ordering FROM ${applicationTables}
			   WHERE nation_team_applications.status IN ('received', 'confirming-with-nation')
			   UNION ALL
			   SELECT * FROM (
			     SELECT ${applicationColumns}, 1 AS ordering FROM ${applicationTables}
			     WHERE nation_team_applications.status NOT IN ('received', 'confirming-with-nation')
			     ORDER BY nation_team_applications.submitted_at DESC LIMIT 50))
			 ORDER BY ordering, CASE ordering WHEN 0 THEN submittedAt END, submittedAt DESC`
		)
		.all<StoredApplication & { ordering: number }>();
	return result.results.map(({ ordering: _ordering, ...row }) => applicationFromStored(row));
}

export async function applicationByReference(
	database: D1Database,
	reference: string
): Promise<ApplicationRow | undefined> {
	const row = await database
		.prepare(`SELECT ${applicationColumns} FROM ${applicationTables} WHERE nation_team_applications.reference = ?`)
		.bind(reference)
		.first<StoredApplication>();
	return row ? applicationFromStored(row) : undefined;
}

export async function proofOf(
	database: D1Database,
	reference: string
): Promise<{ key: string; name: string; type: string } | undefined> {
	const row = await database
		.prepare(
			`SELECT proof_key AS key, proof_name AS name, proof_type AS type FROM nation_team_applications
			 WHERE reference = ? AND proof_key IS NOT NULL`
		)
		.bind(reference)
		.first<{ key: string; name: string | null; type: string | null }>();
	return row ? { key: row.key, name: row.name ?? 'proof', type: row.type ?? 'application/octet-stream' } : undefined;
}

function statusStatement(
	database: D1Database,
	application: ApplicationRow,
	status: ApplicationStatus,
	by: SignedInPerson | null,
	note: string | null
): D1PreparedStatement[] {
	const decided = status === 'confirmed' || status === 'declined' || status === 'withdrawn';
	return [
		database
			.prepare(
				`UPDATE nation_team_applications SET status = ?,
				   decided_by = CASE WHEN ? THEN ? ELSE decided_by END,
				   decided_at = CASE WHEN ? THEN ? ELSE decided_at END,
				   decision_note = CASE WHEN ? THEN ? ELSE decision_note END
				 WHERE identifier = ?`
			)
			.bind(
				status,
				decided ? 1 : 0,
				by?.identifier ?? null,
				decided ? 1 : 0,
				now(),
				status === 'declined' ? 1 : 0,
				note,
				application.identifier
			),
		eventStatement(database, {
			personIdentifier: by?.identifier ?? null,
			action: `Request ${application.reference}: ${applicationStatusLabels[status].toLocaleLowerCase('en-US')}`,
			targetKind: 'grant',
			targetIdentifier: teamLogTarget(application.nationIdentifier),
			note
		})
	];
}

/**
 * Records that the project wrote to the nation's office to confirm the
 * request. The contact must be one the project already had for the nation,
 * never one the applicant gave; the page says so where it is typed.
 */
export async function markConfirming(
	database: D1Database,
	application: ApplicationRow,
	officeContact: string,
	by: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE nation_team_applications SET office_contact = ?, office_contacted_at = ? WHERE identifier = ?`
			)
			.bind(officeContact, now(), application.identifier),
		...statusStatement(database, application, 'confirming-with-nation', by, `Wrote to ${officeContact}`)
	]);
}

/** Confirms a request: the applicant gets the place the nation's office agreed to. */
export async function confirmApplication(
	database: D1Database,
	application: ApplicationRow,
	place: { level: TeamLevel; parts: readonly PagePart[] | null; expiresAt: string; basis: string },
	by: SignedInPerson
): Promise<AddPlaceResult> {
	const result = await addPlace(
		database,
		{
			nationIdentifier: application.nationIdentifier,
			email: application.email,
			displayName: application.displayName,
			level: place.level,
			parts: place.parts,
			office: application.office,
			expiresAt: place.expiresAt,
			basis: place.basis,
			addedByProject: true
		},
		by
	);
	if (result.outcome === 'added') {
		await database.batch(statusStatement(database, application, 'confirmed', by, place.basis));
	}
	return result;
}

export async function declineApplication(
	database: D1Database,
	application: ApplicationRow,
	reason: string,
	by: SignedInPerson
): Promise<void> {
	await database.batch(statusStatement(database, application, 'declined', by, reason));
}

export async function withdrawApplication(database: D1Database, application: ApplicationRow): Promise<void> {
	await database.batch(statusStatement(database, application, 'withdrawn', null, 'Withdrawn by the person who sent it'));
}

/**
 * Whether people the nation chose keep its page: a page is claimed while
 * someone the project confirmed with the nation's office has a current place
 * on its team (Trevor, Nov. 23, 2026: like a map listing). Returns when the
 * earliest such place began.
 */
export async function claimOf(
	database: D1Database,
	nationIdentifier: string,
	time = now()
): Promise<{ claimedSince: string; offices: string[] } | undefined> {
	const row = await database
		.prepare(
			`SELECT MIN(granted_at) AS claimedSince FROM nation_team_members
			 WHERE nation_identifier = ? AND added_by_project = 1 AND ended_at IS NULL AND expires_at > ?`
		)
		.bind(nationIdentifier, time)
		.first<{ claimedSince: string | null }>();
	if (!row?.claimedSince) return undefined;
	// The offices the team's people hold, never their names: the status badge's
	// panel says who keeps the page by office (Trevor, Nov. 23, 2026).
	const offices = await database
		.prepare(
			`SELECT DISTINCT office FROM nation_team_members
			 WHERE nation_identifier = ? AND ended_at IS NULL AND expires_at > ? AND office IS NOT NULL AND TRIM(office) <> ''
			 ORDER BY office`
		)
		.bind(nationIdentifier, time)
		.all<{ office: string }>();
	return { claimedSince: row.claimedSince, offices: offices.results.map((office) => office.office.trim()) };
}

/** Every nation whose page is claimed now (see claimOf). */
export async function claimedNations(database: D1Database, time = now()): Promise<Set<string>> {
	const result = await database
		.prepare(
			`SELECT DISTINCT nation_identifier AS nationIdentifier FROM nation_team_members
			 WHERE added_by_project = 1 AND ended_at IS NULL AND expires_at > ?`
		)
		.bind(time)
		.all<{ nationIdentifier: string }>();
	return new Set(result.results.map((row) => row.nationIdentifier));
}
