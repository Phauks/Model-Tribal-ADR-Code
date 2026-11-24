import { isHttpError, isRedirect } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignedInPerson } from '#lib/server/people.ts';
import { receiveMail } from '#lib/server/mail/inbound.ts';
import { requireMail, requireMessage, requireThread } from '#lib/server/mail/inbox-access.ts';
import { addInboxMember, createInbox, removeInboxMember } from '#lib/server/mail/inboxes.ts';
import { rawMessage, testContext } from './mail-fixtures.ts';

const bindings = vi.hoisted(() => ({}) as Record<string, unknown>);
vi.mock('cloudflare:workers', () => ({ env: bindings, waitUntil: () => undefined }));

const clock = { now: new Date('2026-11-24T17:00:00Z') };
const encoder = new TextEncoder();
let context: Awaited<ReturnType<typeof testContext>>;

// The fixture's lead author is on both shared inboxes, contact@ and requests@.
const lead: SignedInPerson = { identifier: 'lead', displayName: 'Lead Author', email: 'lead@example.org', role: 'lead-author', nationIdentifier: null };
const rosa: SignedInPerson = { identifier: 'rosa', displayName: 'Rosa', email: 'rosa@example.net', role: 'co-author', nationIdentifier: null };

async function arrive(to: string, subject: string): Promise<{ threadIdentifier: string; messageIdentifier: string }> {
	const from = 'office@nation.example';
	const result = await receiveMail(context, { from, to, raw: encoder.encode(rawMessage({ From: from, To: to, Subject: subject }, 'Hello')) });
	if (result.outcome !== 'filed') throw new Error(`not filed: ${JSON.stringify(result)}`);
	return result;
}

function event(person: SignedInPerson | undefined) {
	return {
		locals: { person, account: person ? { subject: person.identifier, email: person.email, name: null } : undefined, twoStepNeeded: false } as App.Locals,
		url: new URL('https://example.org/workspace/mail')
	};
}

async function refusal(check: Promise<unknown>): Promise<number | 'redirect'> {
	try {
		await check;
	} catch (problem) {
		if (isRedirect(problem)) return 'redirect';
		if (isHttpError(problem)) return problem.status;
		throw problem;
	}
	throw new Error('The check let the request through.');
}

beforeEach(async () => {
	for (const key of Object.keys(bindings)) delete bindings[key];
	context = await testContext(clock);
	Object.assign(bindings, { database: context.database, mailFiles: context.bucket, MAIL_DOMAIN: 'example.org' });
	await context.database
		.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('rosa', 'rosa@example.net', 'Rosa', 'co-author', 'active', '2026-11-20T00:00:00Z')`)
		.run();
});

describe('requireMail, for the inbox pages', () => {
	it('sends someone signed out to sign in', async () => {
		expect(await refusal(requireMail(event(undefined)))).toBe('redirect');
	});

	it('refuses someone on no inbox who does not manage mail, and records why', async () => {
		const request = event(rosa);
		expect(await refusal(requireMail(request))).toBe(403);
		expect(request.locals.refused).toBe('is on no inbox');
	});

	it('lets in someone on at least one inbox', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		expect(await requireMail(event(rosa))).toBe(rosa);
	});

	it('lets in whoever manages mail, even on no inbox, so they can set the inboxes up', async () => {
		// The pages would not leave an inbox with nobody on it, so the lead author is taken off by hand.
		await context.database.prepare(`DELETE FROM mail_inbox_members WHERE person_identifier = 'lead'`).run();
		expect(await requireMail(event(lead))).toBe(lead);
		const { threadIdentifier } = await arrive('requests@example.org', 'A request');
		expect(await refusal(requireThread(event(lead), threadIdentifier))).toBe(404);
	});

	it('answers 503 while the mail bucket is not connected', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		delete bindings.mailFiles;
		expect(await refusal(requireMail(event(rosa)))).toBe(503);
	});
});

describe('requireThread', () => {
	it('opens a conversation in an inbox the person is on', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		const { threadIdentifier } = await arrive('requests@example.org', 'A request');
		expect(await requireThread(event(rosa), threadIdentifier)).toBe(rosa);
	});

	it('answers “not found” for a conversation in another inbox, as if it were not there', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		const { threadIdentifier } = await arrive('contact@example.org', 'For the contact inbox');
		expect(await refusal(requireThread(event(rosa), threadIdentifier))).toBe(404);
		expect(await refusal(requireThread(event(rosa), 'no-such-thread'))).toBe(404);
	});

	it('keeps a personal inbox from the lead author who manages mail', async () => {
		await createInbox(context, 'lead', { localPart: 'rosa', name: 'Rosa', kind: 'personal', ownerIdentifier: 'rosa' });
		const { threadIdentifier } = await arrive('rosa@example.org', 'Personal');
		expect(await refusal(requireThread(event(lead), threadIdentifier))).toBe(404);
		expect(await requireThread(event(rosa), threadIdentifier)).toBe(rosa);
	});

	it('refuses with 403 when a permission is named and the person lacks it, before looking at the conversation', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		const { threadIdentifier } = await arrive('requests@example.org', 'A request');
		const request = event(rosa);
		expect(await refusal(requireThread(request, threadIdentifier, 'send-outreach'))).toBe(403);
		expect(request.locals.refused).toBe('lacks the send-outreach permission');
		expect(await requireThread(event(lead), threadIdentifier, 'send-outreach')).toBe(lead);
	});

	it('refuses someone on no inbox before anything else', async () => {
		const { threadIdentifier } = await arrive('requests@example.org', 'A request');
		expect(await refusal(requireThread(event(rosa), threadIdentifier))).toBe(403);
	});
});

describe('requireMessage', () => {
	it('opens a message in a conversation the person may open', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		const { messageIdentifier } = await arrive('requests@example.org', 'A request');
		expect(await requireMessage(event(rosa), messageIdentifier)).toBe(rosa);
	});

	it('answers “not found” for a message in another inbox, or one that does not exist', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		const { messageIdentifier } = await arrive('contact@example.org', 'For the contact inbox');
		expect(await refusal(requireMessage(event(rosa), messageIdentifier))).toBe(404);
		expect(await refusal(requireMessage(event(rosa), 'no-such-message'))).toBe(404);
	});

	it('stops opening a message once the person is taken off its inbox', async () => {
		await addInboxMember(context, 'lead', 'requests', 'rosa');
		await addInboxMember(context, 'lead', 'contact', 'rosa');
		const { messageIdentifier } = await arrive('requests@example.org', 'A request');
		expect(await requireMessage(event(rosa), messageIdentifier)).toBe(rosa);
		await removeInboxMember(context, 'lead', 'requests', 'rosa');
		expect(await refusal(requireMessage(event(rosa), messageIdentifier))).toBe(404);
	});
});
