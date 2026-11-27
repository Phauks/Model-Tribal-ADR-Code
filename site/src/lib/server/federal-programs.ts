/**
 * The federal programs a nation takes part in, as the nation page's table
 * "Self-governance and federal programs" and its Key facts row show them,
 * and the program pages that list every nation in one program (Trevor, Nov.
 * 26, 2026: "get it in there", mockup B with the latest amount). A record
 * has one fact per program per source: a participant list gives the dates,
 * a funding list the amount. The table shows one row per program, agency and
 * organization, with the dates of the participant list and the latest year's
 * amount, and every fact's marker.
 */
import { amountText, federalProgram, federalPrograms, shortDate, type FederalProgram } from '../federal-programs.ts';
import type { CitedFact, NationRecord } from './content.ts';
import { nations } from './content.ts';
import { nationIndexRows } from './nation-index.ts';
import { SourceUses, type CitationMark, type SourceEntry } from './source-uses.ts';

export type ProgramFact = NonNullable<NationRecord['federal_programs']>[number];

export interface ProgramRow {
	key: string;
	program: FederalProgram;
	/** "Interior self-governance compact", "477 plan (10 programs)". */
	name: string;
	agency: string;
	/** "Since 1991", "Oct. 1, 2026 to Sept. 30, 2030", "Round 2, from Aug. 2023", "Fiscal year 2024". */
	dates: string;
	/** Sorts the Dates column: the year or date the row starts. */
	datesSort: string;
	through?: string;
	/** The latest fiscal year's amount, added up over the row's facts for that year. */
	amount?: string;
	amountSort?: number;
	facts: ProgramFact[];
}

const order = new Map(federalPrograms.map((program, index) => [program.key, index]));

const simple = (text: string) => text.toLocaleLowerCase('en-US').replace(/\b(inc|incorporated|incorporation|corp|corporation|the)\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function datesOf(fact: ProgramFact): { text: string; sort: string } | undefined {
	if (fact.since) return { text: `Since ${fact.since}`, sort: String(fact.since) };
	if (fact.start && fact.end) return { text: `${shortDate(fact.start)} to ${shortDate(fact.end)}`, sort: fact.start };
	if (fact.start) return { text: fact.detail ? `${fact.detail.split(' (')[0]}, from ${shortDate(fact.start)}` : `From ${shortDate(fact.start)}`, sort: fact.start };
	if (fact.fiscal_year) return { text: `Fiscal year ${fact.fiscal_year}`, sort: String(fact.fiscal_year) };
	return undefined;
}

/** The record's programs, one row per program, agency and organization, in the order of federalPrograms. */
export function programRows(record: NationRecord): ProgramRow[] {
	const groups = new Map<string, ProgramFact[]>();
	for (const fact of record.federal_programs ?? []) {
		if (!federalProgram(fact.program)) continue;
		// A housing allocation for one community of a nation, such as Saint Paul Island, is its own row.
		const community = fact.program === 'indian-housing-block-grant' && !fact.through ? fact.detail : undefined;
		const key = [fact.program, fact.program === 'interior-non-bia-funding-agreement' ? fact.agency : '', simple(fact.through ?? ''), community ?? ''].join('|');
		groups.set(key, [...(groups.get(key) ?? []), fact]);
	}
	const rows: ProgramRow[] = [];
	for (const [key, facts] of groups) {
		const program = federalProgram(facts[0].program)!;
		const listed = facts.filter((fact) => fact.amount === undefined);
		const dates = [...listed, ...facts].map(datesOf).find(Boolean);
		const withAmount = facts.filter((fact) => fact.amount !== undefined && fact.fiscal_year);
		const latest = Math.max(...withAmount.map((fact) => fact.fiscal_year!));
		const total = withAmount.filter((fact) => fact.fiscal_year === latest).reduce((sum, fact) => sum + fact.amount!, 0);
		const included = facts.find((fact) => fact.programs_included?.length)?.programs_included?.length;
		const community = facts[0].program === 'indian-housing-block-grant' && !facts[0].through ? facts[0].detail : undefined;
		rows.push({
			key,
			program,
			name: included ? `${program.name} (${included} ${included === 1 ? 'program' : 'programs'})` : community ? `${program.name} (${community})` : program.name,
			agency: facts.find((fact) => fact.agency)?.agency ?? program.agency,
			dates: dates?.text ?? '',
			datesSort: dates?.sort ?? '',
			through: facts.find((fact) => fact.through)?.through,
			amount: withAmount.length > 0 ? amountText(total, latest) : undefined,
			amountSort: withAmount.length > 0 ? total : undefined,
			facts
		});
	}
	return rows.sort((first, second) => (order.get(first.program.key) ?? 0) - (order.get(second.program.key) ?? 0) || first.datesSort.localeCompare(second.datesSort) || first.name.localeCompare(second.name, 'en'));
}

/**
 * Key facts: the self-governance compacts by department and first year,
 * "Interior (1991), Indian Health Service (1994), Transportation (2022)", or
 * "Indian Health Service (through Tribal organizations, 2011)" when only
 * organizations acting for the nation hold the compact.
 */
export function selfGovernanceGlance(rows: ProgramRow[]): { text: string; facts: ProgramFact[] }[] {
	return federalPrograms
		.filter((program) => program.glance)
		.flatMap((program) => {
			const own = rows.filter((row) => row.program.key === program.key);
			if (own.length === 0) return [];
			const facts = own.flatMap((row) => row.facts);
			const years = facts.flatMap((fact) => (fact.since ? [fact.since] : []));
			const viaOthers = own.every((row) => row.through);
			const throughWords = viaOthers ? `through ${own.length === 1 ? 'a Tribal organization' : 'Tribal organizations'}` : undefined;
			const inside = [throughWords, years.length > 0 ? String(Math.min(...years)) : undefined].filter(Boolean).join(', ');
			return [{ text: inside ? `${program.glance} (${inside})` : program.glance!, facts }];
		});
}

/** One nation's rows in a program, for the program's page. */
export interface ParticipantRow {
	key: string;
	id: string;
	nation: string;
	dates: string;
	datesSort: string;
	through?: string;
	agency?: string;
	amount?: string;
	amountSort?: number;
	citations: CitationMark[];
}

export interface ProgramSummary {
	program: FederalProgram;
	count: number;
}

function participants(key: string): { record: NationRecord; rows: ProgramRow[] }[] {
	return nations()
		.map((record) => ({ record, rows: programRows(record).filter((row) => row.program.key === key) }))
		.filter((entry) => entry.rows.length > 0);
}

/** How many nations take part in at least one program, for the Statistics page. */
export const nationsInPrograms = () => nations().filter((record) => programRows(record).length > 0).length;

export function programSummaries(): ProgramSummary[] {
	return federalPrograms.map((program) => ({ program, count: participants(program.key).length }));
}

export interface ProgramView {
	program: FederalProgram;
	rows: ParticipantRow[];
	count: number;
	hasThrough: boolean;
	hasAgency: boolean;
	hasAmount: boolean;
	sources: SourceEntry[];
}

export function programView(key: string): ProgramView | undefined {
	const program = federalProgram(key);
	if (!program) return undefined;
	const names = new Map(nationIndexRows().map((row) => [row.id, row.name]));
	const uses = new SourceUses();
	const rows: ParticipantRow[] = [];
	const entries = participants(key).sort((first, second) => (names.get(first.record.id) ?? '').localeCompare(names.get(second.record.id) ?? '', 'en'));
	for (const { record, rows: programRowsOfNation } of entries) {
		const nation = names.get(record.id) ?? record.names.official;
		for (const row of programRowsOfNation) {
			const citations: CitationMark[] = [];
			for (const fact of row.facts) uses.citeFact(fact as CitedFact, 'Nations taking part', row.through ? `${nation}, through ${row.through}` : nation, citations);
			rows.push({
				key: `${record.id}|${row.key}`,
				id: record.id,
				nation,
				dates: row.dates,
				datesSort: row.datesSort,
				through: row.through,
				agency: key === 'interior-non-bia-funding-agreement' ? row.agency : undefined,
				amount: row.amount,
				amountSort: row.amountSort,
				citations
			});
		}
	}
	return {
		program,
		rows,
		count: entries.length,
		hasThrough: rows.some((row) => row.through),
		hasAgency: rows.some((row) => row.agency),
		hasAmount: rows.some((row) => row.amount),
		sources: uses.list
	};
}
