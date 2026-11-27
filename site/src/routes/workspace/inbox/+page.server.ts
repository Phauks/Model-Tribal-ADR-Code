import { fail } from '@sveltejs/kit';
import { isInboxView } from '#lib/mail.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { changeMany, isBuiltInFolder, listThreads, type BulkOperation } from '#lib/server/mail/store.ts';
import { formText } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';
import { requireMail } from '#lib/server/mail/inbox-access.ts';
import { stuckArrivals, tryStuckArrivalsAgain } from '#lib/server/mail/arrivals.ts';
import { can } from '#lib/permissions.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import { isMissingTable } from '#lib/problems.ts';
import { reportHere } from '#lib/server/report-here.ts';

// The project inbox (site/MAIL.md): one page of conversations in a view, a
// folder the lead author made, or a tag, with search, and what the
// checkboxes can do to several at once. The left column is in +layout.svelte.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const person = await requireMail(event);
	const context = mailContext();
	const requested = event.url.searchParams.get('view');
	const view = isInboxView(requested) ? requested : 'inbox';
	const folder = event.url.searchParams.get('folder');
	const tag = event.url.searchParams.get('tag');
	const search = event.url.searchParams.get('q')?.trim().slice(0, 200) || null;
	const page = Math.max(0, Number(event.url.searchParams.get('page') ?? '0') || 0);
	// One inbox, when the left column chose one (the list only ever shows the person's own inboxes).
	const inbox = event.url.searchParams.get('inbox');
	const list = await listThreads(context, { view, personIdentifier: person.identifier, folder, tag, search, inbox, page });
	// Mail that could not be filed after every try (site/MAIL.md, "When something fails"), for whoever manages mail.
	const stuck = can(person, 'manage-mail') ? await stuckArrivals(context).catch((problem: unknown) => {
				if (!isMissingTable(problem)) reportHere(problem, { code: 'mail.stuck', place: '/workspace/inbox' });
				return [];
			}) : [];
	return { view, folder, tag, search, inbox, page, ...list, stuck };
};

/** The bulk operation a toolbar button names: "archive", "read", "move:<folder>", "tag:<tag>" and the like. */
function operationOf(value: string | null): BulkOperation | null {
	if (!value) return null;
	if (value === 'read' || value === 'unread') return { kind: 'read', read: value === 'read' };
	if (isBuiltInFolder(value)) return { kind: 'move', place: value };
	const [kind, target] = [value.slice(0, value.indexOf(':')), value.slice(value.indexOf(':') + 1)];
	if (!target) return null;
	if (kind === 'move') return { kind: 'move', place: target };
	if (kind === 'tag' || kind === 'untag') return { kind: 'tag', tag: target, on: kind === 'tag' };
	return null;
}

const doneWords: Record<string, string> = {
	inbox: 'Moved to the inbox',
	archive: 'Archived',
	spam: 'Marked as spam',
	trash: 'Deleted',
	read: 'Marked read',
	unread: 'Marked unread'
};

export const actions: Actions = {
	fileAgain: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const count = await tryStuckArrivalsAgain(mailContext(), person.identifier);
		return { done: count === 1 ? 'The message will be tried again within five minutes.' : `The ${count} messages will be tried again within five minutes.` };
	},
	bulk: async (event) => {
		const person = await requireMail(event);
		const form = await event.request.formData();
		const threads = form.getAll('thread').filter((value): value is string => typeof value === 'string');
		// The "Move to" and "Tag" menus send their choice in their own field, so one form can hold every button.
		const chosen = formText(form, 'do', 200);
		const value = chosen === 'move' ? `move:${formText(form, 'moveTo', 100) ?? ''}` : chosen === 'tag' ? formText(form, 'tagWith', 120) : chosen;
		const operation = operationOf(value);
		if (threads.length === 0) return fail(400, { problem: 'Tick the conversations first.' });
		if (!operation) return fail(400, { problem: 'Choose what to do with them.' });
		const changed = await changeMany(mailContext(), person.identifier, threads, operation);
		const what = value && doneWords[value] ? doneWords[value] : operation.kind === 'move' ? 'Moved' : operation.kind === 'tag' ? (operation.on ? 'Tagged' : 'Untagged') : 'Changed';
		return { done: `${what}: ${changed} conversation${changed === 1 ? '' : 's'}.` };
	}
};
