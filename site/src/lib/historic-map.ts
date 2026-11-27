/**
 * The historic layers on the site's maps (Trevor, 2026-11-26, historic maps mockup A): Royce's land cessions (1899) as the U.S. Forest Service traced them, and the Census Bureau's land areas for each year it published them, both picked by year on the slider under the map (YearSlider.svelte).
 */
import { readStored, writeStored } from './browser-storage.ts';
import type { MapDetailsLine } from './map-details.ts';
import { readableDate } from './readable-date.ts';

/** Where the reader's choice of the Land cessions switch is kept on the device, as the base map is. */
const cessionsStorage = 'map-land-cessions';

export function readCessionsSwitch(): boolean {
	return typeof window !== 'undefined' && readStored(cessionsStorage) === 'on';
}

export function writeCessionsSwitch(on: boolean): void {
	writeStored(cessionsStorage, on ? 'on' : 'off');
}

/** The Census year whose land areas the map shows for a year: the latest at or before it, or none before the first. */
export function censusYearFor(year: number, censusYears: number[]): number | undefined {
	return [...censusYears].reverse().find((census) => census <= year);
}

/** The slider's range, the years ‹ and › stop at, and the stretches of its track to tint. */
export function yearSliderSetup(cessionYears: number[], censusYears: number[], withCessions: boolean) {
	const first = cessionYears[0] ?? censusYears[0];
	const last = censusYears[censusYears.length - 1] ?? cessionYears[cessionYears.length - 1];
	const stops = [...new Set([...(withCessions ? cessionYears : []), ...censusYears])].sort((one, other) => one - other);
	const bands: { kind: 'cessions' | 'census'; from: number; to: number }[] = [];
	if (withCessions && cessionYears.length > 0) bands.push({ kind: 'cessions', from: cessionYears[0], to: cessionYears[cessionYears.length - 1] });
	if (censusYears.length > 0) bands.push({ kind: 'census', from: censusYears[0], to: censusYears[censusYears.length - 1] });
	return { minimum: first, maximum: last, stops, bands };
}

/** One of Royce's map sheets, as the details and the nation and treaty pages show it. */
export interface RoyceSheetLink {
	plate: number;
	name: string;
	image: string;
	thumbnail: string;
	link: string;
}

/** A cession as the Map page's details show it, from /nations/map/land-cessions.json. */
export interface CessionDetail {
	royce: string;
	dates: string[];
	schedule: string;
	treaties: { key: string; name: string }[];
	nations: { id: string; name: string }[];
	otherNations: string[];
	sheets: RoyceSheetLink[];
}

/** Royce's volume, the source of every cession, at the site's own copy. */
export interface RoyceVolume {
	path: string;
	title: string;
}

/** A cession's facts for the details beside the map (mockup 2A). */
export function cessionLines(cession: CessionDetail, volume: RoyceVolume): MapDetailsLine[] {
	const lines: MapDetailsLine[] = [{ label: 'Ceded', value: cession.dates.map((date) => readableDate(date)).join('; ') }];
	if (cession.treaties.length > 0) lines.push({ label: 'By', value: '', links: cession.treaties.map((treaty) => ({ label: treaty.name, href: `/laws/${treaty.key}` })) });
	if (cession.schedule) lines.push({ label: 'Named in the schedule', value: cession.schedule });
	if (cession.nations.length > 0 || cession.otherNations.length > 0) {
		lines.push({ label: 'Nations today', value: '', links: [...cession.nations.map((nation) => ({ label: nation.name, href: `/nations/${nation.id}` })), ...cession.otherNations.map((name) => ({ label: name }))] });
	}
	if (cession.sheets.length > 0) lines.push({ label: 'Royce’s maps', value: '', pictures: cession.sheets.map((sheet) => ({ label: sheet.name, src: sheet.thumbnail, href: sheet.image, original: sheet.link })) });
	lines.push({ label: 'Source', value: 'schedule entry; shape from the U.S. Forest Service', links: [{ label: `Royce, ${volume.title} (1899)`, href: volume.path }] });
	return lines;
}
