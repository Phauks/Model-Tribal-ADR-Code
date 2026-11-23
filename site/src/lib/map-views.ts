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
export const mapViewGroups = ['Where nations are', 'Courts and dispute resolution', 'Jurisdiction', 'Gaming', 'Federal administration'] as const;

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
		key: 'courts-and-peacemaking',
		label: 'Courts and Peacemaking',
		heading: 'courts-and-peacemaking-heading',
		group: 'Courts and dispute resolution',
		description: 'Nations with a tribal court, a peacemaking or traditional forum, or a healing to wellness court',
		keywords: ['court', 'tribal court', 'peacemaking', 'traditional', 'elders', 'circle', 'wellness', 'drug court', 'court of indian offenses', 'cfr court', 'adr', 'dispute resolution']
	},
	{
		key: 'public-law-280',
		label: 'Public Law 280',
		heading: 'public-law-280-heading',
		group: 'Jurisdiction',
		description: 'Where states hold criminal and civil jurisdiction in Indian country under Public Law 280',
		keywords: ['pl 280', 'pl280', 'state jurisdiction', 'criminal', 'civil', 'retrocession', 'mandatory', 'optional', '1953']
	},
	{
		key: 'violence-against-women-act',
		label: 'Violence Against Women Act Jurisdiction',
		heading: 'violence-against-women-act-heading',
		group: 'Jurisdiction',
		description: 'Nations exercising special Tribal criminal jurisdiction over non-Indians',
		keywords: ['vawa', 'stcj', 'special tribal criminal jurisdiction', 'domestic violence', 'dating violence', 'non-indian', 'criminal']
	},
	{
		key: 'other-jurisdiction-laws',
		label: 'Other Jurisdiction Laws',
		heading: 'other-jurisdiction-laws-heading',
		group: 'Jurisdiction',
		description: 'State jurisdiction under other federal laws, child welfare jurisdiction reassumed, and enhanced sentencing',
		keywords: ['kansas act', 'land claims settlement', 'icwa', 'indian child welfare act', 'reassumption', 'tloa', 'tribal law and order act', 'enhanced sentencing', 'state jurisdiction']
	},
	{
		key: 'agreements-with-states',
		label: 'Agreements with States',
		heading: 'agreements-with-states-heading',
		group: 'Jurisdiction',
		description: 'Cross-deputization, child welfare, tax and other agreements with states and local governments',
		keywords: ['cross-deputization', 'law enforcement', 'title iv-e', 'child welfare', 'tax compact', 'tax agreement', 'intergovernmental agreement', 'compact']
	},
	{
		key: 'gaming',
		label: 'Gaming',
		heading: 'gaming-heading',
		group: 'Gaming',
		description: 'Class III gaming compacts, Secretarial Procedures, gaming ordinances and nations that operate gaming',
		keywords: ['igra', 'indian gaming regulatory act', 'casino', 'compact', 'class iii', 'class ii', 'nigc', 'national indian gaming commission', 'ordinance', 'secretarial procedures']
	},
	{
		key: 'regions',
		label: 'Bureau of Indian Affairs Regions',
		heading: 'bureau-of-indian-affairs-regions',
		group: 'Federal administration',
		description: 'The twelve regions the Bureau of Indian Affairs serves nations through',
		keywords: ['bia', 'region', 'agency', 'federal', 'administration'],
		nationPage: { key: 'region', label: 'Region', description: 'The Bureau of Indian Affairs region that serves the nation' }
	},
	{
		key: 'indian-health-service',
		label: 'Indian Health Service Areas',
		heading: 'indian-health-service-heading',
		group: 'Federal administration',
		description: 'The twelve Areas the Indian Health Service serves nations through',
		keywords: ['ihs', 'health', 'clinic', 'hospital', 'service unit', 'federal', 'administration']
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
