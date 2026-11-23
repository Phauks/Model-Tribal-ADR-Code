import { siteTimeline } from '#lib/server/timeline.ts';
import { timelineKinds } from '#lib/timeline.ts';
import type { PageServerLoad } from './$types';

// The full timeline (/nations/timeline): every dated record of every nation,
// and every dated federal law and court decision (src/lib/server/timeline.ts).
// About four thousand entries, so they travel as short rows that the page
// turns back into entries: [kind, date, title, citation, detail, link,
// nations, italic], nations by their place in `nations`.
export const load: PageServerLoad = () => {
	const timeline = siteTimeline();
	const ids = Object.keys(timeline.nations);
	const place = new Map(ids.map((id, index) => [id, index]));
	const kinds = timelineKinds.map(({ kind }) => kind);
	const states = new Map<string, string>();
	for (const nation of Object.values(timeline.nations)) for (const state of nation.states) states.set(state.code, state.name);
	return {
		nations: ids.map((id) => ({ id, name: timeline.nations[id].name, states: timeline.nations[id].states.map((state) => state.code) })),
		states: [...states.entries()].map(([code, name]) => ({ code, name })).sort((first, second) => first.name.localeCompare(second.name, 'en')),
		entries: timeline.entries.map(
			(entry) =>
				[
					kinds.indexOf(entry.kind),
					entry.date,
					entry.title,
					entry.citation ?? '',
					entry.detail ?? '',
					entry.link ?? '',
					(entry.nations ?? []).map((id) => place.get(id) ?? -1).filter((index) => index >= 0),
					entry.italic ? 1 : 0
				] as const
		),
		opinions: timeline.opinions.map((year) => [year.year, year.count, year.peacemaking, year.nation ? (place.get(year.nation) ?? -1) : -1] as const)
	};
};
