/**
 * The federal offices that serve Native nations, so a nation page can link
 * each federal tie to a page about the office (Trevor, Nov. 23, 2026): the
 * Indian Health Service's Areas and the Bureau of Indian Affairs' regions and
 * agencies. Each entry has the office's own page. The addresses were checked
 * on Nov. 23, 2026; the agency addresses come from each region's list of its
 * agencies on bia.gov.
 */

export interface FederalOffice {
	/** The name as nation records give it, such as "California" or "Great Plains". */
	name: string;
	/** The address segment on this site. */
	key: string;
	/** The office's own page. */
	link: string;
}

/** Address segment for an office or agency name. */
export function officeKey(name: string): string {
	return name
		.normalize('NFKD')
		.toLocaleLowerCase('en-US')
		.replace(/[̀-ͯ]/g, '')
		.replace(/['’]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

const healthAreaPaths: Record<string, string> = {
	Alaska: 'alaska',
	Albuquerque: 'albuquerque',
	Bemidji: 'bemidji',
	Billings: 'billings',
	California: 'california',
	'Great Plains': 'greatplains',
	Nashville: 'nashville',
	Navajo: 'navajo',
	'Oklahoma City': 'oklahomacity',
	Phoenix: 'phoenix',
	Portland: 'portland',
	Tucson: 'tucson'
};

/** The 12 Areas of the Indian Health Service. */
export const healthAreas: FederalOffice[] = Object.entries(healthAreaPaths).map(([name, path]) => ({
	name,
	key: officeKey(name),
	link: `https://www.ihs.gov/${path}/`
}));

const regionPaths: Record<string, string> = {
	Alaska: 'regional-office/alaska-region',
	Eastern: 'regional-office/eastern-region',
	'Eastern Oklahoma': 'regional-offices/eastern-oklahoma-region',
	'Great Plains': 'regional-offices/great-plains-region',
	Midwest: 'regional-offices/midwest-region',
	Navajo: 'regional-offices/navajo-region',
	Northwest: 'regional-office/northwest-region',
	Pacific: 'regional-offices/pacific',
	'Rocky Mountain': 'regional-office/rocky-mountain-region',
	'Southern Plains': 'regional-office/southern-plains-region',
	Southwest: 'regional-office/southwest-region',
	Western: 'regional-offices/western'
};

/** Where a regional office is: its street address as its page gives it, and the point the Census Bureau's geocoder matched it to. */
export interface OfficeAddress {
	lines: string[];
	/** [longitude, latitude]. */
	point: [number, number];
	/** Placed from a description rather than a matched street address. */
	approximate?: boolean;
}

/**
 * Each regional office's address, from the "Contact Us" part of the region's own page on bia.gov (read Nov. 28, 2026), placed by the Census Bureau's geocoder (Public_AR_Current) on the same day. The Northwest Region's page gives no address. The Southern Plains Regional Office gives a post office box and "1 Mile North on Hwy 281", so its point is placed one mile north of Anadarko.
 */
const regionOffices: Record<string, OfficeAddress> = {
	Alaska: { lines: ['3601 C Street, Suite 1200', 'Anchorage, AK 99503'], point: [-149.8865, 61.188] },
	Eastern: { lines: ['545 Marriott Drive, Suite 700', 'Nashville, TN 37214'], point: [-86.6898, 36.1519] },
	'Eastern Oklahoma': { lines: ['3100 W. Peak Blvd.', 'Muskogee, OK 74401'], point: [-95.3983, 35.7117] },
	'Great Plains': { lines: ['115 4th Avenue Southeast, Suite 400', 'Aberdeen, SD 57401'], point: [-98.4864, 45.4612] },
	Midwest: { lines: ['5600 W. American Blvd., Suite 500', 'Bloomington, MN 55437'], point: [-93.3523, 44.8557] },
	Navajo: { lines: ['301 West Hill Street', 'Gallup, NM 87301'], point: [-108.7432, 35.5249] },
	Pacific: { lines: ['2800 Cottage Way, Suite W-2820', 'Sacramento, CA 95825'], point: [-121.3974, 38.6033] },
	'Rocky Mountain': { lines: ['2021 4th Avenue North', 'Billings, MT 59101'], point: [-108.4988, 45.7893] },
	'Southern Plains': { lines: ['1 mile north on Highway 281', 'Anadarko, OK 73005'], point: [-98.2437, 35.087], approximate: true },
	Southwest: { lines: ['1001 Indian School Road NW', 'Albuquerque, NM 87104'], point: [-106.6565, 35.1079] },
	Western: { lines: ['2600 North Central Avenue', 'Phoenix, AZ 85004'], point: [-112.0738, 33.4767] }
};

/** When the regional office addresses were read from bia.gov. */
export const regionOfficesChecked = '2026-11-28';

/** The 12 regional offices of the Bureau of Indian Affairs. */
export const bureauRegions: (FederalOffice & { office?: OfficeAddress })[] = Object.entries(regionPaths).map(([name, path]) => ({
	name,
	key: officeKey(name),
	link: `https://www.bia.gov/${path}`,
	office: regionOffices[name]
}));

/**
 * Each agency's own page, from the region's agency list. An agency left out
 * has no page of its own there (the Southwest Region has no agency list, and
 * a regional office is the region's page).
 */
const agencyPaths: Record<string, string> = {
	'Anadarko Agency': 'southern-plains/anadarko-agency',
	'Blackfeet Agency': 'rocky-mountain/blackfeet-agency',
	'Central California Agency': 'pacific/central-california-agency',
	'Cherokee Agency': 'eastern/cherokee-agency',
	'Cheyenne River Agency': 'great-plains/south-dakota/cheyenne-river-agency',
	'Chickasaw Agency': 'eastern-oklahoma/chickasaw-agency',
	'Choctaw Agency': 'eastern/choctaw-agency',
	"Coeur d'Alene Agency": 'northwest/coeur-dalene-agency',
	'Colorado River Agency': 'western/colorado-river-agency',
	'Colville Agency': 'northwest/colville-agency',
	'Concho Agency': 'southern-plains/concho-agency',
	'Crow Agency': 'rocky-mountain/crow-agency',
	'Crow Creek Agency': 'great-plains/south-dakota/crow-creek-agency',
	'Eastern Nevada Agency': 'western/eastern-nevada-agency',
	'Fairbanks Agency': 'alaska/fairbanks-agency',
	'Flathead Agency': 'northwest/flathead-agency',
	'Fort Apache Agency': 'western/fort-apache-agency',
	'Fort Belknap Agency': 'rocky-mountain/fort-belknap-agency',
	'Fort Berthold Agency': 'great-plains/north-dakota/fort-berthold-agency',
	'Fort Hall Agency': 'northwest/fort-hall-agency',
	'Fort Peck Agency': 'rocky-mountain/fort-peck-agency',
	'Fort Totten Agency': 'great-plains/north-dakota/fort-totten',
	'Fort Yuma Agency': 'western/fort-yuma-agency',
	'Great Lakes Agency': 'midwest/great-lakes-agency',
	'Hopi Agency': 'western/hopi-agency',
	'Horton Agency': 'southern-plains/horton-agency',
	'Lower Brule Agency': 'great-plains/south-dakota/lower-brule-agency',
	'Metlakatla Agency': 'northwest/metlakatla-agency',
	'Miami Agency': 'eastern-oklahoma/miami-agency',
	'Michigan Agency': 'midwest/michigan-agency',
	'Minnesota Agency': 'midwest/minnesota-agency',
	'Northern California Agency': 'pacific/northern-california',
	'Northern Cheyenne Agency': 'rocky-mountain/northern-cheyenne-agency',
	'Northern Idaho Agency': 'northwest/northern-idaho-agency',
	'Okmulgee Agency': 'eastern-oklahoma/okmulgee-agency',
	'Olympic Peninsula Agency': 'northwest/olympic-peninsula-agency',
	'Osage Agency': 'eastern-oklahoma/osage-agency',
	'Palm Springs Agency': 'pacific/palm-springs-agency',
	'Pawnee Agency': 'southern-plains/pawnee-agency',
	'Pima Agency': 'western/pima-agency',
	'Pine Ridge Agency': 'great-plains/south-dakota/pine-ridge-agency',
	'Puget Sound Agency': 'northwest/puget-sound-agency',
	"Rocky Boy's Field Office": 'rocky-mountain/rocky-boys-agency',
	'Rosebud Agency': 'great-plains/south-dakota/rosebud-agency',
	'Salt River Agency': 'western/salt-river-agency',
	'San Carlos Agency': 'western/san-carlos-agency',
	'Seminole Agency': 'eastern/seminole-agency',
	'Sisseton Agency': 'great-plains/south-dakota/sisseton-agency',
	'Southern California Agency': 'pacific/southern-california-agency',
	'Southern Paiute Agency': 'western/southern-paiute-agency',
	'Spokane Agency': 'northwest/spokane-agency',
	'Standing Rock Agency': 'great-plains/north-dakota/standing-rock-agency',
	'Taholah Agency': 'northwest/taholah-field-office',
	'Talihina Agency': 'eastern-oklahoma/talihina-agency',
	"Tohono O'odham Agency": 'western/tohonooodham-agency',
	'Truxton Canon Agency': 'western/truxton-canon-agency',
	'Turtle Mountain Agency': 'great-plains/north-dakota/turtle-mountain-agency',
	'Uintah & Ouray Agency': 'western/uintah-ouray-agency',
	'Umatilla Agency': 'northwest/umatilla-agency',
	'Warm Springs Agency': 'northwest/warm-springs-agency',
	'Western Nevada Agency': 'western/western-nevada-agency',
	'Wewoka Agency': 'eastern-oklahoma/wewoka-agency',
	'Wind River Agency': 'rocky-mountain/wind-river-agency',
	'Winnebago Agency': 'great-plains/nebraska/winnebago-agency',
	'Yakama Agency': 'northwest/yakama-agency',
	'Yankton Agency': 'great-plains/south-dakota/yankton-agency'
};

/** The agency's own page on bia.gov, when it has one. */
export function agencyLink(agency: string): string | undefined {
	const path = agencyPaths[agency];
	return path ? `https://www.bia.gov/regional-offices/${path}` : undefined;
}

/** Where on this site the page about an Indian Health Service Area is. */
export function healthAreaPage(area: string): string | undefined {
	const office = healthAreas.find((candidate) => candidate.name === area);
	return office ? `/nations/federal-offices/indian-health-service/${office.key}` : undefined;
}

/** Where on this site the page about a Bureau of Indian Affairs region is, or one of its agencies. */
export function bureauRegionPage(region: string, agency?: string): string | undefined {
	const office = bureauRegions.find((candidate) => candidate.name === region);
	if (!office) return undefined;
	const page = `/nations/federal-offices/bureau-of-indian-affairs/${office.key}`;
	return agency ? `${page}#${officeKey(agency)}` : page;
}
