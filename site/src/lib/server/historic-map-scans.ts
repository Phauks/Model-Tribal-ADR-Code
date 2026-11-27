/**
 * The Library of Congress's scans of historic maps of Indian lands that the site keeps (geography/historic-map-scans.json, written by tools/collect-historic-maps.mjs; Trevor, 2026-11-26: "lets get A, and B"). They open in the image viewer; none is georeferenced, so none is drawn over the map.
 *
 * A scan the review list holds back (allotment maps, which name individual people) or whose Library rights line does not clear it is kept in the bucket but not listed or served.
 */
import scanFile from '../../../geography/historic-map-scans.json';
import { copyPath } from '../public-copies.ts';

interface ScanImage {
	number: number;
	image: { key: string };
	thumbnail: { key: string };
}

interface ScanEntry {
	record: string;
	item: string;
	title: string;
	date: string;
	year: number | null;
	serve: boolean;
	images: ScanImage[];
}

export interface HistoricMapScan {
	/** The map's source record. */
	record: string;
	title: string;
	year: number | null;
	/** The Library of Congress's page for the map. */
	link: string;
	/** The site's copy of each image, a JPEG the image viewer shows, with its thumbnail. */
	images: { image: string; thumbnail: string }[];
}

let cache: HistoricMapScan[] | undefined;

/** The scans the site serves, earliest first. */
export function historicMapScans(): HistoricMapScan[] {
	cache ??= (scanFile.maps as ScanEntry[])
		.filter((map) => map.serve && map.images.length)
		.map((map) => ({ record: map.record, title: map.title, year: map.year, link: map.item, images: map.images.map((image) => ({ image: copyPath(image.image), thumbnail: copyPath(image.thumbnail) })) }))
		.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));
	return cache;
}
