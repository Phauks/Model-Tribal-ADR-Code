/**
 * Following pages (site/COLLABORATION.md, "Following pages"; site/DESIGN.md,
 * section 6, "Follow"). Someone signed in can follow a nation's page, the
 * model code or a section of it, or an essay, and is told when it changes: by
 * a notice on the site and, once the site can send email, by a summary email.
 * Trevor asked for this on Nov. 23, 2026.
 *
 * Notices say only that a page was updated, and when, with a link to it.
 * They never quote what changed, so they cannot show text a nation asked to
 * have removed or restricted, and nation pages have no public version
 * history. The model code and essays do, so their notices also link to it.
 *
 * This module must work in the browser and in Node (for tests).
 */

export type FollowKind = 'nation' | 'code' | 'essay';

/** The pages that can be followed, by address. Only lasting addresses count. */
const followablePages: { kind: FollowKind; pattern: RegExp }[] = [
	{ kind: 'nation', pattern: /^\/nations\/(?!map$|letter$|state$)[a-z0-9][a-z0-9-]*$/ },
	// The whole model code, or one part or section of it, once its pages are built.
	{ kind: 'code', pattern: /^\/code(?:\/[0-9][0-9a-z.-]*)?$/ },
	{ kind: 'essay', pattern: /^\/(?:essays|foundations|back-matter)\/[a-z0-9][a-z0-9-]*$/ }
];

export const followKindLabels: Record<FollowKind, string> = {
	nation: 'Nation',
	code: 'Model code',
	essay: 'Essay'
};

/** What kind of page an address is, or undefined when it cannot be followed. */
export function followKindOf(address: unknown): FollowKind | undefined {
	if (typeof address !== 'string' || address.length > 200) return undefined;
	return followablePages.find((page) => page.pattern.test(address))?.kind;
}

/** Whether a kind of page has a public version history to link to. Nation pages never do. */
export function hasPublicHistory(kind: FollowKind): boolean {
	return kind !== 'nation';
}

/** The public version history of a page that has one. */
export function historyAddress(kind: FollowKind, address: string): string | undefined {
	return hasPublicHistory(kind) && kind === 'essay' ? `${address}/history` : undefined;
}

export const emailChoices = ['off', 'daily', 'weekly'] as const;
export type EmailChoice = (typeof emailChoices)[number];

export const emailChoiceLabels: Record<EmailChoice, string> = {
	daily: 'Once a day, when a page I follow changed',
	weekly: 'Once a week, when a page I follow changed',
	off: 'No email. Notices on the site only'
};

export function isEmailChoice(value: unknown): value is EmailChoice {
	return typeof value === 'string' && (emailChoices as readonly string[]).includes(value);
}

/** The most pages one account can follow. */
export const followLimit = 1000;

/** What /following/state tells a page about itself and the reader. */
export interface FollowState {
	/** Whether the reader is signed in. Everything else is false or 0 when not. */
	signedIn: boolean;
	/** Whether this page can be followed (a page that exists and has a lasting address). */
	followable: boolean;
	following: boolean;
	/** Notices the reader has not seen yet on the Following page. */
	unread: number;
}

export const signedOutState: FollowState = { signedIn: false, followable: false, following: false, unread: 0 };

/** Reads the JSON /following/state answers with; anything unexpected reads as signed out. */
export function readFollowState(value: unknown): FollowState {
	if (typeof value !== 'object' || value === null) return signedOutState;
	const record = value as Record<string, unknown>;
	if (record.signedIn !== true) return signedOutState;
	const unread = typeof record.unread === 'number' && Number.isInteger(record.unread) && record.unread > 0 ? record.unread : 0;
	return {
		signedIn: true,
		followable: record.followable === true,
		following: record.following === true,
		unread
	};
}

/** "3 new" for a count of unread notices, capped so a badge stays short. */
export function unreadLabel(count: number): string {
	return count > 99 ? '99+' : String(count);
}
