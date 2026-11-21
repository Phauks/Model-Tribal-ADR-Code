import { glossary, nations } from '#lib/server/content.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	glossaryCount: glossary().length,
	nationCount: nations().filter((record) => !record.example).length
});
