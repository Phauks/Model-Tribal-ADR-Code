import { error } from '@sveltejs/kit';
import { bureauRegions } from '#lib/federal-offices.ts';
import { bureauRegionView } from '#lib/server/federal-offices.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const entries: EntryGenerator = () => bureauRegions.map((office) => ({ region: office.key }));

export const load: PageServerLoad = ({ params }) => {
	const view = bureauRegionView(params.region);
	if (!view) error(404, 'The Bureau of Indian Affairs has no region by that name.');
	return view;
};
