/**
 * The Federal Register term search across every agency (docs/source-watch.md,
 * "Triage"): documents that mention tribes from agencies other than those the
 * federal-register watcher already asks. In 2025 it found about 4,900, most of
 * them other agencies' consultation notices, which the models sort out
 * before a person sees them. With WATCH_TRIAGE_PROVIDER set to none every one
 * would go to a person, so turn it off then with
 * WATCH_TURN_OFF=federal-register-search (site/watch/README.md).
 */
import { defineWatcher, type FoundItem } from '../../src/lib/server/watch/watcher.ts';
import { ask, nativeAgencies, since } from './federal-register.ts';

export default defineWatcher({
	identifier: 'federal-register-search',
	title: 'Federal Register, every agency',
	tier: 2,
	feeds: ['federal-register-notices', 'federal-regulations', 'nation:jurisdiction', 'nation:land_establishment'],
	driver: 'api',
	schedule: '37 13 * * 1-5',
	hosts: ['www.federalregister.gov', 'www.govinfo.gov'],
	hosting: 'serve',
	documentation: ['https://www.federalregister.gov/developers/documentation/api/v1'],
	async check(context) {
		const answer = await ask(context, [['conditions[term]', 'tribe | tribal | "Indian country" | "Alaska Native"']], 10);
		const theirs = (item: FoundItem) => Array.isArray(item.facts?.agencies) && item.facts.agencies.some((agency) => nativeAgencies.includes(agency));
		return { items: answer.items.filter((item) => !theirs(item)), cursor: answer.more ? since(context.cursor, context.now) : answer.newest, more: answer.more };
	}
});
