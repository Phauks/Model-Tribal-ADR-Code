/**
 * Nation teams: the people a Native nation chooses to keep its own page up to
 * date (decision record 0041, site/COLLABORATION.md, "Nation teams").
 *
 * Each place on a team is for one nation only. A steward adds and removes
 * people for that nation, at up to their own level and parts of the page,
 * and can never reach another nation. These rules are pure, so the server
 * and the tests share them; the server checks every one of them on every
 * request (src/lib/server/nation-teams.ts).
 */
import type { AccessGrant, AccessLevel } from './permissions.ts';

/** Levels on a nation's team, lowest first. */
export const teamLevels = ['reviewer', 'drafter', 'editor', 'steward'] as const;
export type TeamLevel = (typeof teamLevels)[number];

export const teamLevelLabels: Record<TeamLevel, string> = {
	reviewer: 'Reviewer',
	drafter: 'Drafter',
	editor: 'Editor',
	steward: 'Steward'
};

export const teamLevelDescriptions: Record<TeamLevel, string> = {
	reviewer: 'Reads the page and its drafts, comments, and approves the page for the nation.',
	drafter: 'Everything a reviewer does, and writes changes that an editor or steward publishes.',
	editor: 'Everything a drafter does, and publishes changes, restores earlier versions and hides parts of the page.',
	steward: 'Everything an editor does, and adds and removes people on this nation’s team.'
};

/** The workspace access level each team level gives on the nation's record. */
export const teamLevelAccess: Record<TeamLevel, AccessLevel> = {
	reviewer: 'comment',
	drafter: 'contribute',
	editor: 'full',
	steward: 'full'
};

/** Parts of a nation's page a place on the team can be limited to. */
export const pageParts = [
	'about',
	'courts-and-dispute-resolution',
	'contacts',
	'stories',
	'images',
	'statements'
] as const;
export type PagePart = (typeof pageParts)[number];

export const pagePartLabels: Record<PagePart, string> = {
	about: 'About (the nation’s own words, names and terms)',
	'courts-and-dispute-resolution': 'Courts and dispute resolution',
	contacts: 'Contacts',
	stories: 'Stories',
	images: 'Images and seal',
	statements: 'Statements beside government records'
};

/** How a person showed that the nation chose them (docs/nation-teams.md). */
export const proofRoutes = ['letter', 'resolution', 'office'] as const;
export type ProofRoute = (typeof proofRoutes)[number];

export const proofRouteLabels: Record<ProofRoute, string> = {
	letter: 'A letter from the nation’s government or one of its offices',
	resolution: 'A resolution or order of the nation’s council, court or other body',
	office: 'I hold an office that speaks for the nation'
};

export const applicationStatuses = ['received', 'confirming-with-nation', 'confirmed', 'declined', 'withdrawn'] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
	received: 'Received',
	'confirming-with-nation': 'Checking with the nation’s office',
	confirmed: 'Confirmed',
	declined: 'Declined',
	withdrawn: 'Withdrawn'
};

/** The longest a place on a team lasts before it must be renewed, in days. */
export const longestTerm: Record<TeamLevel, number> = {
	steward: 731,
	editor: 731,
	drafter: 731,
	reviewer: 731
};

/** The term offered when nobody picks one, in days. */
export const usualTerm: Record<TeamLevel, number> = {
	steward: 731,
	editor: 365,
	drafter: 365,
	reviewer: 365
};

/** What someone granting a place holds, as far as these rules care. */
export interface Granter {
	/** The lead author, who may give any level and part for any nation. */
	isAdministrator: boolean;
	/** Their own level on this nation's team; undefined when they have none. */
	level?: TeamLevel;
	/** The parts their own place covers; null means the whole page. */
	parts?: readonly PagePart[] | null;
}

export interface PlaceRequest {
	level: TeamLevel;
	/** null means the whole page. */
	parts: readonly PagePart[] | null;
	expiresAt: string;
}

export function atLeastTeamLevel(level: TeamLevel, minimum: TeamLevel): boolean {
	return teamLevels.indexOf(level) >= teamLevels.indexOf(minimum);
}

/** Whether a person may manage this nation's team at all. */
export function canManageTeam(granter: Granter): boolean {
	return granter.isAdministrator || granter.level === 'steward';
}

/**
 * Why a granter may not give this place, or undefined when they may. The
 * nation is never part of the request: the server takes it from the page the
 * steward manages, and that page checks their own place first.
 */
export function placeProblem(granter: Granter, request: PlaceRequest, time: Date = new Date()): string | undefined {
	if (!canManageTeam(granter)) return 'Only a steward of this nation, or the project, can add people to its team.';
	if (!teamLevels.includes(request.level)) return 'Choose a level.';
	if (request.parts !== null) {
		if (request.parts.length === 0) return 'Choose at least one part of the page, or the whole page.';
		if (request.parts.some((part) => !pageParts.includes(part))) return 'Choose parts from the list.';
	}
	const ends = Date.parse(request.expiresAt);
	if (Number.isNaN(ends)) return 'Give the end date as a date.';
	if (ends <= time.getTime()) return 'The end date has already passed.';
	if (ends > Date.parse(termEnd(longestTerm[request.level], time))) {
		return 'A place on a team lasts two years at most; it can be renewed.';
	}
	if (granter.isAdministrator) return undefined;
	if (!granter.level || !atLeastTeamLevel(granter.level, request.level)) {
		return 'You can give a level up to your own, not higher.';
	}
	const own = granter.parts ?? null;
	if (own !== null) {
		if (request.parts === null) return 'You can only give the parts of the page that your own place covers.';
		if (request.parts.some((part) => !own.includes(part))) {
			return 'You can only give the parts of the page that your own place covers.';
		}
	}
	return undefined;
}

/** The place being changed or ended, as far as these rules care. */
export interface Place {
	personIdentifier: string;
	level: TeamLevel;
	/** Confirmed by the project from the nation's own letter or office. */
	addedByProject: boolean;
}

/**
 * Why someone may not end or change another person's place, or undefined
 * when they may. Anyone may leave a team themselves. A steward may end the
 * place of anyone on the same nation's team, except a person the project
 * confirmed directly with the nation: only the nation's office, through the
 * project, ends that.
 */
export function endProblem(granter: Granter & { personIdentifier: string }, place: Place): string | undefined {
	if (granter.isAdministrator) return undefined;
	if (granter.personIdentifier === place.personIdentifier) return undefined;
	if (granter.level !== 'steward') return 'Only a steward of this nation, or the project, can change its team.';
	if (place.addedByProject) {
		return 'The project confirmed this person with the nation’s office, so only the office can end their place. Ask the project.';
	}
	return undefined;
}

/** Parts stored as JSON text, or null for the whole page. Unknown parts are dropped. */
export function readParts(stored: string | null): PagePart[] | null {
	if (stored === null) return null;
	try {
		const parsed: unknown = JSON.parse(stored);
		if (!Array.isArray(parsed)) return null;
		return pageParts.filter((part) => parsed.includes(part));
	} catch {
		return null;
	}
}

export function writeParts(parts: readonly PagePart[] | null): string | null {
	if (parts === null) return null;
	// Kept in the list's order, so the same choice is always stored the same way.
	return JSON.stringify(pageParts.filter((part) => parts.includes(part)));
}

/** "the whole page" or "Contacts, Stories", for messages and the activity log. */
export function describeParts(parts: readonly PagePart[] | null): string {
	if (parts === null || parts.length === pageParts.length) return 'the whole page';
	return parts.map((part) => pagePartLabels[part].replace(/ \(.*\)$/, '')).join(', ');
}

/** A current place on a team, as a grant on the nation's record for documentAccess. */
export function placeAsGrant(nationIdentifier: string, level: TeamLevel, expiresAt: string): AccessGrant {
	return {
		subjectKind: 'nation',
		subjectIdentifier: nationIdentifier,
		level: teamLevelAccess[level],
		expiresAt,
		from: 'nation-team'
	};
}

/** The end of the day `days` from `time`, in UTC, as stored. */
export function termEnd(days: number, time: Date = new Date()): string {
	const end = new Date(time.getTime() + days * 86_400_000);
	return `${end.toISOString().slice(0, 10)}T23:59:59.999Z`;
}

/** A form's yyyy-mm-dd date as the end of that day in UTC, or undefined. */
export function dateAsTermEnd(value: string | null): string | undefined {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return undefined;
	return `${value}T23:59:59.999Z`;
}

/** Where every change to a nation's team is recorded in the activity log. */
export function teamLogTarget(nationIdentifier: string): string {
	return `nation-team/${nationIdentifier}`;
}
