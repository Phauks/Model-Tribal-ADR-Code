/**
 * Builds /search/records.json, what the advanced search filters on
 * (src/lib/search-records.ts). Each nation's facts are reduced to short
 * codes; each law or governing document the records list becomes a row that
 * links to the "Laws and agreements" part of its nation's page, never
 * straight off the site.
 */
import { humanize, stateName } from '../nation-labels.ts';
import type { FacetOption } from '../search-filters.ts';
import {
	courtOptions,
	disputeOptions,
	documentKindOptions,
	gamingOptions,
	lawOptions,
	type DocumentFile,
	type NationFile,
	type SearchRecordsFile
} from '../search-records.ts';
import { documentHistories, nations, type DocumentHistoryRecord, type NationRecord } from './content.ts';
import { nationIndexRows } from './nation-index.ts';
import { storySummaries } from './stories.ts';

/** Kinds of justice institution, by the court answer they give. */
const courtKinds: Record<string, string> = {
	'tribal-court': 'tribal-court',
	'district-court': 'tribal-court',
	'circuit-court': 'tribal-court',
	'family-court': 'tribal-court',
	'juvenile-court': 'tribal-court',
	'civil-court': 'tribal-court',
	'criminal-court': 'tribal-court',
	'traffic-court': 'tribal-court',
	'employment-court': 'tribal-court',
	'treatment-court': 'tribal-court',
	'judicial-branch': 'tribal-court',
	'court-of-appeals': 'appeals',
	'supreme-court': 'appeals',
	'intertribal-court-of-appeals': 'intertribal',
	'intertribal-court': 'intertribal',
	'healing-to-wellness-court': 'wellness',
	'court-of-indian-offenses': 'indian-offenses',
	'peacemaking-program': 'peacemaking',
	'traditional-forum': 'traditional'
};

/** Kinds of forum or provision, by the dispute answer they give. */
const disputeKinds: Record<string, string> = {
	peacemaking: 'peacemaking',
	'peacemaking-program': 'peacemaking',
	'traditional-forum': 'traditional',
	'traditional-dispute-resolution': 'traditional',
	'customary-dispute-resolution': 'traditional',
	'elders-council': 'traditional',
	'circle-process': 'traditional',
	'family-group-conference': 'restorative',
	'restorative-justice': 'restorative',
	mediation: 'mediation',
	'settlement-conference': 'mediation',
	arbitration: 'arbitration'
};

/** Kinds of governing document, by the law answer they give. */
const lawKinds: Record<string, string> = {
	constitution: 'constitution',
	'articles-of-association': 'constitution',
	'law-code': 'law-code',
	'court-rules': 'law-code',
	other: 'law-code',
	'corporate-charter': 'corporate-charter'
};

const recognitionCodes: Record<string, string> = {
	federal: 'federal',
	state: 'state',
	petitioning: 'petitioning',
	'congressional-special-relationship': 'other',
	'territorial-law': 'other'
};

const knownKinds = new Set(documentKindOptions.map((option) => option.value));

function inOrder(values: Set<string>, options: FacetOption[]): string[] {
	return options.map((option) => option.value).filter((value) => values.has(value));
}

function historiesByNation(): Map<string, DocumentHistoryRecord[]> {
	const byNation = new Map<string, DocumentHistoryRecord[]>();
	for (const history of documentHistories()) {
		for (const nation of history.nations ?? []) byNation.set(nation, [...(byNation.get(nation) ?? []), history]);
	}
	return byNation;
}

function nationRow(
	record: NationRecord,
	index: { name: string; states: string[]; statesText: string; recognition: { label: string }[] },
	histories: DocumentHistoryRecord[]
): NationFile {
	const recognition = new Set((record.recognition ?? []).map((fact) => recognitionCodes[fact.type]).filter(Boolean));
	if (!recognition.has('federal') && !recognition.has('state') && !recognition.has('other')) {
		if (!recognition.has('petitioning')) recognition.add('none');
	}
	const courts = new Set<string>();
	const dispute = new Set<string>();
	for (const institution of record.justice_institutions ?? []) {
		const code = courtKinds[institution.kind];
		if (!code) continue;
		if (disputeKinds[institution.kind]) dispute.add(disputeKinds[institution.kind]);
		else courts.add(code);
	}
	for (const item of [...(record.dispute_resolution?.forums ?? []), ...(record.dispute_resolution?.provisions ?? [])]) {
		const code = disputeKinds[item.kind];
		if (code) dispute.add(code);
	}
	const laws = new Set<string>();
	for (const document of record.governing_documents ?? []) {
		const code = lawKinds[document.kind];
		if (code) laws.add(code);
	}
	if ((record.dispute_resolution_law ?? []).length > 0) laws.add('law-code');
	const gaming = new Set<string>();
	if ((record.gaming?.compacts ?? []).length > 0) gaming.add('compact');
	if ((record.gaming?.ordinances ?? []).length > 0) gaming.add('ordinance');
	if (record.gaming?.operates_gaming?.value === true) gaming.add('operates');
	for (const history of histories) {
		if (lawKinds[history.kind]) laws.add(lawKinds[history.kind]);
		if (history.kind === 'gaming-compact' || history.kind === 'secretarial-procedures') gaming.add('compact');
	}
	const region = record.federal_administration?.bureau_of_indian_affairs_region;
	const courtList = inOrder(courts, courtOptions);
	const disputeList = inOrder(dispute, disputeOptions);
	const lawList = inOrder(laws, lawOptions);
	const gamingList = inOrder(gaming, gamingOptions);
	return {
		id: record.id,
		name: index.name,
		statesText: index.statesText,
		// A nation without federal or state recognition shows no label (Trevor, Nov. 23, 2026).
		recognitionText: (record.recognition ?? []).some((fact) => fact.type !== 'unrecognized')
			? index.recognition
					.map((view) => view.label)
					.filter((label) => label !== 'No federal recognition')
					.join('; ')
			: '',
		recognition: [...recognition],
		community: record.entity_type,
		states: index.states,
		region: region ? [region] : [],
		courts: courtList,
		dispute: disputeList,
		laws: lawList,
		gaming: gamingList
	};
}

/** The earliest year any version of a document gives. */
function firstYear(history: DocumentHistoryRecord): string | undefined {
	const years = history.versions
		.flatMap((version) => Object.values(version.dates ?? {}))
		.map((date) => /^(\d{4})/.exec(String(date))?.[1])
		.filter((year): year is string => Boolean(year))
		.sort();
	return years[0];
}

function documentRows(records: NationRecord[], names: Map<string, string>): DocumentFile[] {
	const rows: DocumentFile[] = [];
	const published = new Set(records.map((record) => record.id));
	for (const history of documentHistories()) {
		for (const nation of history.nations ?? []) {
			if (!published.has(nation)) continue;
			rows.push({
				title: history.title,
				kind: history.kind,
				...(firstYear(history) ? { year: firstYear(history) } : {}),
				nation,
				anchor: `document-${history.id}`
			});
		}
	}
	// Documents a record lists without a history of its own, once per title, as the nation's page lists them.
	const histories = historiesByNation();
	for (const record of records) {
		const kindsWithHistory = new Set((histories.get(record.id) ?? []).map((history) => history.kind));
		const seen = new Set<string>();
		for (const document of record.governing_documents ?? []) {
			if (kindsWithHistory.has(document.kind)) continue;
			const title = document.title ?? humanize(document.kind);
			const key = `${document.kind} ${title.toLocaleLowerCase('en-US')}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const year = document.year === undefined ? undefined : /^(\d{4})/.exec(String(document.year))?.[1];
			rows.push({
				title,
				kind: knownKinds.has(document.kind) ? document.kind : 'other',
				...(year ? { year } : {}),
				nation: record.id,
				anchor: 'law-heading'
			});
		}
	}
	return rows.sort(
		(first, second) =>
			(names.get(first.nation) ?? '').localeCompare(names.get(second.nation) ?? '', 'en', { sensitivity: 'base' }) ||
			first.title.localeCompare(second.title, 'en', { sensitivity: 'base' })
	);
}

export function searchRecords(): SearchRecordsFile {
	const records = nations();
	const byId = new Map(records.map((record) => [record.id, record]));
	const histories = historiesByNation();
	const index = nationIndexRows();
	const nationRows = index
		.map((row) => {
			const record = byId.get(row.id);
			return record ? nationRow(record, row, histories.get(row.id) ?? []) : undefined;
		})
		.filter((row): row is NationFile => row !== undefined);
	const names = new Map(nationRows.map((row) => [row.id, row.name]));
	const states = new Set(nationRows.flatMap((row) => row.states));
	const regions = new Set(nationRows.flatMap((row) => row.region));
	const storyNations: Record<string, string[]> = {};
	for (const story of storySummaries()) {
		storyNations[`/stories/${story.id}`] = story.nations.map((nation) => nation.id);
	}
	return {
		nations: nationRows,
		documents: documentRows(records, names),
		storyNations,
		stateOptions: [...states]
			.map((code) => ({ value: code, label: stateName(code) }))
			.sort((first, second) => first.label.localeCompare(second.label, 'en')),
		regionOptions: [...regions]
			.sort((first, second) => first.localeCompare(second, 'en'))
			.map((region) => ({ value: region, label: region }))
	};
}
