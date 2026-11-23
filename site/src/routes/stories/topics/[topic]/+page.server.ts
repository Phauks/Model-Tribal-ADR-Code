import { storyTagEntries, storyTagPage } from '#lib/server/story-tag-pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => storyTagEntries('topics').map((topic) => ({ topic }));

export const load: PageServerLoad = ({ params }) => storyTagPage('topics', params.topic);
