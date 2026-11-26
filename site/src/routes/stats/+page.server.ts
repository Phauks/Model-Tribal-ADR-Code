import { collectionsByGroup } from '#lib/server/collections.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ groups: collectionsByGroup(), built: new Date().toISOString().slice(0, 10) });
