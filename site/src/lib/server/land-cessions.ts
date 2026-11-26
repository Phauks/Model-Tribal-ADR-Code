/**
 * Royce's land cessions (1899) for the website: the facts shown when a reader picks a cession on the map, a nation's Land cessions section and a treaty's Land ceded row (Trevor, 2026-11-26, historic maps mockups in /mnt/project-files/design/historic-maps/).
 *
 * The facts are in geography/land-cessions.json (scripts/maps/land_cessions.py): for each cession, Royce's number, its dates, the treaties signed on those dates, the present-day nations the U.S. Forest Service lists, and Royce's map sheets. The sheets' files are in geography/royce-sheets.json (tools/build-historic-maps.mjs). The shapes are in the land cessions map tiles.
 */
import cessionFile from '../../../geography/land-cessions.json';
import sheetFile from '../../../geography/royce-sheets.json';
import tileManifest from '../../../geography/map-tiles.json';
import { copyPath } from '../public-copies.ts';
import { nationNamesAndKinds, sources } from './content.ts';
import { recordName } from './law-records.ts';
import { cessionYears, tileSetNames } from './map-tile-names.ts';

export interface RoyceSheet {
	plate: number;
	name: string;
	/** The site's copy of the sheet, a JPEG the image viewer shows. */
	image: string;
	thumbnail: string;
	/** The Library of Congress's page for the sheet. */
	link: string;
}

export interface LandCession {
	royce: string;
	/** Each date part of the land was ceded, as YYYY-MM-DD, earliest first. */
	dates: string[];
	/** The nations Royce's schedule names, as it names them. */
	schedule: string;
	treaties: { key: string; name: string }[];
	nations: { id: string; name: string }[];
	/** Present-day nations the Forest Service lists that have no page here. */
	otherNations: string[];
	sheets: RoyceSheet[];
	/** The box around the shape, west, south, east, north, so a page's map can open on it. */
	bounds: [number, number, number, number];
}

interface CessionEntry {
	royce: string;
	dates: string[];
	schedule: string;
	treaties: string[];
	nations: string[];
	other_nations: string[];
	sheets: number[];
	bounds: number[];
}

interface SheetEntry {
	plate: number;
	name: string | null;
	link: string;
	image: { key: string };
	thumbnail: { key: string };
}

let sheetCache: Map<number, RoyceSheet> | undefined;

/** Royce's map sheets, by plate number in the Library of Congress's copy. */
export function royceSheets(): Map<number, RoyceSheet> {
	sheetCache ??= new Map(
		(sheetFile.sheets as SheetEntry[])
			.filter((sheet) => sheet.name)
			.map((sheet) => [sheet.plate, { plate: sheet.plate, name: sheet.name ?? '', image: copyPath(sheet.image), thumbnail: copyPath(sheet.thumbnail), link: sheet.link }])
	);
	return sheetCache;
}

/** Royce's volume as one PDF, at the site's own address. */
export const royceVolume = { path: copyPath(sheetFile.volume), title: sheetFile.title, author: sheetFile.author, published: sheetFile.published, item: sheetFile.item };

let cessionCache: LandCession[] | undefined;

/** Every cession, earliest first. */
export function landCessions(): LandCession[] {
	if (!cessionCache) {
		const names = nationNamesAndKinds();
		const records = sources();
		const sheets = royceSheets();
		cessionCache = (cessionFile.cessions as CessionEntry[]).map((entry) => ({
			royce: entry.royce,
			dates: entry.dates,
			schedule: entry.schedule,
			treaties: entry.treaties.filter((key) => records.has(key)).map((key) => ({ key, name: recordName(key).name })),
			// A nation whose page is withheld is left out, as everywhere on the site.
			nations: entry.nations.filter((id) => names.has(id)).map((id) => ({ id, name: names.get(id)?.name ?? id })),
			otherNations: entry.other_nations,
			sheets: entry.sheets.map((plate) => sheets.get(plate)).filter((sheet) => sheet !== undefined),
			bounds: entry.bounds as LandCession['bounds']
		}));
	}
	return cessionCache;
}

/** The cessions whose present-day nations include this one, earliest first. */
export function cessionsOfNation(id: string): LandCession[] {
	return landCessions().filter((cession) => cession.nations.some((nation) => nation.id === id));
}

/** The cessions made by this treaty. */
export function cessionsOfTreaty(key: string): LandCession[] {
	return landCessions().filter((cession) => cession.treaties.some((treaty) => treaty.key === key));
}

/** The box around some cessions, for a map that opens on them. */
export function boundsOfCessions(cessions: LandCession[]): [number, number, number, number] | undefined {
	if (cessions.length === 0) return undefined;
	return [
		Math.min(...cessions.map((cession) => cession.bounds[0])),
		Math.min(...cessions.map((cession) => cession.bounds[1])),
		Math.max(...cessions.map((cession) => cession.bounds[2])),
		Math.max(...cessions.map((cession) => cession.bounds[3]))
	];
}

/** What the Map page's year slider and cession details need before the cessions themselves are fetched. */
export function mapPageHistoric() {
	return {
		cessionYears: cessionYears(),
		censusYears: tileManifest.landAreasByYear.years,
		volume: { path: royceVolume.path, title: royceVolume.title }
	};
}

/** Every cession as the Map page's details show it, served from /nations/map/land-cessions.json. */
export function mapPageCessions() {
	return landCessions().map((cession) => ({
		royce: cession.royce,
		dates: cession.dates,
		schedule: cession.schedule,
		treaties: cession.treaties,
		nations: cession.nations,
		otherNations: cession.otherNations,
		sheets: cession.sheets
	}));
}

/** What a treaty's small map needs (TileMap.svelte, historic maps mockup 7): the tile sets, and no land areas of its own. */
export function treatyMapData() {
	return { tiles: tileSetNames, states: {}, regions: { type: 'FeatureCollection' as const, features: [] }, areas: [], offices: [], shading: undefined };
}
