/**
 * The views of the website's maps, in one list (Trevor, 2026-11-23: a searchable dropdown in place of tabs, since views such as Public Law 280 will be added over time). The map of all nations and each nation's small map pick their views from here with the searchable dropdown (src/lib/components/SearchableDropdown.svelte), so a new view is named, grouped and described once.
 *
 * To add a view: add its entry here, its drawing (src/lib/nations-map-drawing.ts) and, if it is drawn with tiles, its layers in TileMap.svelte. A view appears on a nation's page only if it has a nationPage entry and the nation's record has what it needs.
 */
import type { SearchableChoice } from '#lib/components/SearchableDropdown.svelte';
import type { NationsMapView } from '#lib/nations-map-drawing.ts';

/** The views a nation's small map can show. */
export type NationMapView = 'states' | 'region' | 'lands';

export interface MapViewEntry {
	key: NationsMapView;
	/** Its name in title case (Trevor, 2026-11-22), which is also the map page's heading for it. */
	label: string;
	/** The id of the map page's heading for it, which other pages link to. */
	heading: string;
	group: string;
	description: string;
	keywords: string[];
	/** How the view appears on a nation's page, if it does. */
	nationPage?: { key: NationMapView; label: string; description: string };
}

/** Groups in the order they are listed. */
export const mapViewGroups = ['Where nations are', 'Federal administration'] as const;

export const mapViews: MapViewEntry[] = [
	{
		key: 'states',
		label: 'Nations by State',
		heading: 'by-state-heading',
		group: 'Where nations are',
		description: 'How many nations sources place in each state and territory',
		keywords: ['states', 'territories', 'presence', 'count'],
		nationPage: { key: 'states', label: 'States', description: 'States and territories where sources record the nation' }
	},
	{
		key: 'lands',
		label: 'Land Areas',
		heading: 'land-areas',
		group: 'Where nations are',
		description: 'Reservations, trust lands and statistical areas from the 2020 census',
		keywords: ['reservation', 'trust land', 'rancheria', 'pueblo', 'census', 'boundaries', 'aiannh'],
		nationPage: { key: 'lands', label: 'Land Areas', description: 'The census areas the nation’s entry names' }
	},
	{
		key: 'regions',
		label: 'Bureau of Indian Affairs Regions',
		heading: 'bureau-of-indian-affairs-regions',
		group: 'Federal administration',
		description: 'The twelve regions the Bureau of Indian Affairs serves nations through',
		keywords: ['bia', 'region', 'agency', 'federal', 'administration'],
		nationPage: { key: 'region', label: 'Region', description: 'The Bureau of Indian Affairs region that serves the nation' }
	}
];

/** The map page's views as dropdown choices. */
export const mapViewChoices: SearchableChoice<NationsMapView>[] = mapViews.map(({ key, label, group, description, keywords }) => ({ value: key, label, group, description, keywords }));

/** A nation page's views as dropdown choices, for the views its map has, in the list's order. */
export function nationMapViewChoices(available: NationMapView[]): SearchableChoice<NationMapView>[] {
	return mapViews.flatMap((view) =>
		view.nationPage && available.includes(view.nationPage.key)
			? [{ value: view.nationPage.key, label: view.nationPage.label, group: view.group, description: view.nationPage.description, keywords: [view.label, ...view.keywords] }]
			: []
	);
}
