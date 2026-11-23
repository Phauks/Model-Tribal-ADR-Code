import { eventStatusLabels, eventWhen } from '#lib/event-calendar.ts';
import { allEvents } from '#lib/server/event-calendar.ts';
import { requirePermission, storage } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// Every event, drafts included (site/COLLABORATION.md, "Events"). The lead
// author and editors.
export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'manage-events');
	const { database } = storage(event);
	const now = Date.now();
	return {
		events: (await allEvents(database)).map((item) => ({
			identifier: item.identifier,
			slug: item.slug,
			title: item.title,
			when: eventWhen(item.startsAt, item.endsAt, item.timeZone),
			status: eventStatusLabels[item.status],
			over: new Date(item.endsAt).getTime() <= now,
			registered: item.registered,
			waiting: item.waiting
		}))
	};
};
