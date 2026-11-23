import { error, fail, redirect } from '@sveltejs/kit';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { applyRuleToInbox, getRule, previewRule, RuleError, saveRule } from '#lib/server/mail/rules.ts';
import { assignablePeople } from '#lib/server/mail/store.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import { ruleFromForm } from '../rule-form.ts';
import type { Actions, PageServerLoad } from './$types';

// Changing one auto-sort rule.
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-mail');
	const context = mailContext();
	const rule = await getRule(context, event.params.rule);
	if (!rule) error(404, 'There is no such rule.');
	return {
		rule,
		draft: { name: rule.name, enabled: rule.enabled, matchAll: rule.matchAll, conditions: rule.conditions, actions: rule.actions, stopAfter: rule.stopAfter },
		people: await assignablePeople(context, ['lead-author'])
	};
};

export const actions: Actions = {
	save: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const values = ruleFromForm(form);
		const context = mailContext();
		let sorted = 0;
		try {
			await saveRule(context, person.identifier, values, event.params.rule);
			if (form.get('applyNow') === 'yes') sorted = await applyRuleToInbox(context, person.identifier, event.params.rule);
		} catch (problem) {
			if (problem instanceof RuleError) return fail(400, { problem: problem.message, values });
			throw problem;
		}
		redirect(303, `/workspace/inbox/rules?saved=${sorted}`);
	},
	test: async (event) => {
		requirePermission(event, 'manage-mail');
		const values = ruleFromForm(await event.request.formData());
		try {
			return { preview: await previewRule(mailContext(), values), values };
		} catch (problem) {
			if (problem instanceof RuleError) return fail(400, { problem: problem.message, values });
			throw problem;
		}
	}
};
