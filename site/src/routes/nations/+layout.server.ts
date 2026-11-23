import type { PageOutline } from '#lib/site-sections.ts';
import type { LayoutServerLoad } from './$types';

// The sidebar's outline for the Nations section. A nation's own page
// replaces it with the outline of that page.
export const load: LayoutServerLoad = () => ({
	outline: {
		items: [
			{ label: 'Directory', link: '/nations' },
			{ label: 'Map', link: '/nations/map' },
			{ label: 'Find recourse', link: '/nations/recourse' },
			{ label: 'Data and charts', link: '/nations/data' }
		]
	} satisfies PageOutline as PageOutline
});
