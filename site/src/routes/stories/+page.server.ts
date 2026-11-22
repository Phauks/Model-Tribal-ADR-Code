import { storySummaries } from '#lib/server/stories.ts';
import type { PageServerLoad } from './$types';

/**
 * The stories, grouped by nation. A story shared by several nations is listed
 * under each of them.
 */
export const load: PageServerLoad = () => {
	const stories = storySummaries();
	const groups = new Map<string, { id: string; name: string; link?: string; stories: typeof stories }>();
	for (const story of stories) {
		for (const nation of story.nations) {
			const group = groups.get(nation.id) ?? { ...nation, stories: [] };
			group.stories.push(story);
			groups.set(nation.id, group);
		}
	}
	return {
		count: stories.length,
		awaitingReview: stories.filter((story) => story.awaitsReview).length,
		groups: [...groups.values()].sort((first, second) =>
			first.name.localeCompare(second.name, 'en', { sensitivity: 'base' })
		)
	};
};
