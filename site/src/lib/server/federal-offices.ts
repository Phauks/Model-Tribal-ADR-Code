/**
 * The pages about the federal offices that serve Native nations: each
 * Indian Health Service Area and each Bureau of Indian Affairs region with
 * its agencies, listing the nations whose records name the office. Which
 * nations an office serves comes from the nations' own records, so the page
 * lists the sources those records cite, as References with the fact each
 * one supports (site/DESIGN.md, "Info pages").
 */
import { agencyLink, bureauRegions, healthAreas, officeKey, type FederalOffice } from '../federal-offices.ts';
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
	office: FederalOffice;
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
