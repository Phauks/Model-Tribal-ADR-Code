import { checkSealsAndRecord, sealNewEntries } from '#lib/server/activity-seals.ts';
import { activityPage, eventTargets, type EventTarget } from '#lib/server/events.ts';
import { listPeople } from '#lib/server/people.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

const pageSize = 100;

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-people');
	const { database } = storage(event);
	const search = event.url.searchParams;

	const requestedKind = search.get('kind') ?? '';
	const targetKind = (eventTargets as readonly string[]).includes(requestedKind)
		? (requestedKind as EventTarget)
		: undefined;
	const before = Number.parseInt(search.get('before') ?? '', 10);
	const people = await listPeople(database);
	const personIdentifier = people.find((listed) => listed.identifier === search.get('person'))?.identifier;

	await sealNewEntries(database);
	const entries = await activityPage(database, {
		before: Number.isFinite(before) && before > 0 ? before : undefined,
		targetKind,
		personIdentifier,
		limit: pageSize + 1
	});

	return {
		// The Activity page checks the whole chain, and records the result for the pages that check only newer entries.
		seals: await checkSealsAndRecord(database),
		entries: entries.slice(0, pageSize),
		older: entries.length > pageSize ? entries[pageSize - 1].sequence : undefined,
		targetKind,
		personIdentifier,
		people: people.map((listed) => ({ identifier: listed.identifier, displayName: listed.displayName }))
	};
};
