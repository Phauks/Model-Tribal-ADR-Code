import { federalOfficesPage } from '#lib/server/federal-offices.ts';
import { landAreaGroups } from '#lib/nations-map-drawing.ts';
import { healthServiceAreaShades } from '#lib/shaded-map-views.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	...federalOfficesPage(),
	landAreaGroups: landAreaGroups.map(({ key, label }) => ({ key, label })),
	areaShades: healthServiceAreaShades
});
