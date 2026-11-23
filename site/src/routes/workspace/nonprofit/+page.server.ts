import { fail } from '@sveltejs/kit';
import {
	factFields,
	factNames,
	nevadaToday,
	occurrencesFor,
	setupDoneByFact,
	setupSteps,
	stageOf,
	taskState,
	type FactName
} from '#lib/nonprofit.ts';
import {
	addTask,
	finishTask,
	readCompletions,
	readFacts,
	readTasks,
	recordCompletion,
	removeTask,
	reopenTask,
	saveFacts,
	undoCompletion
} from '#lib/server/nonprofit.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-nonprofit');
	const { database } = storage(event);
	const today = nevadaToday();
	// Until the nonprofit migration (20261123T0440_add_nonprofit_records) is applied the tables are missing: say so instead of failing.
	const stored = await Promise.all([readFacts(database), readCompletions(database), readTasks(database)]).catch(() => undefined);
	const notReady = stored === undefined;
	const [facts, completions, tasks] = stored ?? [{}, [], []];
	const byFact = setupDoneByFact(facts);
	const occurrences = occurrencesFor(facts, completions, today);
	return {
		notReady,
		today,
		facts,
		factFields,
		stage: stageOf(facts),
		occurrences,
		nextOpen: occurrences.find((item) => item.state !== 'done') ?? null,
		setup: setupSteps.map((step) => {
			const completion = completions.find((entry) => entry.obligation === step.key && entry.period === 'once') ?? null;
			return { ...step, completion, doneByFact: byFact[step.key] ?? null };
		}),
		tasks: tasks.map((task) => ({ ...task, state: taskState(task, today) }))
	};
};

function problem(message: string) {
	return fail(400, { problem: message });
}

export const actions: Actions = {
	facts: async (event) => {
		const person = requirePermission(event, 'manage-nonprofit');
		const { database } = storage(event);
		const form = await event.request.formData();
		const submitted: Partial<Record<FactName, string>> = {};
		for (const name of factNames) {
			const value = form.get(name);
			if (typeof value === 'string') submitted[name] = value;
		}
		const result = await saveFacts(database, submitted, person.identifier);
		if (!result.ok) {
			const labels = result.invalid.map((name) => factFields.find((field) => field.name === name)?.label ?? name);
			return problem(`Nothing was saved. Check: ${labels.join(', ')}.`);
		}
		return { done: result.changed === 0 ? 'Nothing had changed.' : `Saved ${result.changed} ${result.changed === 1 ? 'change' : 'changes'}.` };
	},

	complete: async (event) => {
		const person = requirePermission(event, 'manage-nonprofit');
		const { database } = storage(event);
		const form = await event.request.formData();
		const result = await recordCompletion(
			database,
			{
				obligation: formText(form, 'obligation', 80) ?? '',
				period: formText(form, 'period', 40) ?? '',
				doneOn: formText(form, 'doneOn', 10) ?? '',
				reference: formText(form, 'reference', 200),
				note: formText(form, 'note', 2000)
			},
			person.identifier
		);
		return result.ok ? { done: 'Marked done.' } : problem(result.problem);
	},

	undo: async (event) => {
		requirePermission(event, 'manage-nonprofit');
		const { database } = storage(event);
		const form = await event.request.formData();
		await undoCompletion(database, formText(form, 'obligation', 80) ?? '', formText(form, 'period', 40) ?? '');
		return { done: 'Marked not done.' };
	},

	addTask: async (event) => {
		const person = requirePermission(event, 'manage-nonprofit');
		const { database } = storage(event);
		const form = await event.request.formData();
		const result = await addTask(
			database,
			{
				title: formText(form, 'title', 300) ?? '',
				notes: formText(form, 'notes', 4000),
				dueOn: formText(form, 'dueOn', 10),
				repeatsYearly: form.get('repeatsYearly') === 'on'
			},
			person.identifier
		);
		return result.ok ? { done: 'To-do added.' } : problem(result.problem);
	},

	finishTask: async (event) => {
		const person = requirePermission(event, 'manage-nonprofit');
		const { database } = storage(event);
		const form = await event.request.formData();
		const result = await finishTask(database, formText(form, 'task', 80) ?? '', formText(form, 'doneOn', 10) ?? nevadaToday(), person.identifier);
		return result.ok ? { done: 'To-do marked done.' } : problem(result.problem);
	},

	reopenTask: async (event) => {
		requirePermission(event, 'manage-nonprofit');
		const { database } = storage(event);
		const form = await event.request.formData();
		await reopenTask(database, formText(form, 'task', 80) ?? '');
		return { done: 'To-do opened again.' };
	},

	removeTask: async (event) => {
		requirePermission(event, 'manage-nonprofit');
		const { database } = storage(event);
		const form = await event.request.formData();
		await removeTask(database, formText(form, 'task', 80) ?? '');
		return { done: 'To-do removed.' };
	}
};
