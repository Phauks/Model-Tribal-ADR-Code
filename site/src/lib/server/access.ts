/**
 * Access to each document (decision record 0023, site/COLLABORATION.md,
 * "Access to each document"): reading and changing grants, and the check
 * every page, form and editing room runs before it shows or changes a
 * document.
 */
import { error } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	accessLevelLabels,
	atLeast,
	documentAccess,
	everyDocument,
	accessKindLabels,
	type AccessGrant,
	type AccessKind,
	type AccessSubject,
	type AccessLevel,
	type DocumentAccess
} from '#lib/permissions.ts';
import { placeAsGrant, type TeamLevel } from '#lib/nation-teams.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import type { SignedInPerson } from './people.ts';

export interface GrantRow extends AccessGrant {
	identifier: string;
	personIdentifier: string;
	personName: string;
	personRole: string;
	note: string | null;
	grantedAt: string;
	grantedByName: string | null;
}

const grantColumns = `access_grants.identifier, access_grants.person_identifier AS personIdentifier,
	access_grants.subject_kind AS subjectKind, access_grants.subject_identifier AS subjectIdentifier,
	access_grants.level, access_grants.expires_at AS expiresAt, access_grants.note,
	access_grants.granted_at AS grantedAt`;

/**
 * A person's current grants (not ended; expired ones are filtered when
 * checked), and their places on nations' teams, which count as grants on
 * those nations' records (src/lib/nation-teams.ts).
 */
export async function grantsOf(database: D1Database, personIdentifier: string): Promise<AccessGrant[]> {
	const [grants, places] = await Promise.all([
		database
			.prepare(
				`SELECT subject_kind AS subjectKind, subject_identifier AS subjectIdentifier, level,
				        expires_at AS expiresAt
				 FROM access_grants WHERE person_identifier = ? AND ended_at IS NULL`
			)
			.bind(personIdentifier)
			.all<AccessGrant>(),
		database
			.prepare(
				`SELECT nation_identifier AS nationIdentifier, level, expires_at AS expiresAt
				 FROM nation_team_members WHERE person_identifier = ? AND ended_at IS NULL`
			)
			.bind(personIdentifier)
			.all<{ nationIdentifier: string; level: TeamLevel; expiresAt: string }>()
	]);
	return [
		...grants.results,
		...places.results.map((place) => placeAsGrant(place.nationIdentifier, place.level, place.expiresAt))
	];
}

/** A person's level on one document, read fresh from the database. */
export async function accessTo(
	database: D1Database,
	person: SignedInPerson,
	subject: AccessSubject
): Promise<DocumentAccess> {
	return documentAccess(person, subject, await grantsOf(database, person.identifier));
}

/** Every current grant, for the Access page, optionally for one person. */
export async function listGrants(
	database: D1Database,
	personIdentifier?: string
): Promise<GrantRow[]> {
	const result = await database
		.prepare(
			`SELECT ${grantColumns}, people.display_name AS personName, people.role AS personRole,
			        granter.display_name AS grantedByName
			 FROM access_grants
			 JOIN people ON people.identifier = access_grants.person_identifier
			 LEFT JOIN people AS granter ON granter.identifier = access_grants.granted_by
			 WHERE access_grants.ended_at IS NULL AND (?1 IS NULL OR access_grants.person_identifier = ?1)
			 ORDER BY people.display_name COLLATE NOCASE, access_grants.subject_kind,
			          access_grants.subject_identifier`
		)
		.bind(personIdentifier ?? null)
		.all<GrantRow>();
	return result.results;
}

export async function grantByIdentifier(
	database: D1Database,
	identifier: string
): Promise<GrantRow | undefined> {
	const row = await database
		.prepare(
			`SELECT ${grantColumns}, people.display_name AS personName, people.role AS personRole,
			        NULL AS grantedByName
			 FROM access_grants JOIN people ON people.identifier = access_grants.person_identifier
			 WHERE access_grants.identifier = ? AND access_grants.ended_at IS NULL`
		)
		.bind(identifier)
		.first<GrantRow>();
	return row ?? undefined;
}

/** "Essay i-key-cases-digest" or "every essay", for the activity log. */
export function describeScope(kind: AccessKind, identifier: string): string {
	if (kind === 'site-text') return 'the site text';
	const label = accessKindLabels[kind].toLocaleLowerCase('en-US');
	return identifier === everyDocument ? `every ${label}` : `${label} ${identifier}`;
}

export interface GrantInput {
	personIdentifier: string;
	subjectKind: AccessKind;
	subjectIdentifier: string;
	level: AccessLevel;
	expiresAt: string | null;
	note: string | null;
}

/**
 * Sets a person's level on a document or a kind. Any current grant for the
 * same scope is ended first, in the same transaction, so the history of who
 * had what, and who changed it, is kept.
 */
export async function setGrant(
	database: D1Database,
	input: GrantInput,
	grantedBy: SignedInPerson
): Promise<void> {
	const time = now();
	const identifier = newIdentifier();
	const scope = describeScope(input.subjectKind, input.subjectIdentifier);
	await database.batch([
		database
			.prepare(
				`UPDATE access_grants SET ended_at = ?, ended_by = ?
				 WHERE person_identifier = ? AND subject_kind = ? AND subject_identifier = ? AND ended_at IS NULL`
			)
			.bind(time, grantedBy.identifier, input.personIdentifier, input.subjectKind, input.subjectIdentifier),
		database
			.prepare(
				`INSERT INTO access_grants (identifier, person_identifier, subject_kind, subject_identifier, level,
				   note, expires_at, granted_by, granted_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				input.personIdentifier,
				input.subjectKind,
				input.subjectIdentifier,
				input.level,
				input.note,
				input.expiresAt,
				grantedBy.identifier,
				time
			),
		eventStatement(database, {
			personIdentifier: grantedBy.identifier,
			action: `Access to ${scope} set to ${accessLevelLabels[input.level].toLocaleLowerCase('en-US')}`,
			targetKind: 'person',
			targetIdentifier: input.personIdentifier,
			note: [input.expiresAt ? `Until ${input.expiresAt.slice(0, 10)}` : null, input.note]
				.filter(Boolean)
				.join('. ') || null
		})
	]);
	notifyAccessChanged(input.personIdentifier, { kind: input.subjectKind, identifier: input.subjectIdentifier });
}

/** Ends a grant, so the person falls back to their role's default. */
export async function endGrant(
	database: D1Database,
	grant: GrantRow,
	endedBy: SignedInPerson
): Promise<void> {
	await database.batch([
		database
			.prepare(
				`UPDATE access_grants SET ended_at = ?, ended_by = ? WHERE identifier = ? AND ended_at IS NULL`
			)
			.bind(now(), endedBy.identifier, grant.identifier),
		eventStatement(database, {
			personIdentifier: endedBy.identifier,
			action: `Grant for ${describeScope(grant.subjectKind, grant.subjectIdentifier)} ended; role default applies`,
			targetKind: 'person',
			targetIdentifier: grant.personIdentifier
		})
	]);
	notifyAccessChanged(grant.personIdentifier, { kind: grant.subjectKind, identifier: grant.subjectIdentifier });
}

type AccessChangeListener = (personIdentifier: string, subject: AccessSubject) => void;
const accessChangeListeners = new Set<AccessChangeListener>();

/**
 * Lets other parts of the site react when a person's access changes, for
 * example an editing room that should disconnect someone whose access was
 * lowered. Rooms also re-check access on every save, so this only makes the
 * change take effect sooner.
 */
export function onAccessChanged(listener: AccessChangeListener): () => void {
	accessChangeListeners.add(listener);
	return () => accessChangeListeners.delete(listener);
}

export function notifyAccessChanged(personIdentifier: string, subject: AccessSubject): void {
	for (const listener of accessChangeListeners) listener(personIdentifier, subject);
}

interface DocumentEvent {
	locals: App.Locals;
	url: URL;
}

/**
 * The check before showing or changing a document: the signed-in person's
 * level, read fresh from the database, must be at least `minimum`;
 * otherwise "403 Forbidden". The caller has already required a signed-in
 * person. A refused change is recorded in the activity log by
 * src/hooks.server.ts.
 */
export async function requireDocumentLevel(
	event: DocumentEvent,
	database: D1Database,
	subject: AccessSubject,
	minimum: AccessLevel
): Promise<DocumentAccess> {
	const person = event.locals.person;
	if (!person) error(401, 'Sign in first.');
	const access = await accessTo(database, person, subject);
	if (!atLeast(access.level, minimum)) {
		event.locals.refused = `needs ${minimum} on ${describeScope(subject.kind, subject.identifier)}, has ${access.level}`;
		error(403, 'You do not have permission to do this with this document.');
	}
	return access;
}
