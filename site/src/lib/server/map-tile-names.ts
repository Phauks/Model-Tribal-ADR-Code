import tileManifest from '../../../geography/map-tiles.json';
import cessionFile from '../../../geography/land-cessions.json';

/** The years in which a cession was made, in order, for the year slider's stops. */
export function cessionYears(): number[] {
	return [...new Set((cessionFile.cessions as { dates: string[] }[]).flatMap((entry) => entry.dates.map((date) => Number(date.slice(0, 4)))))].sort((first, second) => first - second);
}

/** The tile sets' names, which change whenever their files do. */
export const tileSetNames = {
	landAreas: tileManifest.landAreas.set,
	basemap: tileManifest.basemap.set,
	maximumZoom: tileManifest.basemap.maxZoom,
	/** The whole world, to zoom 8, where the basemap above (cut to the United States and its territories) has nothing. */
	worldBasemap: tileManifest.worldBasemap.set,
	worldMaximumZoom: tileManifest.worldBasemap.maxZoom,
	/** Royce's land cessions (1899), as the Forest Service traced them (tools/build-historic-maps.mjs). */
	landCessions: tileManifest.landCessions.set,
	landCessionsMaximumZoom: tileManifest.landCessions.maxZoom,
	/** The years in which a cession was made, for the year slider's ‹ and › buttons. */
	landCessionYears: cessionYears(),
	/** The Census Bureau's land areas for every year it published, each shape with the years it was drawn so (tools/build-historic-maps.mjs). */
	landAreasByYear: tileManifest.landAreasByYear.set,
	landAreaYears: tileManifest.landAreasByYear.years,
	/** The Newberry Library's states and territories, 1783 to 2000, each with the dates it stood (tools/build-historic-maps.mjs). */
	borders: tileManifest.borders.set,
	bordersMaximumZoom: tileManifest.borders.maxZoom,
	/** The days on which a state or territory began or ended, as years, for the timeline's marks. */
	borderYears: tileManifest.borders.years,
	/** The National Park Service's Trail of Tears routes. */
	removalRoutes: tileManifest.removalRoutes.set,
	removalRoutesMaximumZoom: tileManifest.removalRoutes.maxZoom,
	/** The National Park Service's tracing of the 1978 map of lands the Indian Claims Commission found each nation held. */
	homelands: tileManifest.homelands.set,
	homelandsMaximumZoom: tileManifest.homelands.maxZoom,
	/** The reservations traced from the Office of Indian Affairs' 1909 map (scripts/maps/oia_1909_reservations.py). */
	reservations1909: tileManifest.reservations1909.set,
	reservations1909MaximumZoom: tileManifest.reservations1909.maxZoom,
	/** The 1909 map itself, warped onto the web map, as pictures. */
	scan1909: tileManifest.scan1909.set,
	scan1909MaximumZoom: tileManifest.scan1909.maxZoom
};
