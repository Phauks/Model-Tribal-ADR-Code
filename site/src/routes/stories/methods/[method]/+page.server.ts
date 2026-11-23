import { storyTagEntries, storyTagPage } from '#lib/server/story-tag-pages.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => storyTagEntries('methods').map((method) => ({ method }));

export const load: PageServerLoad = ({ params }) => storyTagPage('methods', params.method);
