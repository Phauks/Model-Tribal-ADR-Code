import { fail, redirect } from '@sveltejs/kit';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { applyRuleToInbox, previewRule, RuleError, saveRule, type RuleInput } from '#lib/server/mail/rules.ts';
import { assignablePeople } from '#lib/server/mail/store.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import { ruleFromForm } from '../rule-form.ts';
import type { Actions, PageServerLoad } from './$types';

// A new auto-sort rule. "?from=" starts it with "Sender contains" that address,
// from the link on a conversation.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-mail');
	const from = event.url.searchParams.get('from')?.trim().slice(0, 200) ?? '';
	const draft: RuleInput = {
		name: from ? `Mail from ${from}` : '',
		enabled: true,
		matchAll: true,
		conditions: from ? [{ field: 'from', operator: 'contains', value: from }] : [],
		actions: [],
		stopAfter: false
	};
	return { draft, people: await assignablePeople(mailContext(), ['lead-author']) };
};

export const actions: Actions = {
	save: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const values = ruleFromForm(form);
		const context = mailContext();
		let sorted = 0;
		try {
			const identifier = await saveRule(context, person.identifier, values, null);
			if (form.get('applyNow') === 'yes') sorted = await applyRuleToInbox(context, person.identifier, identifier);
		} catch (problem) {
			if (problem instanceof RuleError) return fail(400, { problem: problem.message, values });
			throw problem;
		}
		redirect(303, `/workspace/inbox/rules?made=${sorted}`);
	},
	test: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const values = ruleFromForm(await event.request.formData());
		try {
			return { preview: await previewRule(mailContext(), values, person.identifier), values };
		} catch (problem) {
			if (problem instanceof RuleError) return fail(400, { problem: problem.message, values });
			throw problem;
		}
	}
};
