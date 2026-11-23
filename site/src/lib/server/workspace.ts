/**
 * Checks used by every page and form in the co-author workspace. Each page
 * and each form action calls these itself, because SvelteKit runs page loads
 * alongside the layout's, so a check in the layout alone would not protect
 * them.
 */
import { error, redirect } from '@sveltejs/kit';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { can, type Permission } from '#lib/permissions.ts';
import { workerEnvironment } from './environment.ts';
import type { SignedInAccount } from './contributor-profiles.ts';
import type { SignedInPerson } from './people.ts';

export interface WorkspaceEvent {
	locals: App.Locals;
	url: URL;
}

/**
 * The signed-in person, or a redirect to sign in and come back. Someone who
 * is signed in but has no workspace access goes to their contributor
 * profile instead, and someone whose role needs two-step sign-in goes to set
 * it up first.
 */
export function requirePerson(event: WorkspaceEvent): SignedInPerson {
	if (event.locals.twoStepNeeded) {
		const returnTo = `${event.url.pathname}${event.url.search}`;
		redirect(303, `/account/security/two-step?required=1&returnTo=${encodeURIComponent(returnTo)}`);
	}
	if (!event.locals.person) {
		if (event.locals.account) redirect(303, '/profile');
		const returnTo = `${event.url.pathname}${event.url.search}`;
		redirect(303, `/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
	}
	return event.locals.person;
}

/**
 * The signed-in person, for an address the editor reads or writes with
 * fetch. A redirect there would be followed quietly and answered with the
 * sign-in page, which the editor could take for a save, so a signed-out
 * request gets "401 Unauthorized" with a message instead.
 */
export function requirePersonForData(event: WorkspaceEvent): SignedInPerson {
	if (event.locals.twoStepNeeded) {
		error(403, 'Your role needs two-step sign-in. Set it up on Sign-in and security, then try again.');
	}
	if (!event.locals.person) {
		error(401, event.locals.account ? 'This account has no workspace access.' : 'You are signed out. Sign in again in another tab, then try once more.');
	}
	return event.locals.person;
}

/** Whoever is signed in, or a redirect to sign in and come back. */
export function requireAccount(event: WorkspaceEvent): SignedInAccount {
	if (!event.locals.account) {
		const returnTo = `${event.url.pathname}${event.url.search}`;
		redirect(303, `/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
	}
	return event.locals.account;
}

/**
 * Refuses the request with "403 Forbidden", noting why so that
 * src/hooks.server.ts records the attempt in the activity log.
 */
export function refuse(event: WorkspaceEvent, reason: string, message = 'You do not have permission to see this page.'): never {
	event.locals.refused = reason;
	error(403, message);
}

/** The signed-in person, if they hold a permission; otherwise "403 Forbidden". */
export function requirePermission(event: WorkspaceEvent, permission: Permission): SignedInPerson {
	const person = requirePerson(event);
	if (!can(person, permission)) refuse(event, `lacks the ${permission} permission`);
	return person;
}

export function storage(event: WorkspaceEvent): { database: D1Database; bucket: R2Bucket } {
	const environment = workerEnvironment();
	if (!environment.database || !environment.sourceDocuments) {
		error(503, 'The database is not connected.');
	}
	return { database: environment.database, bucket: environment.sourceDocuments };
}

/** A trimmed form field, or null when empty. */
export function formText(form: FormData, name: string, maximum = 8000): string | null {
	const value = form.get(name);
	if (typeof value !== 'string') return null;
	const trimmed = value.normalize('NFC').trim().slice(0, maximum);
	return trimmed === '' ? null : trimmed;
}
