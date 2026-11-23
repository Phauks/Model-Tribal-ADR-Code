import { error, fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { can, roles, type Role } from '#lib/permissions.ts';
import { creditSections, fullName, type CreditSection } from '#lib/contributors.ts';
import {
	decideProfile,
	giveWorkspaceAccess,
	profileByIdentifier,
	profileVersions,
	setCreditSection,
	type Decision
} from '#lib/server/contributor-profiles.ts';
import { eventsFor } from '#lib/server/events.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

const nations = reviewSubjects
	.filter((subject) => subject.kind === 'nation')
	.map((subject) => ({ identifier: subject.identifier, title: subject.title }));

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'read-contributors');
	const { database } = storage(event);
	const profile = await profileByIdentifier(database, event.params.identifier);
	// A draft is private to the person until they send it.
	if (!profile || profile.status === 'draft') error(404, 'There is no such registration.');
	const [versions, history] = await Promise.all([
		profileVersions(database, profile.identifier),
		eventsFor(database, 'profile', profile.identifier)
	]);
	return {
		profile,
		versions: versions.map(({ version, creditLine, confirmedAt }) => ({ version, creditLine, confirmedAt })),
		history,
		canManage: can(person, 'manage-contributors'),
		nations
	};
};

async function loadProfile(event: Parameters<Actions[string]>[0]) {
	const person = requirePermission(event, 'manage-contributors');
	const { database } = storage(event);
	const profile = await profileByIdentifier(database, event.params.identifier);
	if (!profile || profile.status === 'draft') error(404, 'There is no such registration.');
	return { person, database, profile };
}

export const actions: Actions = {
	decide: async (event) => {
		const { person, database, profile } = await loadProfile(event);
		const form = await event.request.formData();
		const decision = formText(form, 'decision') as Decision | null;
		if (decision !== 'welcomed' && decision !== 'declined') return fail(400, { problem: 'Choose signed up or removed.' });
		const note = formText(form, 'note', 2000);
		if (decision === 'declined' && !note) {
			return fail(400, { problem: 'Give the person a reason when removing them; they see it on their profile.' });
		}
		await decideProfile(database, profile, decision, note, person);
		return { done: decision === 'welcomed' ? 'Signed up.' : 'Removed. The person sees the reason on their profile.' };
	},

	section: async (event) => {
		const { person, database, profile } = await loadProfile(event);
		const form = await event.request.formData();
		const value = formText(form, 'section');
		const section = value && (creditSections as readonly string[]).includes(value) ? (value as CreditSection) : null;
		await setCreditSection(database, profile, section, person);
		return { done: 'Credit section saved.' };
	},

	access: async (event) => {
		const { person, database, profile } = await loadProfile(event);
		if (profile.personIdentifier) return fail(400, { problem: 'This person already has workspace access.' });
		const form = await event.request.formData();
		const role = formText(form, 'role') as Role | null;
		if (!role || !roles.includes(role)) return fail(400, { problem: 'Choose a role.' });
		const nationIdentifier = role === 'nation-reviewer' ? formText(form, 'nationIdentifier') : null;
		if (role === 'nation-reviewer' && !nations.some((nation) => nation.identifier === nationIdentifier)) {
			return fail(400, { problem: 'Choose the nation this person reviews for.' });
		}
		const outcome = await giveWorkspaceAccess(
			database,
			profile,
			{ role, nationIdentifier, displayName: fullName(profile.answers) || profile.email },
			person
		);
		if (outcome === 'email-in-use') {
			return fail(400, { problem: 'This email address is already on the People list. Change that person’s role there.' });
		}
		return { done: 'Access given. It starts at once; the person sees the workspace next time they open it.' };
	}
};
