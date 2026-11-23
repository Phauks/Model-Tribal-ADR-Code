import { error } from '@sveltejs/kit';
import { healthAreas } from '#lib/federal-offices.ts';
import { healthAreaView } from '#lib/server/federal-offices.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => healthAreas.map((office) => ({ area: office.key }));

export const load: PageServerLoad = ({ params }) => {
	const view = healthAreaView(params.area);
	if (!view) error(404, 'The Indian Health Service has no Area by that name.');
	return view;
};
