import { error, json } from '@sveltejs/kit';
import { accountSettingsCopy, deleteAccountSettingsCopy, saveAccountSettingsCopy } from '#lib/server/account-pages.ts';
import { storage } from '#lib/server/workspace.ts';
import type { RequestHandler } from './$types';

/**
 * The copy of a signed-in person's settings kept for every device
 * (src/lib/settings-everywhere.ts). GET reads it, PUT replaces it (and turns
 * the choice on), DELETE removes it (and turns the choice off). It answers
 * 401 rather than sending people to the sign-in page, since only the
 * site's own script calls it. A page on another site cannot send it JSON or
 * a DELETE without the browser asking first, and this address never says
 * yes to that.
 */
export const prerender = false;

function account(event: Parameters<RequestHandler>[0]) {
	if (!event.locals.account) error(401, 'Sign in to keep your settings with your account.');
	return event.locals.account;
}

const noStore = { 'cache-control': 'no-store' };

export const GET: RequestHandler = async (event) => {
	const { subject } = account(event);
	const copy = await accountSettingsCopy(storage(event).database, subject);
	return json(copy ? { on: true, ...copy } : { on: false }, { headers: noStore });
};

export const PUT: RequestHandler = async (event) => {
	const { subject } = account(event);
	if (!event.request.headers.get('content-type')?.startsWith('application/json')) error(415, 'Send the settings as JSON.');
	const text = await event.request.text();
	if (text.length > 4000) error(413, 'Too much to keep.');
	let body: { settings?: unknown; theme?: unknown };
	try {
		body = JSON.parse(text) as typeof body;
	} catch {
		error(400, 'The settings could not be read.');
	}
	const copy = await saveAccountSettingsCopy(storage(event).database, subject, body.settings, body.theme);
	return json({ on: true, ...copy }, { headers: noStore });
};

export const DELETE: RequestHandler = async (event) => {
	const { subject } = account(event);
	await deleteAccountSettingsCopy(storage(event).database, subject);
	return json({ on: false }, { headers: noStore });
};
