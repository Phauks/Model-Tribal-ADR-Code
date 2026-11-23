import { reviewSubjects } from 'virtual:review-subjects';
import { allPlaces, listApplications } from '#lib/server/nation-teams.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-people');
	const { database } = storage(event);
	const places = await allPlaces(database);
	const titles = new Map(
		reviewSubjects.filter((subject) => subject.kind === 'nation').map((subject) => [subject.identifier, subject.title])
	);
	const teams = [...new Set(places.map((place) => place.nationIdentifier))].map((nationIdentifier) => {
		const members = places.filter((place) => place.nationIdentifier === nationIdentifier);
		return {
			nationIdentifier,
			title: titles.get(nationIdentifier) ?? nationIdentifier,
			stewards: members.filter((place) => place.level === 'steward').map((place) => place.personName),
			count: members.length
		};
	});
	return {
		applications: (await listApplications(database)).map((application) => ({
			...application,
			nationTitle: titles.get(application.nationIdentifier) ?? application.nationIdentifier
		})),
		teams: teams.sort((first, second) => first.title.localeCompare(second.title, 'en-US'))
	};
};
