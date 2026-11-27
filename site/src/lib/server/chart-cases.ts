/**
 * The Supreme Court cases on this site as the Justice timelines draw them
 * (src/lib/bench-chart.ts): each case's outcome and how each Justice voted,
 * from the case record's `supreme_court` block (the Supreme Court Database
 * and Oyez, checked against the official reports).
 *
 * Runs at build time only.
 */
import type { BenchVote, CaseVote, ChartCase } from '../bench-chart.ts';
import { opinionLabels } from '../case-opinions.ts';
import { readableDate } from '../readable-date.ts';
import { casePreviewList } from './case-previews.ts';
import { sources } from './content.ts';
import { appointmentsOf, decidedDay, justicePath, personForCase } from './supreme-court-people.ts';
import { courtPath, surname } from './supreme-courts.ts';

interface CaseBench {
	court: string;
	decision_type?: string;
	vote?: { majority?: number | null; minority?: number | null };
	justices?: { name: string; vote: string; opinion?: string }[];
}

interface CaseRecord {
	key: string;
	citation: { title?: string; volume?: string | number; page?: string | number; issued?: { 'date-parts'?: number[][] } };
	supreme_court?: CaseBench;
}

/** The record's words for a vote. "in chambers" is one Justice deciding alone, so it counts with the majority. */
const votes: Record<string, BenchVote> = {
	majority: 'majority',
	minority: 'dissent',
	none: 'none',
	'not recorded': 'unknown',
	'in chambers': 'majority'
};

/** Kinds of opinion a Justice joined or noted without writing one. */
const notWritten = new Set(['concurrence in the result without opinion', 'joining the dissent in part']);

const joinedWords: Record<string, string> = { 'joining the dissent in part': 'joining the dissent in part' };

function caseVotes(record: CaseRecord, bench: CaseBench, decided: string | undefined): CaseVote[] {
	const ordered = (bench.justices ?? []).map((entry) => {
		const person = personForCase(entry.name, decided, record.key);
		const vote = votes[entry.vote];
		if (!vote) throw new Error(`content/sources ${record.key}: no meaning for the vote "${entry.vote}"; add it to votes in chart-cases.ts`);
		const appointment = appointmentsOf(person).find((each) => !decided || (each.oath <= decided && (each.left ?? '9999-12-31') >= decided));
		const opinion = entry.opinion ? (opinionLabels[entry.opinion] ?? joinedWords[entry.opinion] ?? entry.opinion) : undefined;
		const result: CaseVote = { person: person.key, name: surname(person.name), link: justicePath(person), vote };
		if (opinion) result.opinion = opinion;
		if (entry.opinion && !notWritten.has(entry.opinion)) result.wrote = true;
		if (appointment?.role === 'Chief Justice') result.chief = true;
		return { result, oath: appointment?.oath ?? '9999-12-31' };
	});
	const people = ordered.map((entry) => entry.result.person);
	const twice = people.find((person, index) => people.indexOf(person) !== index);
	if (twice) throw new Error(`content/sources ${record.key}: ${twice} is named twice in supreme_court.justices`);
	return ordered
		.sort((first, second) => Number(Boolean(second.result.chief)) - Number(Boolean(first.result.chief)) || first.oath.localeCompare(second.oath))
		.map((entry) => entry.result);
}

function chartCase(record: CaseRecord, bench: CaseBench, preview: { citation?: string; link?: string } | undefined): ChartCase {
	const decided = decidedDay(record.citation.issued);
	const { majority, minority } = bench.vote ?? {};
	const counted = Number.isInteger(majority) && Number.isInteger(minority);
	const item: ChartCase = {
		key: record.key,
		name: record.citation.title ?? record.key,
		// The preview's citation ends with the year, which the chart gives as a date.
		citation: (preview?.citation ?? [record.citation.volume, 'U.S.', record.citation.page].filter(Boolean).join(' ')).replace(/\s*\(\d{4}\)$/, ''),
		court: bench.court,
		outcome: !counted ? 'unknown' : bench.decision_type?.startsWith('equally divided') ? 'equally divided' : minority === 0 ? 'unanimous' : 'divided',
		votes: caseVotes(record, bench, decided)
	};
	if (preview?.link) item.link = preview.link;
	if (decided) {
		item.decided = decided;
		item.decidedText = readableDate(decided);
	}
	const courtLink = courtPath(bench.court);
	if (courtLink) item.courtLink = courtLink;
	if (counted) item.tally = `${majority}–${minority}`;
	if (bench.decision_type === 'per curiam') item.perCuriam = true;
	return item;
}

let everyCase: ChartCase[] | undefined;

/** Every Supreme Court case on this site, oldest first. */
export function chartCases(): ChartCase[] {
	if (!everyCase) {
		const previews = new Map(casePreviewList().cases.map((preview) => [preview.id, preview]));
		everyCase = [];
		for (const record of sources().values() as Iterable<CaseRecord>) {
			const bench = record.supreme_court;
			if (bench) everyCase.push(chartCase(record, bench, previews.get(record.key)));
		}
		everyCase.sort((first, second) => (first.decided ?? '').localeCompare(second.decided ?? '') || first.name.localeCompare(second.name));
	}
	return everyCase;
}

/** The cases a Court decided, as its case records name it ("White Court"). */
export function chartCasesOfCourt(court: string): ChartCase[] {
	return chartCases().filter((item) => item.court === court);
}

/** The cases in which any of these Justices sat. */
export function chartCasesOfPeople(people: string[]): ChartCase[] {
	const keys = new Set(people);
	return chartCases().filter((item) => item.votes.some((vote) => keys.has(vote.person)));
}
