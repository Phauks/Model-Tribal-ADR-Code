/**
 * Shared steps of the routes that receive files (src/routes/uploads/pieces):
 * who is sending, which upload they mean, and how a refusal is answered.
 */
import { error, json } from '@sveltejs/kit';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { isUploadReference } from '#lib/uploads.ts';
import { workerEnvironment } from './environment.ts';
import { ownUpload, UploadProblem, type UploadRow } from './uploads.ts';
import type { SignedInAccount } from './contributor-profiles.ts';

interface UploadEvent {
	locals: App.Locals;
	params: Partial<Record<string, string>>;
}

/** The signed-in account; routes that take files answer 401 rather than redirecting. */
export function senderOf(event: UploadEvent): SignedInAccount {
	if (!event.locals.account) error(401, 'Sign in first.');
	return event.locals.account;
}

/** The upload named in the address, if it belongs to the signed-in account. */
export async function senderUpload(event: UploadEvent, database: D1Database): Promise<UploadRow> {
	const account = senderOf(event);
	const reference = event.params.reference ?? '';
	if (!isUploadReference(reference)) error(404, 'There is no such upload.');
	const upload = await ownUpload(database, account.subject, reference);
	if (!upload) error(404, 'There is no such upload.');
	return upload;
}

/** Runs a step, answering a refusal as JSON the Send files page shows. */
export async function answering(step: () => Promise<Response>): Promise<Response> {
	try {
		return await step();
	} catch (problem) {
		if (problem instanceof UploadProblem) {
			return json({ message: problem.message }, { status: problem.status, headers: { 'cache-control': 'no-store' } });
		}
		throw problem;
	}
}

/** Whether the account may start another file this minute (wrangler.jsonc, uploadLimit). */
export async function withinStartLimit(accountIdentifier: string): Promise<boolean> {
	const limiter = workerEnvironment().uploadLimit;
	if (!limiter) return true;
	return (await limiter.limit({ key: accountIdentifier })).success;
}

/** Nation page identifiers have this shape; the picker offers only real ones. */
export function looksLikeNation(identifier: string): boolean {
	return /^[a-z0-9][a-z0-9-]{0,120}$/.test(identifier);
}
