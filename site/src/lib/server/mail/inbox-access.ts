/**
 * Who may open the inbox pages (site/MAIL.md, "Inboxes"): whoever is on at
 * least one inbox, and whoever manages the inbox (so they can set it up).
 * A conversation, message or file opens only for someone on its inbox;
 * anyone else gets "not found", as if it were not there.
 */
import { error } from '@sveltejs/kit';
import { can, type Permission } from '#lib/permissions.ts';
import type { SignedInPerson } from '#lib/server/people.ts';
import { refuse, requirePerson, type WorkspaceEvent } from '#lib/server/workspace.ts';
import { hasAnyInbox, mayOpenThread } from './inboxes.ts';
import { mailContext } from './runtime.ts';

/** The signed-in person, if they may use the inbox pages; otherwise "403 Forbidden". */
export async function requireMail(event: WorkspaceEvent): Promise<SignedInPerson> {
	const person = requirePerson(event);
	if (can(person, 'manage-mail') || (await hasAnyInbox(mailContext(), person.identifier))) return person;
	refuse(event, 'is on no inbox');
}

/**
 * The signed-in person, if they are on the conversation's inbox (and hold
 * `permission`, when one is named); otherwise "404 Not Found" or "403".
 */
export async function requireThread(event: WorkspaceEvent, threadIdentifier: string, permission?: Permission): Promise<SignedInPerson> {
	const person = await requireMail(event);
	if (permission && !can(person, permission)) refuse(event, `lacks the ${permission} permission`);
	if (!(await mayOpenThread(mailContext(), person.identifier, threadIdentifier))) error(404, 'There is no such conversation in your inboxes.');
	return person;
}

/** The conversation a message is in, if the person may open it. */
export async function requireMessage(event: WorkspaceEvent, messageIdentifier: string): Promise<SignedInPerson> {
	const person = await requireMail(event);
	const row = await mailContext()
		.database.prepare('SELECT thread_identifier FROM mail_messages WHERE identifier = ?')
		.bind(messageIdentifier)
		.first<{ thread_identifier: string }>();
	if (!row || !(await mayOpenThread(mailContext(), person.identifier, row.thread_identifier))) error(404, 'There is no such message in your inboxes.');
	return person;
}
