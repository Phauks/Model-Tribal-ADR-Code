// Reading the rule editor's form (RuleEditor.svelte) into a rule. Each
// condition and action row sends its fields under the same names, so the
// values line up by position.
import type { RuleAction, RuleActionKind, RuleCondition, RuleField, RuleOperator } from '#lib/mail.ts';
import type { RuleInput } from '#lib/server/mail/rules.ts';

function all(form: FormData, name: string): string[] {
	return form.getAll(name).map((value) => (typeof value === 'string' ? value.normalize('NFC') : ''));
}

export function ruleFromForm(form: FormData): RuleInput {
	const fields = all(form, 'condition-field');
	const operators = all(form, 'condition-operator');
	const values = all(form, 'condition-value');
	const conditions: RuleCondition[] = fields.map((field, index) => ({
		field: field as RuleField,
		operator: (operators[index] ?? 'contains') as RuleOperator,
		value: values[index] ?? ''
	}));
	const kinds = all(form, 'action-kind');
	const targets = all(form, 'action-value');
	const actions: RuleAction[] = kinds.map((kind, index) => ({ action: kind as RuleActionKind, value: targets[index] ?? '' }));
	return {
		name: String(form.get('name') ?? ''),
		enabled: form.get('enabled') === 'yes',
		matchAll: form.get('match') !== 'any',
		conditions,
		actions,
		stopAfter: form.get('stopAfter') === 'yes'
	};
}
