/**
 * The pages about the federal offices that serve Native nations: each
 * Indian Health Service Area and each Bureau of Indian Affairs region with
 * its agencies, listing the nations whose records name the office. Which
 * nations an office serves comes from the nations' own records, so the page
 * lists the sources those records cite, as References with the fact each
 * one supports (site/DESIGN.md, "Info pages").
 */
import { agencyLink, bureauRegionPage, bureauRegions, healthAreaPage, healthAreas, officeKey, regionOfficesChecked, type FederalOffice, type OfficeAddress } from '../federal-offices.ts';
import { regionAnchor, stateName } from '../nation-labels.ts';
import { recognitionBadges, type RecognitionBadge } from '../recognition-badges.ts';
import { shadedRowAnchor } from '../shaded-map-views.ts';
import { nations, type NationRecord } from './content.ts';
import { groupsOf, nationIndexRows, type NationGroup, type NationIndexRow } from './nation-index.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';

export interface OfficeSummary extends FederalOffice {
	count: number;
}

function rowsFor(ids: Set<string>): NationIndexRow[] {
	return nationIndexRows().filter((row) => ids.has(row.id));
}

function servedByArea(area: string): NationRecord[] {
	return nations().filter((record) => (record.indian_health_service ?? []).some((fact) => fact.area === area));
}

function servedByRegion(region: string): NationRecord[] {
	return nations().filter((record) => record.federal_administration?.bureau_of_indian_affairs_region === region);
}

export function officeSummaries(): { areas: OfficeSummary[]; regions: OfficeSummary[] } {
	return {
		areas: healthAreas.map((office) => ({ ...office, count: servedByArea(office.name).length })),
		regions: bureauRegions.map((office) => ({ ...office, count: servedByRegion(office.name).length }))
	};
}

export interface ServiceUnit {
	name: string;
	nations: { id: string; name: string; runBy?: string }[];
}

export interface HealthAreaView {
	office: FederalOffice;
	groups: NationGroup[];
	count: number;
	serviceUnits: ServiceUnit[];
	sources: SourceEntry[];
}

export function healthAreaView(key: string): HealthAreaView | undefined {
	const office = healthAreas.find((candidate) => candidate.key === key);
	if (!office) return undefined;
	const records = servedByArea(office.name);
	const names = new Map(nationIndexRows().map((row) => [row.id, row.name]));
	const uses = new SourceUses();
	const units = new Map<string, ServiceUnit>();
	for (const record of records) {
		const name = names.get(record.id) ?? record.names.official;
		for (const fact of record.indian_health_service ?? []) {
			if (fact.area !== office.name) continue;
			uses.use(fact, 'Nations served', fact.service_unit ? `${name}: ${fact.service_unit}` : name);
			if (!fact.service_unit) continue;
			const unit = units.get(fact.service_unit) ?? { name: fact.service_unit, nations: [] };
			if (!unit.nations.some((nation) => nation.id === record.id)) {
				unit.nations.push({
					id: record.id,
					name,
					runBy:
						fact.operator === 'tribal'
							? 'run by the nation or a Tribal organization'
							: fact.operator === 'indian-health-service'
								? 'run by the Indian Health Service'
								: undefined
				});
			}
			units.set(fact.service_unit, unit);
		}
	}
	const rows = rowsFor(new Set(records.map((record) => record.id)));
	return {
		office,
		groups: groupsOf(rows),
		count: rows.length,
		serviceUnits: [...units.values()].sort((first, second) => first.name.localeCompare(second.name, 'en')),
		sources: uses.list
	};
}

export interface AgencyView {
	name: string;
	key: string;
	link?: string;
	nations: NationIndexRow[];
}

export interface BureauRegionView {
	office: FederalOffice & { office?: OfficeAddress };
	agencies: AgencyView[];
	unassigned: NationIndexRow[];
	count: number;
	sources: SourceEntry[];
}

export function bureauRegionView(key: string): BureauRegionView | undefined {
	const office = bureauRegions.find((candidate) => candidate.key === key);
	if (!office) return undefined;
	const records = servedByRegion(office.name);
	const rows = new Map(nationIndexRows().map((row) => [row.id, row]));
	const uses = new SourceUses();
	const agencies = new Map<string, AgencyView>();
	const unassigned: NationIndexRow[] = [];
	const byRowName = (record: NationRecord) => rows.get(record.id)?.name ?? '';
	for (const record of [...records].sort((first, second) => byRowName(first).localeCompare(byRowName(second), 'en'))) {
		const administration = record.federal_administration;
		const row = rows.get(record.id);
		if (!administration || !row) continue;
		const agency = administration.bureau_of_indian_affairs_agency;
		uses.use(administration, 'Nations served', agency ? `${row.name}: ${agency}` : row.name);
		if (!agency) {
			unassigned.push(row);
			continue;
		}
		const view = agencies.get(agency) ?? { name: agency, key: officeKey(agency), link: agencyLink(agency), nations: [] };
		view.nations.push(row);
		agencies.set(agency, view);
	}
	const byName = (first: { name: string }, second: { name: string }) => first.name.localeCompare(second.name, 'en');
	for (const view of agencies.values()) view.nations.sort(byName);
	return {
		office,
		agencies: [...agencies.values()].sort(byName),
		unassigned: unassigned.sort(byName),
		count: records.length,
		sources: uses.list
	};
}

/** A regional office, Area or agency on the Federal offices page's map and in its Offices table. */
export interface OfficePlace {
	name: string;
	key: string;
	/** The id the map's shapes and the search choose it by. */
	anchor: string;
	/** Its page on this site. */
	href: string;
	/** Its own page on bia.gov or ihs.gov. */
	link?: string;
	address?: OfficeAddress;
	nations: { id: string; name: string }[];
	/** State and territory names. */
	states: string[];
}

export interface RegionPlace extends OfficePlace {
	agencies: OfficePlace[];
}

export interface AreaPlace extends OfficePlace {
	serviceUnits: string[];
}

/** One nation's federal offices, for its details on the map. */
export interface NationOffices {
	name: string;
	badges: RecognitionBadge[];
	region?: { name: string; href: string };
	agency?: { name: string; href: string };
	area?: { name: string; href: string };
	serviceUnit?: string;
}

/** Writes each state code as the state's name, in name order. */
const stateNames = (codes: Iterable<string>) => [...new Set(codes)].map(stateName).sort((first, second) => first.localeCompare(second, 'en'));

/**
 * The Federal offices page (approved mockup, 2026-11-28): the regions with their regional offices and agencies, the Indian Health Service Areas, each nation's offices, and the nations on each Census land area, so a place chosen on the map opens its offices. Which office serves a nation comes from the nations' own records; the regional offices' addresses from the regions' pages on bia.gov.
 */
export function federalOfficesPage() {
	const rows = new Map(nationIndexRows().map((row) => [row.id, row]));
	const uses = new SourceUses();
	const byName = (first: { name: string }, second: { name: string }) => first.name.localeCompare(second.name, 'en');
	const nationsOf = (records: NationRecord[]) => records.flatMap((record) => (rows.has(record.id) ? [{ id: record.id, name: rows.get(record.id)!.name }] : [])).sort(byName);
	const statesOf = (records: NationRecord[]) => stateNames(records.flatMap((record) => rows.get(record.id)?.states ?? []));

	uses.add('bia-regions-2026', { section: 'Map', text: 'the twelve regions, simplified for a national map' });
	const regions: RegionPlace[] = bureauRegions.map((office) => {
		const records = servedByRegion(office.name);
		const href = bureauRegionPage(office.name) ?? '';
		const agencies = new Map<string, NationRecord[]>();
		for (const record of records) {
			const administration = record.federal_administration;
			if (administration?.source) uses.add(administration.source, { section: 'Offices', text: 'the Bureau of Indian Affairs region and agency that serve each nation' });
			const agency = administration?.bureau_of_indian_affairs_agency;
			if (agency) agencies.set(agency, [...(agencies.get(agency) ?? []), record]);
		}
		if (office.office) uses.add('bia-regional-office-pages-2026', { section: 'Offices', text: `${office.name} Regional Office: ${office.office.lines.join(', ')}` });
		return {
			name: `${office.name} Region`,
			key: office.key,
			anchor: regionAnchor(office.name),
			href,
			link: office.link,
			address: office.office,
			nations: nationsOf(records),
			states: statesOf(records),
			agencies: [...agencies.entries()]
				.map(([name, served]) => ({ name, key: officeKey(name), anchor: `agency-${officeKey(name)}`, href: bureauRegionPage(office.name, name) ?? href, link: agencyLink(name), nations: nationsOf(served), states: statesOf(served) }))
				.sort(byName)
		};
	});

	const areas: AreaPlace[] = healthAreas.map((office) => {
		const records = servedByArea(office.name);
		const units = new Set<string>();
		for (const record of records) {
			for (const fact of record.indian_health_service ?? []) {
				if (fact.area !== office.name) continue;
				if (fact.source) uses.add(fact.source, { section: 'Offices', text: 'the Indian Health Service Area that serves each nation' });
				if (fact.service_unit) units.add(fact.service_unit);
			}
		}
		return {
			name: `${office.name} Area`,
			key: office.key,
			anchor: shadedRowAnchor('indian-health-service', office.name),
			href: healthAreaPage(office.name) ?? '',
			link: office.link,
			nations: nationsOf(records),
			states: statesOf(records),
			serviceUnits: [...units].sort((first, second) => first.localeCompare(second, 'en'))
		};
	});

	const nationOffices: Record<string, NationOffices> = {};
	const landAreas: Record<string, string[]> = {};
	for (const record of nations()) {
		const row = rows.get(record.id);
		if (!row) continue;
		const administration = record.federal_administration;
		const region = administration?.bureau_of_indian_affairs_region;
		const agency = administration?.bureau_of_indian_affairs_agency;
		const health = record.indian_health_service ?? [];
		const area = health.find((fact) => fact.area)?.area;
		const unit = health.find((fact) => fact.area === area && fact.service_unit);
		const operator = health.find((fact) => fact.area === area && fact.service_unit === unit?.service_unit && fact.operator)?.operator ?? unit?.operator;
		const runBy = operator === 'tribal' ? 'run by the nation or a Tribal organization' : operator === 'indian-health-service' ? 'run by the Indian Health Service' : undefined;
		nationOffices[record.id] = {
			name: row.name,
			badges: recognitionBadges(record.recognition ?? []),
			region: region ? { name: `${region} Region`, href: bureauRegionPage(region) ?? '' } : undefined,
			agency: region && agency ? { name: agency, href: bureauRegionPage(region, agency) ?? '' } : undefined,
			area: area ? { name: `${area} Area`, href: healthAreaPage(area) ?? '' } : undefined,
			serviceUnit: unit?.service_unit ? [unit.service_unit, runBy].filter(Boolean).join(', ') : undefined
		};
		for (const census of record.census_areas ?? []) {
			if (census.vintage && census.vintage !== '2020') continue;
			const list = (landAreas[census.geographic_identifier] ??= []);
			if (!list.includes(record.id)) list.push(record.id);
		}
	}

	return { regions, areas, nations: nationOffices, landAreas, checked: regionOfficesChecked, sources: uses.list };
}
