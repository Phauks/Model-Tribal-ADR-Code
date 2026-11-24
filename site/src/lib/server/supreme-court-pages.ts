/**
 * What a Court's page shows (src/routes/supreme-court/[court]): who sat on
 * the Court and when, how its membership changed, a short history, and the
 * cases on this site that it decided, each fact with its source.
 *
 * Runs at build time only.
 */
import { readableDate } from '../readable-date.ts';
import type { CitationMark } from '../citation-marks.ts';
import { casePreviewList } from './case-previews.ts';
import { sources } from './content.ts';
import { renderMarkdown } from './markdown.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';
import { associatesOf, courts, justicesFile, seatLaws, seatLawsSource, surname, type Court, type Justice } from './supreme-courts.ts';
import type { InfoPicture } from '../info-page.ts';
import { portraitView, type FactGroup } from './justice-pages.ts';
import { decidedDay, justicePath, personForCase, personOf, presidentNamed, presidentPath } from './supreme-court-people.ts';

export interface BenchRow {
	name: string;
	role: Justice['role'];
	/** The Justice's page. */
	link: string;
	appointedBy: string;
	appointedByLink?: string;
	state: string;
	/** Oath and end of service, whole career. */
	joined: string;
	left?: string;
	ending?: string;
	/** Who held the seat before, or the statute that created it. */
	seat: string;
	/** The part of the service that fell within this Court, for the chart. */
	from: string;
	to: string;
}

export interface Change {
	date: string;
	dateText: string;
	events: string[];
}

/** Where an opinion goes in the cases table. */
export type OpinionColumn = 'court' | 'concurring' | 'dissenting';

export interface CaseOpinion {
	/** The Justice's surname, as the tables show it. */
	justice: string;
	/** The Justice's name as the case record gives it. */
	fullName: string;
	/** The Justice's page; none for a per curiam opinion. */
	link?: string;
	column: OpinionColumn;
	/** What kind of opinion, when the column alone does not say: "plurality", "in the judgment". */
	qualifier?: string;
	/** A vote the report notes with no opinion written, such as "Mr. Justice Harlan dissented." Not counted as an opinion. */
	unwritten?: true;
}

export interface CourtCase {
	key: string;
	name: string;
	citation: string;
	link?: string;
	decided?: string;
	decidedText?: string;
	vote?: string;
	/** Every opinion a Justice wrote in the case, in the table's order. */
	opinions: CaseOpinion[];
}

export interface CourtPage {
	key: string;
	name: string;
	chief: string;
	startText: string;
	endText?: string;
	years: string;
	facts: { label: string; text: string; marks: CitationMark[] }[];
	/** The Chief Justice's portrait, for At a glance. */
	picture?: InfoPicture;
	glance: FactGroup[];
	historyHtml: string;
	bench: BenchRow[];
	benchMarks: CitationMark[];
	start: string;
	end: string;
	changes: Change[];
	changeMarks: CitationMark[];
	cases: CourtCase[];
	sources: SourceEntry[];
}

interface CaseBench {
	court: string;
	decision_type?: string;
	vote?: { majority?: number | null; minority?: number | null };
	justices?: { name: string; vote: string; opinion?: string }[];
}

/**
 * Each kind of opinion the case records give (from Oyez's opinion types or
 * the official report), with its column and the words that say what it is
 * when the column does not. "joining the dissent in part" is a vote, not an
 * opinion the Justice wrote, so it is left out of the opinions.
 */
const opinionKinds: Record<string, { column: OpinionColumn; qualifier?: string; unwritten?: true } | null> = {
	majority: { column: 'court' },
	plurality: { column: 'court', qualifier: 'plurality' },
	judgment: { column: 'court', qualifier: 'announcing the judgment' },
	concurrence: { column: 'concurring' },
	'special concurrence': { column: 'concurring', qualifier: 'in the judgment' },
	'concurrence in the result': { column: 'concurring', qualifier: 'in the result' },
	'concurrence in the result without opinion': { column: 'concurring', qualifier: 'in the result, without an opinion', unwritten: true },
	'concurrence in part and in the judgment': { column: 'concurring', qualifier: 'in part and in the judgment' },
	'concurrence in part and dissent in part': { column: 'dissenting', qualifier: 'concurring in part' },
	'concurrence in part, concurrence in the judgment in part, and dissent in part': {
		column: 'dissenting',
		qualifier: 'concurring in part and in the judgment in part'
	},
	dissent: { column: 'dissenting' },
	'dissent in part': { column: 'dissenting', qualifier: 'in part' },
	'coauthored dissent': { column: 'dissenting', qualifier: 'written jointly' },
	'joining the dissent in part': null
};

const columnOrder: OpinionColumn[] = ['court', 'concurring', 'dissenting'];

/**
 * The opinions in one case, the opinion of the Court first, then
 * concurrences, then dissents. A Justice who dissented where no one in the
 * minority wrote ("Mr. Justice Brewer dissents.") is listed as dissenting
 * without an opinion; a per curiam opinion of the Court is listed as such.
 */
export function caseOpinions(key: string, bench: CaseBench, decided?: string): CaseOpinion[] {
	const link = (name: string) => justicePath(personForCase(name, decided, key));
	const justices = bench.justices ?? [];
	const opinions: CaseOpinion[] = [];
	if (bench.decision_type === 'per curiam' && !justices.some((justice) => opinionKinds[justice.opinion ?? '']?.column === 'court')) {
		opinions.push({ justice: 'Per curiam', fullName: 'Per curiam', column: 'court' });
	}
	for (const justice of justices) {
		if (!justice.opinion) continue;
		if (!(justice.opinion in opinionKinds)) {
			throw new Error(`content/sources ${key}: no column for the opinion type "${justice.opinion}"; add it to opinionKinds`);
		}
		const kind = opinionKinds[justice.opinion];
		if (kind) opinions.push({ justice: surname(justice.name), fullName: justice.name, link: link(justice.name), ...kind });
	}
	const minority = justices.filter((justice) => justice.vote === 'minority');
	if (bench.decision_type !== 'equally divided Court' && !minority.some((justice) => justice.opinion)) {
		for (const justice of minority) {
			opinions.push({ justice: surname(justice.name), fullName: justice.name, link: link(justice.name), column: 'dissenting', qualifier: 'without an opinion', unwritten: true });
		}
	}
	return opinions.sort((first, second) => columnOrder.indexOf(first.column) - columnOrder.indexOf(second.column));
}

const endingWords: Record<string, string> = {
	died: 'died',
	resigned: 'resigned',
	retired: 'retired',
	'became Chief Justice': 'became Chief Justice',
	'not confirmed': 'left when the Senate did not confirm him'
};

/** The day a Court's page treats as today, for the present Court: the day the list was checked. */
function today(): string {
	return justicesFile().checked;
}

function yearsBetween(start: string, end: string): number {
	const [startYear, startMonth, startDay] = start.split('-').map(Number);
	const [endYear, endMonth, endDay] = end.split('-').map(Number);
	let years = endYear - startYear;
	if (endMonth < startMonth || (endMonth === startMonth && endDay < startDay)) years -= 1;
	return years;
}

function seatText(court: Court, sourceUses: SourceUses, marks: CitationMark[]): string {
	const end = court.end ?? today();
	const before = seatLaws.filter((law) => law.date <= court.start).at(-1)!;
	const during = seatLaws.filter((law) => law.date > court.start && law.date < end);
	const parts = [String(before.seats), ...during.map((law) => `${law.seats} from ${readableDate(law.date)}`)];
	const text = parts.join('; ');
	sourceUses.cite(seatLawsSource, { section: 'Seats', text }, marks);
	return text;
}

function presidentLink(name: string): string | undefined {
	const president = presidentNamed(name);
	return president ? presidentPath(president) : undefined;
}

function benchRows(court: Court): BenchRow[] {
	const end = court.end ?? today();
	const members = [court.chief, ...associatesOf(court)];
	return members.map((justice) => ({
		name: justice.name,
		role: justice.role,
		link: justicePath(personOf(justice)),
		appointedBy: justice.appointed_by,
		appointedByLink: presidentLink(justice.appointed_by),
		state: justice.state,
		joined: justice.oath,
		left: justice.left,
		ending: justice.ending,
		seat: justice.follows ? justice.follows : justice.new_seat ? `New seat, ${justice.new_seat}` : '',
		from: justice.oath > court.start ? justice.oath : court.start,
		to: justice.left && justice.left < end ? justice.left : end
	}));
}

/** Each day the membership changed while the Court sat: who left, and who joined and in whose seat. */
function changes(court: Court): Change[] {
	const end = court.end ?? '9999-12-31';
	const byDate = new Map<string, string[]>();
	const add = (date: string, text: string) => byDate.set(date, [...(byDate.get(date) ?? []), text]);
	for (const justice of associatesOf(court)) {
		if (justice.left && justice.left > court.start && justice.left < end) {
			add(justice.left, `${justice.name} ${endingWords[justice.ending ?? ''] ?? 'left'}.`);
		}
		if (justice.oath > court.start && justice.oath < end) {
			const seat = justice.follows
				? `took the seat of ${justice.follows}`
				: justice.new_seat
					? `took a new seat (${justice.new_seat})`
					: 'joined';
			add(justice.oath, `${justice.name} ${seat}.`);
		}
	}
	if (court.end) add(court.end, `Chief Justice ${court.chief.name} ${endingWords[court.chief.ending ?? ''] ?? 'left'}.`);
	return [...byDate.entries()]
		.sort(([first], [second]) => first.localeCompare(second))
		.map(([date, events]) => ({ date, dateText: readableDate(date), events }));
}

function courtCases(court: Court): CourtCase[] {
	const previews = new Map(casePreviewList().cases.map((preview) => [preview.id, preview]));
	const found: CourtCase[] = [];
	for (const record of sources().values()) {
		const bench = (record as { supreme_court?: CaseBench }).supreme_court;
		if (bench?.court !== court.name) continue;
		const preview = previews.get(record.key);
		const decided = decidedDay(record.citation.issued);
		const { majority, minority } = bench.vote ?? {};
		found.push({
			key: record.key,
			name: record.citation.title ?? record.key,
			citation: preview?.citation ?? [record.citation.volume, 'U.S.', record.citation.page].filter(Boolean).join(' '),
			link: preview?.link,
			decided,
			decidedText: decided ? readableDate(decided) : undefined,
			vote: Number.isInteger(majority) && Number.isInteger(minority) ? `${majority}–${minority}` : undefined,
			opinions: caseOpinions(record.key, bench, decided)
		});
	}
	return found.sort((first, second) => (first.decided ?? '').localeCompare(second.decided ?? ''));
}

export function courtPage(key: string): CourtPage | null {
	const court = courts().find((candidate) => candidate.key === key && candidate.record);
	if (!court?.record) return null;
	const sourceUses = new SourceUses();
	const serviceSource = justicesFile().sources.service;
	const seatSource = justicesFile().sources.seats;

	sourceUses.part('About');
	const chiefMarks: CitationMark[] = [];
	sourceUses.cite(serviceSource, { section: 'Chief Justice', text: `${court.chief.name}, appointed by ${court.chief.appointed_by}` }, chiefMarks);
	const end = court.end ?? today();
	const span = court.end ? `${readableDate(court.start)} to ${readableDate(court.end)}` : `Since ${readableDate(court.start)}`;
	const servedMarks: CitationMark[] = [];
	sourceUses.cite(serviceSource, { section: 'Served', text: span }, servedMarks);
	const seatMarks: CitationMark[] = [];
	const seats = seatText(court, sourceUses, seatMarks);
	const chief = personOf(court.chief);
	const facts = [
		{ label: 'Chief Justice', text: court.chief.name, marks: chiefMarks },
		{ label: 'Served', text: span, marks: servedMarks },
		{ label: 'Seats', text: seats, marks: seatMarks }
	];

	sourceUses.part('History');
	const historyHtml = renderMarkdown(court.record.history, {
		cite: (source, locator) => sourceUses.cite(source, { section: 'History', text: `${court.name} history`, where: locator })
	});

	sourceUses.part('Justices');
	const bench = benchRows(court);
	const benchMarks: CitationMark[] = [];
	sourceUses.cite(serviceSource, { section: 'Justices', text: 'Each Justice, the appointing President and the dates of service' }, benchMarks);
	sourceUses.cite(seatSource, { section: 'Justices', text: 'The seat each Justice took and how service ended' }, benchMarks);
	const changeMarks = [serviceSource, seatSource].map((source) =>
		sourceUses.again(source, { section: 'Changes', text: 'Who joined and who left, and when' })
	);

	const years = `${court.start.slice(0, 4)}–${court.end ? court.end.slice(0, 4) : ''}`;
	return {
		key: court.key,
		name: court.name,
		chief: court.chief.name,
		startText: readableDate(court.start),
		endText: court.end ? readableDate(court.end) : undefined,
		years: `${years} (${yearsBetween(court.start, end)} years)`,
		facts,
		picture: portraitView(chief.portrait, chief.key, chief.name),
		glance: [
			{ field: 'chief', label: 'Chief Justice', items: [{ text: court.chief.name, link: justicePath(chief), citations: chiefMarks }] },
			{ field: 'served', label: 'Served', items: [{ text: span, citations: servedMarks }] },
			{ field: 'seats', label: 'Seats', items: [{ text: seats, citations: seatMarks }] }
		],
		historyHtml,
		bench,
		benchMarks,
		start: court.start,
		end,
		changes: changes(court),
		changeMarks,
		cases: courtCases(court),
		sources: sourceUses.list
	};
}

/** The Courts with pages, for the index and the prerender list. */
export function courtsWithPages(): { key: string; name: string; chief: string; years: string; cases: number }[] {
	const counts = new Map<string, number>();
	for (const record of sources().values()) {
		const court = (record as { supreme_court?: CaseBench }).supreme_court?.court;
		if (court) counts.set(court, (counts.get(court) ?? 0) + 1);
	}
	return courts()
		.filter((court) => court.record)
		.map((court) => ({
			key: court.key,
			name: court.name,
			chief: court.chief.name,
			years: `${court.start.slice(0, 4)}–${court.end ? court.end.slice(0, 4) : ''}`,
			cases: counts.get(court.name) ?? 0
		}));
}
