import { inboxViews } from '#lib/mail.ts';
import { can } from '#lib/permissions.ts';
import { requireMail } from '#lib/server/mail/inbox-access.ts';
import { reachableInboxes } from '#lib/server/mail/inboxes.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { listFolders, listTags, viewCounts } from '#lib/server/mail/store.ts';
import { countDrafts } from '#lib/server/mail/writing.ts';
import type { LayoutServerLoad } from './$types';

// The inbox's own left column, shared by the list, a conversation, writing a
// message, and the rules and folders pages (site/MAIL.md): the person's
// inboxes, the views with their unread counts (in all their inboxes, or the
// one chosen with ?inbox=), the person's drafts, the folders the lead author
// made, and the tags.
export const prerender = false;

export const load: LayoutServerLoad = async (event) => {
	const person = await requireMail(event);
	// The counts reload when a page says they changed, such as when writing starts a new draft (Composer.svelte).
	event.depends('mail:counts');
	const context = mailContext();
	const inboxes = await reachableInboxes(context, person.identifier);
	const asked = event.url.searchParams.get('inbox');
	const chosen = inboxes.find((inbox) => inbox.identifier === asked) ?? null;
	const [counts, mailFolders, tags, drafts, inboxCounts] = await Promise.all([
		viewCounts(context, person.identifier, chosen?.identifier ?? null),
		listFolders(context, person.identifier),
		listTags(context),
		countDrafts(context, person.identifier),
		Promise.all(inboxes.map(async (inbox) => (await viewCounts(context, person.identifier, inbox.identifier)).inbox ?? 0))
	]);
	return {
		views: inboxViews,
		counts,
		inboxes: inboxes.map((inbox, index) => ({
			identifier: inbox.identifier,
			name: inbox.name,
			address: inbox.address ?? `${inbox.localPart}@`,
			kind: inbox.kind,
			unread: inboxCounts[index]
		})),
		chosenInbox: chosen?.identifier ?? null,
		mailFolders,
		tags,
		drafts,
		emailOn: context.settings.domain !== null,
		canManage: can(person, 'manage-mail')
	};
};
