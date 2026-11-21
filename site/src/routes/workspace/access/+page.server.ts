import { fail } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import {
	accessLevels,
	documentAccess,
	everyDocument,
	roleDefaultLevels,
	subjectKinds,
	type AccessLevel,
	type SubjectKind
} from '#lib/permissions.ts';
import { endGrant, grantByIdentifier, grantsOf, listGrants, setGrant } from '#lib/server/access.ts';
import { administrationSummary } from '#lib/server/administration.ts';
import { listPeople, personByIdentifier } from '#lib/server/people.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import type { Actions, PageServerLoad } from './$types';

const documents = reviewSubjects.map((subject) => ({
	kind: subject.kind,
	identifier: subject.identifier,
	title: subject.title
}));

/** A planned essay or provision may not have a file yet; its identifier must still look like one. */
const plannedIdentifier = /^[a-z0-9][a-z0-9-]{0,120}$/;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-people');
	const { database } = storage(event);
	const people = (await listPeople(database)).filter((listed) => listed.status !== 'removed');
	const chosen = people.find((listed) => listed.identifier === event.url.searchParams.get('person'));

	// For one person: their level on each kind of document, and every
	// document where a grant makes it differ from that.
	const effective = chosen
		? await (async () => {
				const grants = await grantsOf(database, chosen.identifier);
				return subjectKinds.map((kind) => ({
					kind,
					count: documents.filter((document) => document.kind === kind).length,
					general: documentAccess(chosen, { kind, identifier: everyDocument }, grants),
					opened: documents.filter(
						(document) =>
							document.kind === kind &&
							documentAccess(chosen, document, grants).level !== 'no-access'
					).length
				}));
			})()
		: undefined;

	return {
		summary: await administrationSummary(database),
		people,
		chosen,
		effective,
		grants: await listGrants(database, chosen?.identifier),
		documents,
		roleDefaultLevels
	};
};

function readLevel(form: FormData): AccessLevel | undefined {
	const level = formText(form, 'level') as AccessLevel | null;
	return level && accessLevels.includes(level) ? level : undefined;
}

export const actions: Actions = {
	grant: async (event) => {
		const administrator = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const form = await event.request.formData();

		const target = await personByIdentifier(database, formText(form, 'person') ?? '');
		if (!target || target.status === 'removed') {
			return fail(400, { problem: 'Choose a person who has access to the workspace.' });
		}
		if (target.role === 'lead-author') {
			return fail(400, {
				problem: 'A lead author always has full access to everything, so a grant would change nothing.'
			});
		}

		const kind = formText(form, 'kind') as SubjectKind | null;
		if (!kind || !subjectKinds.includes(kind)) return fail(400, { problem: 'Choose a kind of document.' });

		const scope = formText(form, 'scope');
		let identifier: string;
		if (scope === 'every') {
			identifier = everyDocument;
		} else {
			identifier = (formText(form, 'document', 200) ?? '').toLocaleLowerCase('en-US');
			const known = documents.some((document) => document.kind === kind && document.identifier === identifier);
			const planned = (kind === 'essay' || kind === 'provision') && plannedIdentifier.test(identifier);
			if (!known && !planned) {
				return fail(400, {
					problem:
						'Choose a document from the list. For an essay or provision that has no file yet, type its planned identifier, such as ii-arbitration-in-tribal-courts.'
				});
			}
		}

		const level = readLevel(form);
		if (!level) return fail(400, { problem: 'Choose a level.' });

		const until = formText(form, 'expires', 10);
		let expiresAt: string | null = null;
		if (until) {
			if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(Date.parse(until))) {
				return fail(400, { problem: 'Give the end date as a date, or leave it empty.' });
			}
			// The grant lasts to the end of that day, in UTC.
			expiresAt = `${until}T23:59:59.999Z`;
			if (new Date(expiresAt) <= new Date()) return fail(400, { problem: 'The end date has already passed.' });
		}

		await setGrant(
			database,
			{
				personIdentifier: target.identifier,
				subjectKind: kind,
				subjectIdentifier: identifier,
				level,
				expiresAt,
				note: formText(form, 'note', 500)
			},
			administrator
		);
		return { done: `${target.displayName}’s access is changed. It takes effect on their next request.` };
	},

	end: async (event) => {
		const administrator = requirePermission(event, 'manage-people');
		const { database } = storage(event);
		const form = await event.request.formData();
		const grant = await grantByIdentifier(database, formText(form, 'grant') ?? '');
		if (!grant) return fail(404, { problem: 'That grant has already ended.' });
		await endGrant(database, grant, administrator);
		return { done: `${grant.personName}’s grant has ended; their role’s default applies again.` };
	}
};
