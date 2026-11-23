import { fail } from '@sveltejs/kit';
import { inboxViews, isInboxView, labelColors, type LabelColor } from '#lib/mail.ts';
import { can } from '#lib/permissions.ts';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { createLabel, deleteLabel, listLabels, listThreads, viewCounts } from '#lib/server/mail/store.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// The project inbox (site/MAIL.md): the views in the left column, labels,
// search, and one page of conversations.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'read-mail');
	const context = mailContext();
	const requested = event.url.searchParams.get('view');
	const view = isInboxView(requested) ? requested : 'inbox';
	const label = event.url.searchParams.get('label');
	const search = event.url.searchParams.get('q')?.trim().slice(0, 200) || null;
	const page = Math.max(0, Number(event.url.searchParams.get('page') ?? '0') || 0);
	const [list, counts, labels] = await Promise.all([
		listThreads(context, { view, personIdentifier: person.identifier, label, search, page }),
		viewCounts(context, person.identifier),
		listLabels(context)
	]);
	return {
		views: inboxViews,
		view,
		label,
		search,
		page,
		...list,
		counts,
		labels,
		emailOn: context.settings.domain !== null,
		canManage: can(person, 'manage-mail')
	};
};

export const actions: Actions = {
	makeLabel: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const name = formText(form, 'name', 60);
		const color = formText(form, 'color', 20) as LabelColor | null;
		if (!name) return fail(400, { problem: 'Give the label a name.' });
		await createLabel(mailContext(), person.identifier, name, color && labelColors.includes(color) ? color : labelColors[0]);
		return { done: `Made the label “${name}”.` };
	},
	removeLabel: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const label = formText(form, 'label', 100);
		if (label) await deleteLabel(mailContext(), person.identifier, label);
		return { done: 'Removed the label.' };
	}
};
