/**
 * The map page's data (src/lib/server/nations-map.ts), worked out from a few
 * made-up nation entries rather than the real records, so each count, order
 * and shade can be checked by hand. The land areas and office points are the
 * real files in geography/, which the entries below name by their codes.
 */
import { describe, expect, it, vi } from 'vitest';
import type { DocumentHistoryRecord, NationRecord } from '#lib/server/content.ts';
import { landAreasView, landAreaOffices, nationCategoryKeys, nationsMapPage, nationTileMapData, shadedView, tileMapData } from '#lib/server/nations-map.ts';
import { healthServiceAreaShades, publicLaw280Categories, shadedMapViews } from '#lib/shaded-map-views.ts';

const fixtures = vi.hoisted(() => {
	const census = (code: string, vintage = '2020') => ({ geographic_identifier: code, name: `Area ${code}`, vintage, source: 'fixture-census-areas' });
	const publicLaw280 = (...values: string[]) => values.map((value) => ({ topic: 'public-law-280', value, source: 'fixture-public-law-280' }));
	const treaty = (title: string, signed: string) => ({ title, signed, source: 'fixture-kappler' });
	const nations = [
		{
			id: 'pueblo-of-acoma',
			entity_type: 'native-nation',
			names: { official: 'Pueblo of Acoma' },
			recognition: [{ type: 'federal', source: 'fixture-federal-list' }],
			states: [{ state: 'NM' }],
			federal_administration: { bureau_of_indian_affairs_region: 'Southwest', source: 'fixture-directory', as_of: '2026-11-01' },
			census_areas: [census('0010')],
			jurisdiction: publicLaw280('not-a-public-law-280-state'),
			languages: [{ name: 'Keres' }],
			population: [{ kind: 'resident-population', count: 3000, locator: 'GEOID 2500000US0010', source: 'fixture-census-counts' }],
			indian_health_service: [{ area: 'Albuquerque' }]
		},
		{
			id: 'agua-caliente-band',
			entity_type: 'native-nation',
			names: { official: 'Agua Caliente Band of Cahuilla Indians' },
			recognition: [{ type: 'federal', source: 'fixture-federal-list' }],
			states: [{ state: 'CA' }],
			federal_administration: { bureau_of_indian_affairs_region: 'Pacific', source: 'fixture-directory' },
			census_areas: [census('0020')],
			jurisdiction: publicLaw280('mandatory-state'),
			// The same treaty listed twice counts once.
			treaties: [treaty('Treaty with the Cahuilla', '1852-01-05'), treaty('Treaty with the Cahuilla', '1852-01-05')],
			languages: [{ name: 'Cahuilla' }],
			population: [{ kind: 'resident-population', count: 400, locator: 'GEOID 2500000US0020', source: 'fixture-census-counts' }],
			indian_health_service: [{ area: 'California' }]
		},
		{
			// Shares the Agua Caliente land area, in two states.
			id: 'desert-band',
			entity_type: 'native-nation',
			names: { official: 'Desert Band' },
			recognition: [{ type: 'federal', source: 'fixture-federal-list' }],
			states: [{ state: 'CA' }, { state: 'AZ' }],
			federal_administration: { bureau_of_indian_affairs_region: 'Pacific', source: 'fixture-directory' },
			census_areas: [census('0020')],
			jurisdiction: publicLaw280('mandatory-state', 'retroceded'),
			treaties: ['1851', '1852', '1853', '1854', '1855'].map((year) => treaty(`Treaty of ${year}`, `${year}-06-01`)),
			languages: [{ name: 'Dena’ina' }]
		},
		{
			// No land area; its office is placed at its address.
			id: 'alabama-quassarte-tribal-town',
			entity_type: 'native-nation',
			names: { official: 'Alabama-Quassarte Tribal Town' },
			recognition: [{ type: 'federal', source: 'fixture-federal-list' }],
			states: [{ state: 'OK' }],
			federal_administration: { bureau_of_indian_affairs_region: 'Eastern Oklahoma', source: 'fixture-directory' },
			jurisdiction: publicLaw280('optional-state'),
			languages: [{ name: "Dena'ina" }]
		},
		{
			// Only a 2010 land area, which the map does not draw; its office is placed by ZIP code.
			id: 'amah-mutsun-tribal-band-of-mission-san-juan-bautista',
			entity_type: 'native-nation',
			names: { official: 'Amah Mutsun Tribal Band' },
			recognition: [{ type: 'petitioning', source: 'fixture-petitions' }],
			states: [{ state: 'CA' }],
			census_areas: [census('2430', '2010')],
			languages: [{ name: "Dena'ina" }]
		},
		{
			// Recognized by one of its two states; no land area and no office point.
			id: 'example-state-tribe',
			entity_type: 'native-nation',
			names: { official: 'Example State Tribe' },
			recognition: [{ type: 'state', state: 'NM', source: 'fixture-state-law' }],
			states: [{ state: 'NM' }, { state: 'AZ' }]
		}
	];
	const histories = [
		{ id: 'compact-a', kind: 'gaming-compact', title: 'Compact', nations: ['alabama-quassarte-tribal-town'], versions: [{ status: 'approved' }] },
		{ id: 'compact-b', kind: 'gaming-compact', title: 'Disapproved compact', nations: ['pueblo-of-acoma'], versions: [{ status: 'disapproved' }] },
		{ id: 'constitution-a', kind: 'constitution', title: 'Constitution', nations: ['agua-caliente-band'], versions: [] }
	];
	const shape = (code: string) => ({ code, path: '' });
	const geometry = {
		states: ['AZ', 'CA', 'NM', 'OK', 'TX'].map(shape),
		regions: ['Alaska', 'Eastern Oklahoma', 'Pacific', 'Southwest'].map((name) => ({ name, path: '', label: { x: 0, y: 0 }, showLabel: true })),
		regionSource: { source: 'fixture-region-outlines', retrieved: '2026-11-01' },
		landAreas: [
			{ identifier: '2430', name: 'Navajo Nation Reservation and Off-Reservation Trust Land', kind: 'federal-reservation-or-trust-land', path: '' },
			{ identifier: '0010', name: 'Acoma Pueblo and Off-Reservation Trust Land', kind: 'federal-reservation-or-trust-land', path: '' },
			{ identifier: '5550', name: 'Cherokee OTSA', kind: 'oklahoma-tribal-statistical-area', path: '' },
			{ identifier: '0020', name: 'Agua Caliente Indian Reservation and Off-Reservation Trust Land', kind: 'federal-reservation-or-trust-land', path: '' }
		],
		landAreaSource: { source: 'fixture-land-area-outlines', retrieved: '2026-11-02' },
		statePoints: { NM: [-106, 34] },
		stateBounds: { NM: [-109, 31, -103, 37] }
	};
	return { nations, histories, geometry };
});

vi.mock('virtual:map-geometry', () => ({ default: fixtures.geometry }));
vi.mock('#lib/server/content.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/content.ts')>()),
	nations: () => fixtures.nations as unknown as NationRecord[],
	documentHistories: () => fixtures.histories as unknown as DocumentHistoryRecord[],
	sources: () => new Map()
}));

const record = (id: string) => fixtures.nations.find((nation) => nation.id === id) as unknown as NationRecord;

describe('the map page', () => {
	const page = nationsMapPage();

	it('counts each state’s nations once each and puts the count in its class', () => {
		expect(page.counts.states).toEqual([
			{ code: 'AZ', name: 'Arizona', count: 2, countClass: 1 },
			{ code: 'CA', name: 'California', count: 3, countClass: 1 },
			{ code: 'NM', name: 'New Mexico', count: 2, countClass: 1 },
			{ code: 'OK', name: 'Oklahoma', count: 1, countClass: 1 },
			{ code: 'TX', name: 'Texas', count: 0, countClass: 0 }
		]);
		expect(page.countClasses.map((entry) => entry.key)).toEqual([0, 1, 2, 3, 4]);
	});

	it('lists only states with nations, A to Z, with their nations A to Z', () => {
		expect(page.stateRows.map((row) => row.name)).toEqual(['Arizona', 'California', 'New Mexico', 'Oklahoma']);
		expect(page.stateRows.find((row) => row.code === 'CA')!.nations.map((nation) => nation.name)).toEqual([
			'Agua Caliente Band of Cahuilla Indians',
			'Amah Mutsun Tribal Band',
			'Desert Band'
		]);
	});

	it('lists every region, A to Z, with the nations it serves and their states', () => {
		expect(page.regionRows.map((row) => [row.name, row.anchor, row.nations.length])).toEqual([
			['Alaska', 'region-alaska', 0],
			['Eastern Oklahoma', 'region-eastern-oklahoma', 1],
			['Pacific', 'region-pacific', 2],
			['Southwest', 'region-southwest', 1]
		]);
		expect(page.regionRows.find((row) => row.name === 'Pacific')!.states).toEqual(['Arizona', 'California']);
		expect(page.counts.regions.find((region) => region.name === 'Pacific')!.count).toBe(2);
	});

	it('gives each listed nation the badges of its recognition', () => {
		const california = page.stateRows.find((row) => row.code === 'CA')!.nations;
		const kinds = (id: string) => california.find((nation) => nation.id === id)!.badges?.map((badge) => badge.kind);
		expect(kinds('agua-caliente-band')).toEqual(['federal']);
		expect(kinds('amah-mutsun-tribal-band-of-mission-san-juan-bautista')).toEqual(['petitioning']);
	});

	it('counts the nations without a 2020 land area, placed at an office or not', () => {
		expect(page.offices).toEqual({ placed: 2, unplaced: 1 });
	});

	it('lists each source once, in the order the page first uses it', () => {
		const keys = page.sources.map((source) => source.key);
		expect(new Set(keys).size).toBe(keys.length);
		expect(keys.slice(0, 3)).toEqual(['fixture-directory', 'fixture-region-outlines', 'census-cartographic-boundary-states-2017']);
		expect(keys).toEqual(expect.arrayContaining(['fixture-census-areas', 'fixture-land-area-outlines', 'fixture-public-law-280', 'fixture-federal-list']));
		expect(page.sources.map((source) => source.number)).toEqual(keys.map((_key, index) => index + 1));
		const directory = page.sources.find((source) => source.key === 'fixture-directory')!;
		expect(directory.groups).toContainEqual({ section: 'Which region serves each nation', where: 'as of 2026-11-01', facts: ['the region named in each nation’s entry'] });
	});
});

describe('the land areas view', () => {
	it('counts the nations linked to each area, leaving out links to other Census years', () => {
		const { counts } = landAreasView();
		expect(counts.map((area) => [area.identifier, area.count])).toEqual([
			['2430', 0],
			['0010', 1],
			['5550', 0],
			['0020', 2]
		]);
		expect(counts[1].anchor).toBe('land-area-0010');
	});

	it('lists the areas A to Z with their kinds in words and their nations A to Z', () => {
		const { rows } = landAreasView();
		expect(rows.map((row) => row.identifier)).toEqual(['0010', '0020', '5550', '2430']);
		expect(rows[1].nations.map((nation) => nation.name)).toEqual(['Agua Caliente Band of Cahuilla Indians', 'Desert Band']);
		expect(rows[2].kindLabel).toBe('Oklahoma tribal statistical area');
	});

	it('marks the offices of nations with no land area, saying which are placed only by ZIP code', () => {
		expect(landAreaOffices()).toEqual([
			{
				nation: 'alabama-quassarte-tribal-town',
				shade: 0,
				href: '/nations/alabama-quassarte-tribal-town',
				description: 'Alabama-Quassarte Tribal Town: office of a nation with no Census land area'
			},
			{
				nation: 'amah-mutsun-tribal-band-of-mission-san-juan-bautista',
				shade: 0,
				href: '/nations/amah-mutsun-tribal-band-of-mission-san-juan-bautista',
				description: 'Amah Mutsun Tribal Band: office of a nation with no Census land area (placed by ZIP code)'
			}
		]);
	});
});

describe('the tiled map’s data', () => {
	const data = tileMapData();

	it('names the tile sets from the manifest', () => {
		expect(data.tiles.landAreas).toMatch(/^land-areas-/);
		expect(data.tiles.maximumZoom).toBeGreaterThan(data.tiles.worldMaximumZoom);
	});

	it('links only states with nations to a table row', () => {
		expect(data.states.NM).toEqual({ countClass: 1, anchor: 'state-NM', name: 'New Mexico', count: 2, point: [-106, 34], bounds: [-109, 31, -103, 37] });
		expect(data.states.TX.anchor).toBeUndefined();
	});

	it('draws every region from the Bureau’s outlines, each linked to its row', () => {
		expect(data.regions.features).toHaveLength(12);
		expect(data.regions.features.map((feature) => feature.properties.anchor)).toContain('region-pacific');
		for (const feature of data.regions.features) expect(feature.geometry.type).toMatch(/Polygon/);
	});

	it('labels an area by its one nation’s name, and by the Census name when several or none are linked', () => {
		const area = (code: string) => data.areas.find((entry) => entry.code === code)!;
		expect(area('0010')).toMatchObject({ label: 'Pueblo of Acoma', nations: 1, group: 'federal', anchor: 'land-area-0010' });
		expect(area('0020')).toMatchObject({ label: 'Agua Caliente Indian Reservation and Off-Reservation Trust Land', nations: 2 });
		expect(area('5550')).toMatchObject({ label: 'Cherokee OTSA', nations: 0 });
		expect(new Set(data.areas.map((entry) => entry.code)).size).toBe(data.areas.length);
	});

	it('gives each shaded view its shades, linking only what has a row', () => {
		expect(Object.keys(data.shading!)).toEqual(shadedMapViews);
		const publicLaw280 = data.shading!['public-law-280'];
		expect(publicLaw280.areas).toEqual({
			'0010': { shade: 1, anchor: 'public-law-280-pueblo-of-acoma' },
			'0020': { shade: 4, anchor: 'public-law-280-agua-caliente-band' }
		});
		expect(publicLaw280.offices).toEqual({ 'alabama-quassarte-tribal-town': { shade: 2, anchor: 'public-law-280-alabama-quassarte-tribal-town' } });
		expect(data.shading!['indian-health-service'].labels.map((label) => label.name).sort()).toEqual(['Albuquerque', 'California']);
		expect(publicLaw280.labels).toEqual([]);
	});

	it('gives a nation’s own page only the areas its entry names, without states, regions or shading', () => {
		const own = nationTileMapData(['0010', '9999']);
		expect(own.areas.map((area) => [area.code, area.label])).toEqual([['0010', 'Acoma Pueblo and Off-Reservation Trust Land']]);
		expect(own).toMatchObject({ states: {}, regions: { features: [] }, offices: [], shading: undefined });
	});
});

describe('a shaded view of one category per nation (Public Law 280)', () => {
	const view = shadedView('public-law-280');

	it('has a legend of the categories in order of precedence, then the unrecorded', () => {
		expect(view.legend.map((entry) => entry.key)).toEqual([...publicLaw280Categories.map((category) => category.key), 'unrecorded']);
		expect(view.legend.at(-1)).toEqual({ key: 'unrecorded', label: 'No Public Law 280 fact recorded yet', shade: 0 });
	});

	it('sums up each nation’s facts: retrocession over a mandatory state, and no state jurisdiction outside the list', () => {
		const category = (id: string) => view.nationRows.find((row) => row.id === id)?.category;
		expect(category('desert-band')).toBe('Some or all given back by the state (retrocession)');
		expect(category('agua-caliente-band')).toBe('State jurisdiction required by the statute');
		expect(category('alabama-quassarte-tribal-town')).toBe('State chose to take some or all jurisdiction');
		expect(category('pueblo-of-acoma')).toBe('No state jurisdiction under Public Law 280');
	});

	it('lists only nations with a fact, A to Z, with their states', () => {
		expect(view.nationRows.map((row) => row.name)).toEqual(['Agua Caliente Band of Cahuilla Indians', 'Alabama-Quassarte Tribal Town', 'Desert Band', 'Pueblo of Acoma']);
		expect(view.nationRows.find((row) => row.id === 'desert-band')!.states).toEqual(['Arizona', 'California']);
		expect(view.kindColumns).toEqual([]);
		expect(view.areaRows).toEqual([]);
	});

	it('shades an area two nations share by the category first in the legend', () => {
		const drawn = view.drawn.find((area) => area.identifier === '0020')!;
		expect(drawn).toEqual({
			identifier: '0020',
			shade: 4,
			anchor: 'public-law-280-agua-caliente-band',
			description: 'Agua Caliente Indian Reservation and Off-Reservation Trust Land: State jurisdiction required by the statute'
		});
		expect(view.drawn.find((area) => area.identifier === '5550')).toMatchObject({ shade: 0, anchor: undefined, description: 'Cherokee OTSA: No Public Law 280 fact recorded yet' });
	});

	it('shades an office by its nation’s category, or not at all when it has none', () => {
		expect(view.offices).toEqual([
			{ nation: 'alabama-quassarte-tribal-town', shade: 2, anchor: 'public-law-280-alabama-quassarte-tribal-town', description: 'Alabama-Quassarte Tribal Town (office; no Census land area): State chose to take some or all jurisdiction' },
			{
				nation: 'amah-mutsun-tribal-band-of-mission-san-juan-bautista',
				shade: 0,
				anchor: undefined,
				description: 'Amah Mutsun Tribal Band (office; no Census land area): No Public Law 280 fact recorded yet'
			}
		]);
	});

	it('counts each state’s nations by category, ties going to the category listed first', () => {
		const california = view.stateRows.find((row) => row.code === 'CA')!;
		expect(california).toMatchObject({ total: 3, counts: { mandatory: 1, returned: 1, unrecorded: 1 } });
		expect(california.members).toEqual({ mandatory: ['agua-caliente-band'], returned: ['desert-band'], unrecorded: ['amah-mutsun-tribal-band-of-mission-san-juan-bautista'] });
		const drawn = (code: string) => view.drawnStates.find((state) => state.code === code)!;
		expect(drawn('CA')).toMatchObject({ shade: 4, description: 'California: most often State jurisdiction required by the statute (1 of 3 nations)' });
		expect(drawn('AZ').description).toBe('Arizona: most often Some or all given back by the state (retrocession) (1 of 2 nations)');
		// One nation with a fact and one without: the fact wins the tie.
		expect(drawn('NM')).toMatchObject({ shade: 1, description: 'New Mexico: most often No state jurisdiction under Public Law 280 (1 of 2 nations)' });
		expect(drawn('TX')).toEqual({ code: 'TX', shade: 0, anchor: undefined, description: 'Texas: no nations recorded' });
		expect(view.stateRows.map((row) => row.name)).toEqual(['Arizona', 'California', 'New Mexico', 'Oklahoma']);
		expect(view.stateNations['desert-band']).toBe('Desert Band');
	});
});

describe('a shaded view of kinds (recognition)', () => {
	const view = shadedView('recognition');

	it('has a Yes column per kind, in the map’s order', () => {
		expect(view.kindColumns.map((column) => column.key)).toEqual(['federal', 'state', 'petitioning', 'other']);
		expect(view.nationRows.find((row) => row.id === 'example-state-tribe')!.kinds).toMatchObject({ federal: false, state: true });
	});

	it('counts state recognition only in the state that gives it', () => {
		const counts = (code: string) => view.stateRows.find((row) => row.code === code)!.counts;
		expect(counts('NM')).toEqual({ federal: 1, state: 1 });
		expect(counts('AZ')).toEqual({ federal: 1, unrecorded: 1 });
	});
});

describe('shaded views whose categories come from the entries', () => {
	it('lists heritage languages under the spelling most entries use, with one legend entry for them all', () => {
		const view = shadedView('heritage-languages');
		expect(view.areaRows.map((row) => row.name)).toEqual(['Cahuilla', "Dena'ina", 'Keres']);
		expect(view.areaRows[1].nations.map((nation) => nation.id)).toEqual(['alabama-quassarte-tribal-town', 'amah-mutsun-tribal-band-of-mission-san-juan-bautista', 'desert-band']);
		expect(view.legend.map((entry) => entry.key)).toEqual(['recorded', 'unrecorded']);
		// Too many languages for a map by state, and too many to write on the drawn map.
		expect(view.stateRows).toEqual([]);
		expect(view.labels).toEqual([]);
	});

	it('gives each Indian Health Service Area its own shade and its land areas', () => {
		const view = shadedView('indian-health-service');
		expect(view.legend.slice(0, 2)).toEqual([
			{ key: 'Albuquerque', label: 'Albuquerque Area', shade: healthServiceAreaShades.Albuquerque },
			{ key: 'California', label: 'California Area', shade: healthServiceAreaShades.California }
		]);
		expect(view.labels).toEqual([
			{ name: 'Albuquerque', identifiers: ['0010'] },
			{ name: 'California', identifiers: ['0020'] }
		]);
	});

	it('lists land areas by the people living there, with their nations', () => {
		const view = shadedView('census-residents');
		expect(view.areaRows.map((row) => [row.anchor, row.value, row.nations.length])).toEqual([
			['census-residents-0010', 3000, 1],
			['census-residents-0020', 400, 2]
		]);
		expect(view.areaRows[1].states).toEqual(['Arizona', 'California']);
		expect(view.stateRows).toEqual([]);
	});
});

describe('nationCategoryKeys', () => {
	it('gives the one category of a view that has one, and none when nothing is recorded', () => {
		expect(nationCategoryKeys('public-law-280', record('desert-band'))).toEqual(['returned']);
		expect(nationCategoryKeys('public-law-280', record('example-state-tribe'))).toEqual([]);
	});

	it('counts each treaty once', () => {
		expect(nationCategoryKeys('treaties', record('agua-caliente-band'))).toEqual(['one']);
		expect(nationCategoryKeys('treaties', record('desert-band'))).toEqual(['five-to-nine']);
	});

	it('gives every kind a nation has, in the view’s order', () => {
		expect(nationCategoryKeys('gaming', record('alabama-quassarte-tribal-town'))).toEqual(['compact']);
		// A compact whose every version was disapproved does not count.
		expect(nationCategoryKeys('gaming', record('pueblo-of-acoma'))).toEqual([]);
		expect(nationCategoryKeys('governing-documents', record('agua-caliente-band'))).toEqual(['constitution']);
	});
});
