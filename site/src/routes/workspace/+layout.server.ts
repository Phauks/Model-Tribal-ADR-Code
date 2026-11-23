import { permissionsOf, type Permission } from '#lib/permissions.ts';
import { hasAnyInbox } from '#lib/server/mail/inboxes.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { requirePerson } from '#lib/server/workspace.ts';
import type { LayoutServerLoad } from './$types';

// Private pages, answered by the Worker for the signed-in person.
export const prerender = false;

export const load: LayoutServerLoad = async (event) => {
	const person = requirePerson(event);
	const permissions = new Set<Permission>(permissionsOf(person.role));
	// Someone put on an inbox reads its mail whatever their role, so the menu
	// shows them the Inbox (site/MAIL.md, "Inboxes"). A missing table, in the
	// minutes between a deploy and its migration, only hides the link.
	if (!permissions.has('read-mail')) {
		const onAnInbox = await hasAnyInbox(mailContext(), person.identifier).catch(() => false);
		if (onAnInbox) permissions.add('read-mail');
	}
	return { person, permissions: [...permissions] };
};
