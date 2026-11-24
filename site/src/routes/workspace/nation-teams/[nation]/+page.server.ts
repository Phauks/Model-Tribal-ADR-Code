import { fail, redirect } from '@sveltejs/kit';
import {
	canManageTeam,
	dateAsTermEnd,
	describeParts,
	endProblem,
	longestTerm,
	pageParts,
	placeProblem,
	teamLevelLabels,
	teamLevels,
	termEnd,
	usualTerm,
	type PagePart,
	type TeamLevel
} from '#lib/nation-teams.ts';
import { isAdministrator } from '#lib/permissions.ts';
import {
	addPlace,
	endPlace,
	placeByIdentifier,
	suspendWithEveryoneAdded,
	teamActivity,
	teamOf
} from '#lib/server/nation-teams.ts';
import { nationAndGranter } from '#lib/server/nation-team-access.ts';
import { formText, refuse } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { nation, granter, database, person } = await nationAndGranter(event);
	return {
		nation: { identifier: nation.identifier, title: nation.title, page: nation.page },
		team: await teamOf(database, nation.identifier),
		activity: await teamActivity(database, nation.identifier),
		own: { level: granter.level ?? null, parts: granter.parts ?? null, personIdentifier: person.identifier },
		canManage: canManageTeam(granter),
		isAdministrator: granter.isAdministrator,
		usualEnds: Object.fromEntries(teamLevels.map((level) => [level, termEnd(usualTerm[level]).slice(0, 10)])),
		// The terms offered in the Until list; "Another date" opens a date field.
		terms: [
			{ label: '6 months', end: termEnd(183).slice(0, 10) },
			{ label: '1 year', end: termEnd(365).slice(0, 10) },
			{ label: '2 years', end: termEnd(731).slice(0, 10) }
		],
		// The latest end date any level allows; the server checks each level's own limit.
		latestEnd: termEnd(Math.max(...Object.values(longestTerm))).slice(0, 10)
	};
};

export const actions: Actions = {
	add: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		if (!canManageTeam(granter)) refuse(event, `not a steward of nation ${nation.identifier}`);
		const form = await event.request.formData();
		const email = formText(form, 'email', 320);
		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(400, { problem: 'Give their email address.' });
		const displayName = formText(form, 'name', 200);
		if (!displayName) return fail(400, { problem: 'Give their name.' });
		const level = formText(form, 'level') as TeamLevel | null;
		if (!level || !teamLevels.includes(level)) return fail(400, { problem: 'Choose a level.' });
		// "whole", one part as "part:<part>", or "parts" with the parts ticked.
		const scope = formText(form, 'scope') ?? 'whole';
		const parts = scope.startsWith('part:')
			? [scope.slice('part:'.length)].filter((part): part is PagePart => pageParts.includes(part as PagePart))
			: scope === 'parts'
				? form.getAll('parts').filter((part): part is PagePart => pageParts.includes(part as PagePart))
				: null;
		const expiresAt = dateAsTermEnd(formText(form, 'expires', 10));
		if (!expiresAt) return fail(400, { problem: 'Give the end date as a date.' });
		const problem = placeProblem(granter, { level, parts, expiresAt });
		if (problem) {
			event.locals.refused = `team place refused on nation ${nation.identifier}: ${problem}`;
			return fail(403, { problem });
		}
		const result = await addPlace(
			database,
			{
				nationIdentifier: nation.identifier,
				email,
				displayName,
				level,
				parts,
				office: formText(form, 'office', 300),
				expiresAt,
				basis: null,
				addedByProject: false
			},
			person
		);
		if (result.outcome === 'removed-person') {
			return fail(400, { problem: 'This person cannot be added. Ask the project if you think that is wrong.' });
		}
		return {
			done: `${displayName} is now ${teamLevelLabels[level].toLocaleLowerCase('en-US')} for ${describeParts(parts)}. ${
				result.invited
					? 'They get access when they sign in with that email address.'
					: 'They have access now.'
			}`
		};
	},

	end: async (event) => {
		const { nation, granter, database, person } = await nationAndGranter(event);
		const form = await event.request.formData();
		const place = await placeByIdentifier(database, formText(form, 'place', 40) ?? '');
		if (!place || place.nationIdentifier !== nation.identifier) return fail(404, { problem: 'That place has already ended.' });
		const problem = endProblem(granter, place);
		if (problem) {
			event.locals.refused = `team change refused on nation ${nation.identifier}: ${problem}`;
			return fail(403, { problem });
		}
		const leaving = place.personIdentifier === person.identifier;
		await endPlace(database, place, person, leaving ? 'left' : 'ended');
		// Someone who left can no longer see this page.
		if (leaving && !isAdministrator(person)) redirect(303, '/workspace');
		return { done: `${place.personName}’s place has ended.` };
	},

	suspend: async (event) => {
		const { nation, database, person } = await nationAndGranter(event);
		if (!isAdministrator(person)) refuse(event, 'only the lead author suspends people from a nation’s team');
		const form = await event.request.formData();
		const place = await placeByIdentifier(database, formText(form, 'place', 40) ?? '');
		if (!place || place.nationIdentifier !== nation.identifier) return fail(404, { problem: 'That place has already ended.' });
		const names = await suspendWithEveryoneAdded(database, place, person);
		return { done: `Suspended: ${names.join(', ')}.` };
	}
};
