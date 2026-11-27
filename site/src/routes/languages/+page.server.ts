import { languageIndex } from '#lib/server/languages.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ languages: languageIndex() });
