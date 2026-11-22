import { storySummaries } from '#lib/server/stories.ts';
import type { PageOutline } from '#lib/site-sections.ts';
import type { LayoutServerLoad } from './$types';

// The sidebar's outline for the stories: every published story, by title.
export const load: LayoutServerLoad = () => ({
	outline: {
		items: [
			{ label: 'All stories', link: '/stories' },
			...storySummaries()
				.map((story) => ({ label: story.title, link: `/stories/${story.id}` }))
				.sort((first, second) => first.label.localeCompare(second.label, 'en-US'))
		]
	} satisfies PageOutline as PageOutline
});
