import { fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { roles, type Role } from '#lib/permissions.ts';
import {
	changeRole,
	countLeadAuthors,
	invitePerson,
	listPeople,
	personByEmail,
	personByIdentifier,
	setRemoved
} from '#lib/server/people.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

const nations = reviewSubjects
	.filter((subject) => subject.kind === 'nation')
	.map((subject) => ({ identifier: subject.identifier, title: subject.title }));

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-people');
	const { database } = storage(event);
	const history = await database
		.prepare(
			`SELECT events.identifier, events.action, events.note, events.created_at AS createdAt,
			        actor.display_name AS actorName, target.display_name AS targetName
			 FROM events
			 LEFT JOIN people AS actor ON actor.identifier = events.person_identifier
			 LEFT JOIN people AS target ON target.identifier = events.target_identifier
			 WHERE events.target_kind = 'person'
			 ORDER BY events.created_at DESC LIMIT 50`
		)
		.all<{
			identifier: string;
			action: string;
			note: string | null;
			createdAt: string;
			actorName: string | null;
			targetName: string | null;
		}>();
	return { people: await listPeople(database), nations, history: history.results };
};

/** Reads the role and, for a nation reviewer, the nation, from a form. */
function readRole(form: FormData): { role: Role; nationIdentifier: string | null } | string {
	const role = formText(form, 'role') as Role | null;
	if (!role || !roles.includes(role)) return 'Choose a role.';
	if (role !== 'nation-reviewer') return { role, nationIdentifier: null };
	const nationIdentifier = formText(form, 'nationIdentifier');
	if (!nationIdentifier || !nations.some((nation) => nation.identifier === nationIdentifier)) {
		return 'Choose the nation this person reviews for.';
	}
	return { role, nationIdentifier };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
	invite: async (event) => {
		const person = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const form = await event.request.formData();
		const email = formText(form, 'email', 320);
		const displayName = formText(form, 'displayName', 200);
		const values = { email: email ?? '', displayName: displayName ?? '' };
		if (!email || !emailPattern.test(email)) {
			return fail(400, { problem: 'Give the email address the person will sign in with.', values });
		}
		if (!displayName) return fail(400, { problem: 'Give the person’s name.', values });
		const role = readRole(form);
		if (typeof role === 'string') return fail(400, { problem: role, values });
		if (await personByEmail(database, email)) {
			return fail(400, {
				problem: 'This email address is already on the list. Change that person’s role instead.',
				values
			});
		}
		await invitePerson(database, { email, displayName, ...role }, person);
		return {
			done: `${displayName} is invited. Ask them to sign in at /sign-in with ${email}; their access starts at their first sign-in.`
		};
	},

	role: async (event) => {
		const person = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const form = await event.request.formData();
		const target = await personByIdentifier(database, formText(form, 'identifier') ?? '');
		if (!target) return fail(404, { problem: 'That person is not on the list.' });
		const role = readRole(form);
		if (typeof role === 'string') return fail(400, { problem: role });
		if (target.role === 'lead-author' && role.role !== 'lead-author' && (await countLeadAuthors(database)) <= 1) {
			return fail(400, { problem: 'The project needs at least one lead author. Add another first.' });
		}
		await changeRole(database, target.identifier, role.role, role.nationIdentifier, person);
		return { done: `${target.displayName}’s role is changed.` };
	},

	access: async (event) => {
		const person = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const form = await event.request.formData();
		const target = await personByIdentifier(database, formText(form, 'identifier') ?? '');
		if (!target) return fail(404, { problem: 'That person is not on the list.' });
		const remove = formText(form, 'change') === 'remove';
		if (remove && target.identifier === person.identifier) {
			return fail(400, { problem: 'You cannot remove your own access.' });
		}
		if (remove && target.role === 'lead-author' && (await countLeadAuthors(database)) <= 1) {
			return fail(400, { problem: 'The project needs at least one lead author.' });
		}
		await setRemoved(database, target.identifier, remove, person);
		return {
			done: remove
				? `${target.displayName}’s access is removed. It ends at once, even if they are signed in.`
				: `${target.displayName}’s access is restored.`
		};
	}
};
