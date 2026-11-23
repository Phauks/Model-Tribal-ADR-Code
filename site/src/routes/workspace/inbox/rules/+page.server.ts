import { fail } from '@sveltejs/kit';
import { mailContext } from '#lib/server/mail/runtime.ts';
import { applyRuleToInbox, deleteRule, listRules, moveRule, RuleError, setRuleEnabled } from '#lib/server/mail/rules.ts';
import { assignablePeople } from '#lib/server/mail/store.ts';
import { formText, requirePermission } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

// Auto-sort rules for the project inbox (site/MAIL.md, "Folders, tags and rules").
export const prerender = false;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-mail');
	const context = mailContext();
	return { rules: await listRules(context), people: await assignablePeople(context, ['lead-author']) };
};

export const actions: Actions = {
	toggle: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const rule = formText(form, 'rule', 100);
		if (rule) await setRuleEnabled(mailContext(), person.identifier, rule, form.get('enabled') === 'yes');
		return { done: form.get('enabled') === 'yes' ? 'The rule is on.' : 'The rule is off.' };
	},
	move: async (event) => {
		requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const rule = formText(form, 'rule', 100);
		if (rule) await moveRule(mailContext(), rule, form.get('direction') === 'up' ? 'up' : 'down');
		return { done: 'Changed the order.' };
	},
	apply: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const rule = formText(form, 'rule', 100);
		if (!rule) return fail(400, { problem: 'Choose a rule.' });
		try {
			const sorted = await applyRuleToInbox(mailContext(), person.identifier, rule);
			return { done: sorted ? `Sorted ${sorted} conversation${sorted === 1 ? '' : 's'} from the inbox.` : 'Nothing in the inbox matches this rule.' };
		} catch (problem) {
			if (problem instanceof RuleError) return fail(400, { problem: problem.message });
			throw problem;
		}
	},
	delete: async (event) => {
		const person = requirePermission(event, 'manage-mail');
		const form = await event.request.formData();
		const rule = formText(form, 'rule', 100);
		if (rule) await deleteRule(mailContext(), person.identifier, rule);
		return { done: 'Deleted the rule.' };
	}
};
