import { fail } from '@sveltejs/kit';
import { readSettings, restrictionProblem, settingsChanges, tidySettings } from '#lib/nation-restrictions.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import { answerProject, currentSettings, restrictableList, saveByIdentifier, saveSettings, savesOf } from '#lib/server/nation-restrictions.ts';
import { nationAndGranter } from '#lib/server/nation-team-access.ts';
import { formText } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * What the site shows of a nation's own laws and its courts' opinions
 * (design/nation-restrictions/, approved by Trevor on Nov. 24, 2026;
 * src/lib/nation-restrictions.ts). Everyone on the team sees it; editors
 * and stewards for the whole page change it. A save is in force at once,
 * and the project reads it afterwards.
 */
export const load: PageServerLoad = async (event) => {
	const { nation, granter, database } = await nationAndGranter(event);
	const list = await restrictableList(nation.identifier, event.url, event.fetch, workerEnvironment().ASSETS);
	const settings = await currentSettings(database, nation.identifier);
	const saves = await savesOf(database, nation.identifier);
	const asked = saves.find((save) => save.question && !save.answer);
	return {
		nation: { identifier: nation.identifier, title: nation.title, page: nation.page },
		items: list.items,
		settings,
		canChange: !restrictionProblem(granter),
		question: asked ? { save: asked.identifier, text: asked.question ?? '', askedAt: asked.askedAt ?? '' } : null,
		activity: saves.map((save) => ({
			identifier: save.identifier,
			madeAt: save.madeAt,
			madeByName: save.madeByName,
			changes: save.changes,
			readAt: save.readAt
		}))
	};
};

export const actions: Actions = {
	save: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		const problem = restrictionProblem(granter);
		if (problem) {
			event.locals.refused = `laws and cases refused on nation ${nation.identifier}: ${problem}`;
			return fail(403, { problem });
		}
		const form = await event.request.formData();
		let raw: unknown;
		try {
			raw = JSON.parse(formText(form, 'settings', 400_000) ?? '{}');
		} catch {
			return fail(400, { problem: 'The choices could not be read. Reload the page and try again.' });
		}
		const list = await restrictableList(nation.identifier, event.url, event.fetch, workerEnvironment().ASSETS);
		const before = await currentSettings(database, nation.identifier);
		const after = tidySettings(readSettings(raw), list.items);
		const changes = settingsChanges(before, after, list.items);
		if (changes.length === 0) return { done: 'Nothing changed.' };
		await saveSettings(database, nation.identifier, after, changes, formText(form, 'note', 2000), person);
		return { done: 'Saved. The site shows the change within minutes.' };
	},
	answer: async (event) => {
		const { nation, database, person } = await nationAndGranter(event);
		const form = await event.request.formData();
		const save = await saveByIdentifier(database, formText(form, 'save', 40) ?? '');
		const answer = formText(form, 'answer', 4000);
		if (!save || save.nationIdentifier !== nation.identifier || !save.question) return fail(404, { problem: 'That question cannot be answered.' });
		if (!answer) return fail(400, { problem: 'Write an answer first.' });
		await answerProject(database, save, answer, person);
		return { done: 'Your answer was sent to the project.' };
	}
};
