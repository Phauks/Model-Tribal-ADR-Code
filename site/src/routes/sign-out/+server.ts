import { redirect } from '@sveltejs/kit';
import { endSession, sessionCookie } from '#lib/server/accounts.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { clearSessionCookie } from '#lib/server/sign-in.ts';
import { clearSignedIn } from '#lib/server/signed-in-hint.ts';
import type { RequestHandler } from './$types';

export const prerender = false;

/** Ends the session in the database and in this browser, then returns to the home page. */
export const POST: RequestHandler = async ({ cookies }) => {
	const { database } = workerEnvironment();
	if (database) await endSession(database, cookies.get(sessionCookie));
	clearSessionCookie(cookies);
	clearSignedIn(cookies);
	redirect(303, '/');
};
