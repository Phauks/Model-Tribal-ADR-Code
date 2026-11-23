/**
 * Reading and changing the nonprofit corporation's record in D1
 * (migrations/20261123T0440_add_nonprofit_records.sql). The rules for what is due are in
 * src/lib/nonprofit.ts; this file only stores facts, completions and tasks.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	cleanFact,
	factNames,
	isDay,
	nextYear,
	type Completion,
	type FactName,
	type Facts,
	type Task
} from '#lib/nonprofit.ts';
import { newIdentifier, now } from './identifiers.ts';

export async function readFacts(database: D1Database): Promise<Facts> {
	const { results } = await database.prepare('SELECT name, value FROM nonprofit_facts').all<{ name: string; value: string }>();
	const facts: Facts = {};
	for (const row of results) {
		if ((factNames as readonly string[]).includes(row.name)) facts[row.name as FactName] = row.value;
	}
	return facts;
}

/**
 * Saves the submitted facts. Returns the names of any that were not valid,
 * and saves none of them in that case, so a typo never half-saves the form.
 */
export async function saveFacts(
	database: D1Database,
	submitted: Partial<Record<FactName, string>>,
	personIdentifier: string
): Promise<{ ok: true; changed: number } | { ok: false; invalid: FactName[] }> {
	const cleaned: [FactName, string][] = [];
	const invalid: FactName[] = [];
	for (const name of factNames) {
		const value = submitted[name];
		if (value === undefined) continue;
		const clean = cleanFact(name, value);
		if (clean === undefined) invalid.push(name);
		else cleaned.push([name, clean]);
	}
	if (invalid.length > 0) return { ok: false, invalid };
	const current = await readFacts(database);
	const changes = cleaned.filter(([name, value]) => (current[name] ?? '') !== value);
	if (changes.length === 0) return { ok: true, changed: 0 };
	const at = now();
	await database.batch(
		changes.map(([name, value]) =>
			value === ''
				? database.prepare('DELETE FROM nonprofit_facts WHERE name = ?').bind(name)
				: database
						.prepare(
							`INSERT INTO nonprofit_facts (name, value, changed_by, changed_at) VALUES (?, ?, ?, ?)
							 ON CONFLICT (name) DO UPDATE SET value = excluded.value, changed_by = excluded.changed_by, changed_at = excluded.changed_at`
						)
						.bind(name, value, personIdentifier, at)
		)
	);
	return { ok: true, changed: changes.length };
}

export async function readCompletions(database: D1Database): Promise<Completion[]> {
	const { results } = await database
		.prepare(
			`SELECT nonprofit_completions.obligation, nonprofit_completions.period, nonprofit_completions.done_on AS doneOn,
				nonprofit_completions.reference, nonprofit_completions.note, people.display_name AS recordedByName
			 FROM nonprofit_completions LEFT JOIN people ON people.identifier = nonprofit_completions.recorded_by
			 ORDER BY nonprofit_completions.done_on`
		)
		.all<Completion>();
	return results;
}

const obligationPattern = /^[a-z0-9:-]{1,80}$/;

export async function recordCompletion(
	database: D1Database,
	entry: { obligation: string; period: string; doneOn: string; reference: string | null; note: string | null },
	personIdentifier: string
): Promise<{ ok: true } | { ok: false; problem: string }> {
	if (!obligationPattern.test(entry.obligation)) return { ok: false, problem: 'That item is not on the list.' };
	if (entry.period !== 'once' && !isDay(entry.period)) return { ok: false, problem: 'That period is not on the list.' };
	if (!isDay(entry.doneOn)) return { ok: false, problem: 'Give the date it was done.' };
	await database
		.prepare(
			`INSERT INTO nonprofit_completions (identifier, obligation, period, done_on, reference, note, recorded_by, recorded_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (obligation, period) DO UPDATE SET done_on = excluded.done_on, reference = excluded.reference,
				note = excluded.note, recorded_by = excluded.recorded_by, recorded_at = excluded.recorded_at`
		)
		.bind(newIdentifier(), entry.obligation, entry.period, entry.doneOn, entry.reference, entry.note, personIdentifier, now())
		.run();
	return { ok: true };
}

export async function undoCompletion(database: D1Database, obligation: string, period: string): Promise<void> {
	await database.prepare('DELETE FROM nonprofit_completions WHERE obligation = ? AND period = ?').bind(obligation, period).run();
}

interface TaskRow {
	identifier: string;
	title: string;
	notes: string | null;
	dueOn: string | null;
	repeatsYearly: number;
	doneOn: string | null;
}

export async function readTasks(database: D1Database): Promise<Task[]> {
	const { results } = await database
		.prepare(
			`SELECT identifier, title, notes, due_on AS dueOn, repeats_yearly AS repeatsYearly, done_on AS doneOn
			 FROM nonprofit_tasks ORDER BY done_on IS NOT NULL, due_on IS NULL, due_on, created_at`
		)
		.all<TaskRow>();
	return results.map((row) => ({ ...row, repeatsYearly: row.repeatsYearly === 1 }));
}

export async function addTask(
	database: D1Database,
	task: { title: string; notes: string | null; dueOn: string | null; repeatsYearly: boolean },
	personIdentifier: string
): Promise<{ ok: true } | { ok: false; problem: string }> {
	const title = task.title.trim();
	if (!title || title.length > 300) return { ok: false, problem: 'Give the to-do a short title.' };
	if (task.dueOn && !isDay(task.dueOn)) return { ok: false, problem: 'The due date is not a date.' };
	if (task.repeatsYearly && !task.dueOn) return { ok: false, problem: 'A to-do that repeats every year needs a due date.' };
	await database
		.prepare(
			`INSERT INTO nonprofit_tasks (identifier, title, notes, due_on, repeats_yearly, created_by, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(newIdentifier(), title, task.notes, task.dueOn, task.repeatsYearly ? 1 : 0, personIdentifier, now())
		.run();
	return { ok: true };
}

/**
 * Marks a to-do done. One that repeats every year keeps its row and moves to
 * next year's date; the completion is kept as 'task:<identifier>'.
 */
export async function finishTask(
	database: D1Database,
	identifier: string,
	doneOn: string,
	personIdentifier: string
): Promise<{ ok: true } | { ok: false; problem: string }> {
	if (!isDay(doneOn)) return { ok: false, problem: 'Give the date it was done.' };
	const task = (await readTasks(database)).find((item) => item.identifier === identifier);
	if (!task) return { ok: false, problem: 'That to-do is not on the list.' };
	if (task.repeatsYearly && task.dueOn) {
		await database.batch([
			database
				.prepare(
					`INSERT INTO nonprofit_completions (identifier, obligation, period, done_on, reference, note, recorded_by, recorded_at)
					 VALUES (?, ?, ?, ?, NULL, ?, ?, ?) ON CONFLICT (obligation, period) DO NOTHING`
				)
				.bind(newIdentifier(), `task:${task.identifier}`, task.dueOn, doneOn, task.title, personIdentifier, now()),
			database.prepare('UPDATE nonprofit_tasks SET due_on = ? WHERE identifier = ?').bind(nextYear(task.dueOn), task.identifier)
		]);
	} else {
		await database.prepare('UPDATE nonprofit_tasks SET done_on = ? WHERE identifier = ?').bind(doneOn, task.identifier).run();
	}
	return { ok: true };
}

export async function reopenTask(database: D1Database, identifier: string): Promise<void> {
	await database.prepare('UPDATE nonprofit_tasks SET done_on = NULL WHERE identifier = ?').bind(identifier).run();
}

export async function removeTask(database: D1Database, identifier: string): Promise<void> {
	await database.prepare('DELETE FROM nonprofit_tasks WHERE identifier = ?').bind(identifier).run();
}
