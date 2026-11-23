import { inboxViews } from '#lib/mail.ts';
import { can } from '#lib/permissions.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { listFolders, listTags, viewCounts } from '#lib/server/mail/store.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { LayoutServerLoad } from './$types';

// The inbox's own left column, shared by the list, a conversation, writing a
// message, and the rules and folders pages (site/MAIL.md): the views with
// their unread counts, the folders the lead author made, and the tags.
export const prerender = false;

export const load: LayoutServerLoad = async (event) => {
	const person = requirePermission(event, 'read-mail');
	const context = mailContext();
	const [counts, mailFolders, tags] = await Promise.all([viewCounts(context, person.identifier), listFolders(context), listTags(context)]);
	return {
		views: inboxViews,
		counts,
		mailFolders,
		tags,
		emailOn: context.settings.domain !== null,
		canManage: can(person, 'manage-mail')
	};
};
