import { error } from '@sveltejs/kit';
import { accountsOf } from '#lib/server/impact-accounts.ts';
import { publishedStories } from '#lib/server/stories.ts';
import { eventLabels } from '#lib/story-labels.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// The page an account's event link opens: every account of that federal policy or event (impact-accounts.ts).
export const prerender = true;

export const entries: EntryGenerator = () =>
	[...new Set(publishedStories().flatMap((record) => (record.affected_by ?? []).map((entry) => entry.event).filter((event): event is string => Boolean(event))))].map((event) => ({ event }));

export const load: PageServerLoad = ({ params }) => {
	const name = eventLabels[params.event];
	if (!name) error(404, 'No event has this address.');
	return { name, accounts: accountsOf({ event: params.event }) };
};
