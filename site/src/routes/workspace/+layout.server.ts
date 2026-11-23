import { permissionsOf, type Permission } from '#lib/permissions.ts';
import { hasAnyInbox } from '#lib/server/mail/inboxes.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
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
		const { database } = workerEnvironment();
		const onAnInbox = database ? await hasAnyInbox({ database }, person.identifier).catch(() => false) : false;
		if (onAnInbox) permissions.add('read-mail');
	}
	return { person, permissions: [...permissions] };
};
