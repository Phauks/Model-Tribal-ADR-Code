import { error } from '@sveltejs/kit';
import { publishedStories, storyView } from '#lib/server/stories.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => publishedStories().map((record) => ({ id: record.id }));

export const load: PageServerLoad = ({ params }) => {
	const record = publishedStories().find((candidate) => candidate.id === params.id);
	if (!record) error(404, 'No story has this address.');
	return { story: storyView(record) };
};
