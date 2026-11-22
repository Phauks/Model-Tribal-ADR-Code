import { nations } from '#lib/server/content.ts';
import { publishedStories } from '#lib/server/stories.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	storyCount: publishedStories().length,
	nationCount: nations().filter((record) => !record.example).length
});
