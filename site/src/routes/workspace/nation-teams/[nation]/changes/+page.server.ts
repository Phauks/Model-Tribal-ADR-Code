import { fail } from '@sveltejs/kit';
import { changeProblem, describeChange, type ChangeContent } from '#lib/nation-page-changes.ts';
import { readableDate } from '#lib/readable-date.ts';
import { changeByIdentifier, historyOf, liveChanges, publishChange } from '#lib/server/nation-page-changes.ts';
import { pauseProblem } from '#lib/nation-page-review.ts';
import { currentPause, undoneChanges } from '#lib/server/nation-page-review.ts';
import { nationAndGranter } from '#lib/server/nation-team-access.ts';
import { formText } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

/**
 * The private history of a nation's page: every version its team published,
 * and every change cancelled before it went live. Only the nation's team and
 * the project see it; nation pages never get a public history, so a version
 * the nation took down stays down (decision record 0041).
 */
export const load: PageServerLoad = async (event) => {
	const { nation, granter, database } = await nationAndGranter(event);
	const time = new Date().toISOString();
	const live = await liveChanges(database, nation.identifier, time);
	const liveIdentifiers = new Set(Object.values(live).map((change) => change.identifier));
	const history = await historyOf(database, nation.identifier);
	const undone = await undoneChanges(database, nation.identifier);
	const paused = Boolean(await currentPause(database, nation.identifier));
	return {
		nation: { identifier: nation.identifier, title: nation.title, page: nation.page },
		paused,
		versions: history.map((change) => {
			const state: 'live' | 'waiting' | 'replaced' | 'cancelled' | 'undone' =
				undone.has(change.identifier)
					? 'undone'
					: change.status === 'discarded'
					? 'cancelled'
					: liveIdentifiers.has(change.identifier)
						? 'live'
						: (change.liveAt ?? '') > time
							? 'waiting'
							: 'replaced';
			return {
				identifier: change.identifier,
				kind: change.kind,
				content: change.content as ChangeContent,
				summary: describeChange(change.kind, change.content),
				credit: change.credit,
				state,
				writtenByName: change.writtenByName,
				publishedByName: change.publishedByName,
				approvedByName: change.approvedByName,
				publishedAt: change.publishedAt,
				liveAt: change.liveAt,
				restoredFrom: change.restoredFrom,
				projectNote: undone.get(change.identifier) ?? null,
				canRestore: state === 'replaced' && !changeProblem(granter, change.kind, 'publish') && !pauseProblem(paused, change.kind)
			};
		})
	};
};

export const actions: Actions = {
	restore: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		const form = await event.request.formData();
		const change = await changeByIdentifier(database, formText(form, 'change', 40) ?? '');
		if (!change || change.nationIdentifier !== nation.identifier || change.status !== 'published') {
			return fail(404, { problem: 'That version cannot be restored.' });
		}
		const problem = changeProblem(granter, change.kind, 'publish');
		if (problem) {
			event.locals.refused = `nation page restore refused on nation ${nation.identifier}: ${problem}`;
			return fail(403, { problem });
		}
		const paused = pauseProblem(Boolean(await currentPause(database, nation.identifier)), change.kind);
		if (paused) return fail(409, { problem: paused });
		const result = await publishChange(
			database,
			{ nationIdentifier: nation.identifier, kind: change.kind, content: change.content, credit: change.credit, restoredFrom: change.identifier },
			person
		);
		return {
			done:
				result.liveAt > new Date().toISOString()
					? `Restored. Contacts wait, so it goes live on ${readableDate(result.liveAt.slice(0, 10))} unless another editor approves it sooner.`
					: 'Restored. It is on the page now.'
		};
	}
};
