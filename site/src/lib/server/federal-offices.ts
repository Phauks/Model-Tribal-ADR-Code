/**
 * The pages about the federal offices that serve Native nations: each
 * Indian Health Service Area and each Bureau of Indian Affairs region with
 * its agencies, listing the nations whose records name the office. Which
 * nations an office serves comes from the nations' own records, so the page
 * lists the sources those records cite.
 */
import { agencyLink, bureauRegions, healthAreas, officeKey, type FederalOffice } from '../federal-offices.ts';
import { nations, sources, type NationRecord } from './content.ts';
import { groupsOf, nationIndexRows, type NationGroup, type NationIndexRow } from './nation-index.ts';

export interface OfficeSource {
	title: string;
	link?: string;
}

export interface OfficeSummary extends FederalOffice {
	count: number;
}

function rowsFor(ids: Set<string>): NationIndexRow[] {
	return nationIndexRows().filter((row) => ids.has(row.id));
}

function sourceList(keys: Set<string>): OfficeSource[] {
	return [...keys]
		.flatMap((key) => {
			const record = sources().get(key);
			if (!record) return [];
			const link = record.citation.URL ?? record.original_link;
			const author = record.citation.author?.[0]?.literal;
			const title = [author, record.citation.title ?? record.key].filter(Boolean).join(', ');
			return [{ title, link: link && URL.canParse(link) ? link : undefined }];
		})
		.sort((first, second) => first.title.localeCompare(second.title, 'en'));
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
	sources: OfficeSource[];
}

export function healthAreaView(key: string): HealthAreaView | undefined {
	const office = healthAreas.find((candidate) => candidate.key === key);
	if (!office) return undefined;
	const records = servedByArea(office.name);
	const names = new Map(nationIndexRows().map((row) => [row.id, row.name]));
	const keys = new Set<string>();
	const units = new Map<string, ServiceUnit>();
	for (const record of records) {
		for (const fact of record.indian_health_service ?? []) {
			if (fact.area !== office.name) continue;
			if (fact.source) keys.add(fact.source);
			if (!fact.service_unit) continue;
			const unit = units.get(fact.service_unit) ?? { name: fact.service_unit, nations: [] };
			if (!unit.nations.some((nation) => nation.id === record.id)) {
				unit.nations.push({
					id: record.id,
					name: names.get(record.id) ?? record.names.official,
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
		sources: sourceList(keys)
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
	sources: OfficeSource[];
}

export function bureauRegionView(key: string): BureauRegionView | undefined {
	const office = bureauRegions.find((candidate) => candidate.key === key);
	if (!office) return undefined;
	const records = servedByRegion(office.name);
	const rows = new Map(nationIndexRows().map((row) => [row.id, row]));
	const keys = new Set<string>();
	const agencies = new Map<string, AgencyView>();
	const unassigned: NationIndexRow[] = [];
	for (const record of records) {
		const administration = record.federal_administration;
		const row = rows.get(record.id);
		if (!administration || !row) continue;
		if (administration.source) keys.add(administration.source);
		const agency = administration.bureau_of_indian_affairs_agency;
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
		sources: sourceList(keys)
	};
}
