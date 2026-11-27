/**
 * What a Justice's page and a President's page show
 * (src/routes/supreme-court/justices/[justice] and presidents/[president]):
 * the person's portrait and key facts, their time on the Court or the
 * Justices they appointed drawn as bars with each case on this site marked,
 * and the cases on this site with how they voted and what they wrote (Trevor,
 * Nov. 24, 2026: "sub-pages for each justice and appointed by person to show
 * their relationship to cases and such", "want pictures").
 *
 * Runs at build time only.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { readableDate } from '../readable-date.ts';
import type { CitationMark } from '../citation-marks.ts';
import type { ChartCase } from '../bench-chart.ts';
import { casePreviewList } from './case-previews.ts';
import { chartCasesOfPeople } from './chart-cases.ts';
import { repositoryRoot, sources } from './content.ts';
import { SourceUses, type SourceEntry } from './source-uses.ts';
import {
	appointmentsOf,
	decidedDay,
	justicePath,
	peopleFile,
	personForCase,
	personOf,
	presidentByKey,
	presidentNamed,
	presidentPath,
	type JusticePerson,
	type PresidentPerson
} from './supreme-court-people.ts';
import { courtPath, courts, justicesFile, surname, type Justice } from './supreme-courts.ts';
import { pictureView } from './supreme-court-pictures.ts';
import type { InfoPicture } from '../info-page.ts';
import type { OutlineItem, PageFamily, PageOutline } from '../site-sections.ts';
import { presidentDocuments, termsOf, treatyDates, type PresidentDocument, type TermCase } from './president-documents.ts';

interface FactItem {
	label?: string;
	text: string;
	link?: string;
	citations?: CitationMark[];
	/** Words after the value, some linked; a part with a viewer title opens in the image viewer. */
	detailParts?: { text: string; link?: string; viewer?: string; original?: string }[];
}

export interface FactGroup {
	field: string;
	label: string;
	items: FactItem[];
}

export type PortraitView = InfoPicture;

/** A bar on a chart: the part of one appointment shown. */
export interface ServiceRow {
	name: string;
	/** The Justice's key (people.yaml), which each case's votes carry too. */
	person: string;
	role: string;
	from: string;
	to: string;
	link?: string;
}

/** A case on this site, as the charts and tables show it. */
export interface PersonCase {
	key: string;
	name: string;
	citation: string;
	link?: string;
	decided?: string;
	decidedText?: string;
	court: string;
	courtLink?: string;
	vote?: string;
	/** What each person on this page did: "Marshall: opinion of the Court". */
	parts: { name: string; link: string; part: string; wrote: boolean }[];
}

export interface JusticePage {
	key: string;
	name: string;
	/** "Chief Justice, 1801–1835". */
	summary: string;
	portrait?: PortraitView;
	glance: FactGroup[];
	rows: ServiceRow[];
	start: string;
	end: string;
	cases: PersonCase[];
	/** The same cases with each Justice's vote, for the chart. */
	chartCases: ChartCase[];
	/** Every post before and beside the Court, oldest first. */
	career: CareerLine[];
	careerMarks: CitationMark[];
	sources: SourceEntry[];
}

export interface AppointeeRow {
	key: string;
	name: string;
	link: string;
	role: string;
	joined: string;
	left?: string;
	cases: number;
}

export interface PresidentPage {
	key: string;
	name: string;
	summary: string;
	portrait?: PortraitView;
	glance: FactGroup[];
	/** What the President signed, and the cases decided in the term (president-documents.ts). */
	orders: PresidentDocument[];
	/** The browser of executive orders, filtered to this President, when they signed any. */
	ordersLink?: string;
	treaties: PresidentDocument[];
	treatyMarks: CitationMark[];
	acts: PresidentDocument[];
	decided: TermCase[];
	decidedMarks: CitationMark[];
	/** A nominee the Senate never confirmed, for a President who appointed no Justice. */
	nominees: string[];
	nomineeMarks: CitationMark[];
	appointees: AppointeeRow[];
	appointeeMarks: CitationMark[];
	rows: ServiceRow[];
	start: string;
	end: string;
	cases: PersonCase[];
	/** The same cases with each Justice's vote, for the chart. */
	chartCases: ChartCase[];
	sources: SourceEntry[];
	/** The side column: the page's sections (SiteSidebar.svelte), as on a nation's page. */
	outline: PageOutline;
	family: PageFamily;
}

interface BenchEntry {
	name: string;
	vote: string;
	opinion?: string;
}

interface CaseBench {
	court: string;
	decision_type?: string;
	vote?: { majority?: number | null; minority?: number | null };
	justices?: BenchEntry[];
}

/** What a Justice wrote, as the page says it. */
const opinionWords: Record<string, string> = {
	majority: 'Opinion of the Court',
	plurality: 'Plurality opinion',
	judgment: 'Opinion announcing the judgment',
	concurrence: 'Concurring opinion',
	'special concurrence': 'Opinion concurring in the judgment',
	'concurrence in the result': 'Opinion concurring in the result',
	'concurrence in the result without opinion': 'Concurred in the result, without an opinion',
	'concurrence in part and in the judgment': 'Opinion concurring in part and in the judgment',
	'concurrence in part and dissent in part': 'Opinion concurring in part and dissenting in part',
	'concurrence in part, concurrence in the judgment in part, and dissent in part':
		'Opinion concurring in part, concurring in the judgment in part, and dissenting in part',
	'concurrence in the judgment and dissent in part': 'Opinion concurring in the judgment and dissenting in part',
	dissent: 'Dissenting opinion',
	'dissent in part': 'Opinion dissenting in part',
	'coauthored dissent': 'Joint dissenting opinion',
	'joining the dissent in part': 'Joined the dissent in part',
	'in chambers': 'Opinion in chambers'
};

const written = new Set(Object.keys(opinionWords).filter((kind) => !['concurrence in the result without opinion', 'joining the dissent in part'].includes(kind)));

/** A Justice's part in one case, from the record's vote and opinion. */
function partIn(entry: BenchEntry, bench: CaseBench): { part: string; wrote: boolean } {
	if (entry.opinion) {
		if (!(entry.opinion in opinionWords)) throw new Error(`No words for the opinion type "${entry.opinion}"; add it to opinionWords`);
		return { part: opinionWords[entry.opinion], wrote: written.has(entry.opinion) };
	}
	if (entry.vote === 'majority') {
		return { part: bench.decision_type === 'per curiam' ? 'Joined the per curiam opinion' : 'Joined the majority', wrote: false };
	}
	if (entry.vote === 'minority') {
		const anyone = bench.justices?.some((other) => other.vote === 'minority' && other.opinion);
		return { part: anyone ? 'Joined the dissent' : 'Dissented, without an opinion', wrote: false };
	}
	if (entry.vote === 'not recorded') return { part: 'Vote not recorded', wrote: false };
	return { part: 'Took no part', wrote: false };
}

const endingWords: Record<string, string> = {
	died: 'died',
	resigned: 'resigned',
	retired: 'retired',
	'became Chief Justice': 'became Chief Justice',
	'not confirmed': 'not confirmed'
};

function today(): string {
	return justicesFile().checked;
}

/** Every Supreme Court case on this site, with the day it was decided. */
function siteCases(): { key: string; record: { citation: { title?: string; volume?: string; page?: string; issued?: { 'date-parts'?: number[][] } } }; bench: CaseBench; decided?: string }[] {
	const found = [];
	for (const record of sources().values()) {
		const bench = (record as { supreme_court?: CaseBench }).supreme_court;
		if (!bench) continue;
		found.push({ key: record.key, record, bench, decided: decidedDay(record.citation.issued) });
	}
	return found.sort((first, second) => (first.decided ?? '').localeCompare(second.decided ?? ''));
}

/** The cases in which any of these people sat, with what each did. */
function casesOf(people: JusticePerson[]): PersonCase[] {
	const keys = new Set(people.map((person) => person.key));
	const previews = new Map(casePreviewList().cases.map((preview) => [preview.id, preview]));
	const found: PersonCase[] = [];
	for (const { key, record, bench, decided } of siteCases()) {
		const parts: PersonCase['parts'] = [];
		for (const entry of bench.justices ?? []) {
			const person = personForCase(entry.name, decided, key);
			if (!keys.has(person.key)) continue;
			parts.push({ name: surname(person.name), link: justicePath(person), ...partIn(entry, bench) });
		}
		if (parts.length === 0) continue;
		const preview = previews.get(key);
		const { majority, minority } = bench.vote ?? {};
		found.push({
			key,
			name: record.citation.title ?? key,
			citation: preview?.citation ?? [record.citation.volume, 'U.S.', record.citation.page].filter(Boolean).join(' '),
			link: preview?.link,
			decided,
			decidedText: decided ? readableDate(decided) : undefined,
			court: bench.court,
			courtLink: courtPath(bench.court) ?? undefined,
			vote: Number.isInteger(majority) && Number.isInteger(minority) ? `${majority}–${minority}` : undefined,
			parts: parts.sort((first, second) => Number(second.wrote) - Number(first.wrote))
		});
	}
	return found;
}

function confirmedText(appointment: JusticePerson['appointments'][number]): string | undefined {
	if (!appointment.confirmed) return undefined;
	const vote = appointment.ayes_nays?.match(/^(\d+)\/(\d+)$/);
	if (vote) return `${readableDate(appointment.confirmed)}, ${vote[1]}–${vote[2]}`;
	if (appointment.senate_vote === 'Voice') return `${readableDate(appointment.confirmed)}, by voice vote`;
	return readableDate(appointment.confirmed);
}

function yearsOf(appointment: Justice): string {
	return `${appointment.oath.slice(0, 4)}–${appointment.left ? appointment.left.slice(0, 4) : ''}`;
}

export interface CareerLine {
	/** "1776–1780", "1782, 1784–1785", or empty where the Directory gives none. */
	years: string;
	text: string;
}

/** Years at the end of a Directory line: "1782, 1784-1785", "1817-", "1990-present". */
const trailingYears = /^(.*?)[,\s]+((?:\d{4}(?:-(?:\d{4}|present))?-?(?:,\s*)?)+)$/i;

/**
 * A line of the Directory's career list with its years taken out to stand on
 * their own (Trevor, Nov. 23, 2026: "segment by year rather than putting years
 * at the end"). In "Continental Army, Eleventh Virginia Regiment, 1776-1780;
 * lieutenant, 1776-1777; captain, 1777-1780" the first part's years lead and
 * the ranks keep theirs.
 */
export function careerLine(line: string): CareerLine {
	const [head, ...rest] = line.split(/;\s*/);
	const match = trailingYears.exec(head.trim());
	const dash = (text: string) => text.replace(/(\d{4})-(?=\d{4}|present)/gi, '$1–').replace(/(\d{4})-(?=$|,)/g, '$1–');
	if (!match) return { years: '', text: dash(line) };
	return { years: dash(match[2].replace(/,\s*$/, '')), text: dash([match[1], ...rest].join('; ')) };
}

/** Oldest first by the first year; a line without years stays after the one before it. */
function sortedCareer(lines: CareerLine[]): CareerLine[] {
	let previous = 0;
	return lines
		.map((line, index) => {
			const year = Number(/\d{4}/.exec(line.years)?.[0] ?? previous);
			previous = year;
			return { line, year, index };
		})
		.sort((one, two) => one.year - two.year || one.index - two.index)
		.map(({ line }) => line);
}

export function justicePage(key: string): JusticePage | null {
	const person = peopleFile().justices.find((candidate) => candidate.key === key);
	if (!person) return null;
	const sourceUses = new SourceUses();
	const serviceSource = justicesFile().sources.service;
	const seatSource = justicesFile().sources.seats;
	const biographySource = peopleFile().sources.biography;
	const appointments = appointmentsOf(person);
	const glance: FactGroup[] = [];

	sourceUses.part('At a glance');
	for (const appointment of appointments) {
		const details = person.appointments.find((entry) => entry.seat === appointment.seat);
		const items: FactItem[] = [];
		const president = presidentNamed(appointment.appointed_by);
		const cite = (source: string, text: string): CitationMark[] => {
			const marks: CitationMark[] = [];
			sourceUses.cite(source, { section: appointment.role, text }, marks);
			return marks;
		};
		items.push({ label: 'Appointed by', text: appointment.appointed_by, link: president ? presidentPath(president) : undefined, citations: cite(serviceSource, `Appointed by ${appointment.appointed_by}`) });
		if (details?.nominated) items.push({ label: 'Nominated', text: readableDate(details.nominated), citations: cite(biographySource, 'Nominated') });
		const confirmed = details ? confirmedText(details) : undefined;
		if (confirmed) items.push({ label: 'Confirmed', text: confirmed, citations: cite(biographySource, 'Confirmed') });
		if (details?.recess_appointment) items.push({ label: 'Recess appointment', text: readableDate(details.recess_appointment), citations: cite(biographySource, 'Recess appointment') });
		items.push({ label: 'Took the oath', text: readableDate(appointment.oath), citations: cite(serviceSource, 'Took the oath') });
		if (appointment.left) {
			const ending = appointment.ending ? ` (${endingWords[appointment.ending] ?? appointment.ending})` : '';
			items.push({ label: 'Left', text: `${readableDate(appointment.left)}${ending}`, citations: cite(seatSource, 'Left the Court, and how') });
		}
		const before = appointment.follows ? justicesFile().justices.find((other) => other.name === appointment.follows && other.seat < appointment.seat && other.seat.slice(0, 5) === appointment.seat.slice(0, 5)) : undefined;
		if (appointment.follows) {
			items.push({ label: 'Seat held before by', text: appointment.follows, link: before ? justicePath(personOf(before)) : undefined, citations: cite(seatSource, 'Seat held before by') });
		} else if (appointment.new_seat) {
			items.push({ label: 'Seat', text: `New seat, ${appointment.new_seat}`, citations: cite(seatSource, 'New seat') });
		}
		const after = justicesFile().justices.find((other) => other.follows === appointment.name && other.seat.slice(0, 5) === appointment.seat.slice(0, 5) && other.oath >= appointment.oath);
		if (after) items.push({ label: 'Followed by', text: after.name, link: justicePath(personOf(after)), citations: cite(seatSource, 'Followed by') });
		if (appointments.length === 1) {
			// One appointment: each fact on its own row, as the title already says the role.
			for (const item of items) glance.push({ field: `${appointment.seat}-${item.label}`, label: item.label!, items: [{ ...item, label: undefined }] });
		} else {
			glance.push({ field: appointment.seat, label: appointment.role, items });
		}
	}

	const sat = courts().filter((court) => appointments.some((appointment) => appointment.oath < (court.end ?? '9999-12-31') && (appointment.left ?? '9999-12-31') > court.start));
	const courtMarks: CitationMark[] = [];
	sourceUses.cite(serviceSource, { section: 'Courts', text: 'The Courts the Justice sat on' }, courtMarks);
	glance.push({
		field: 'courts',
		label: sat.length === 1 ? 'Court' : 'Courts',
		items: sat.map((court, index) => ({ text: court.name, link: court.record ? `/supreme-court/${court.key}` : undefined, citations: index === sat.length - 1 ? courtMarks : undefined }))
	});

	const lifeMarks = (text: string): CitationMark[] => {
		const marks: CitationMark[] = [];
		sourceUses.cite(biographySource, { section: 'At a glance', text }, marks);
		return marks;
	};
	if (person.born.date || person.born.place) {
		glance.push({ field: 'born', label: 'Born', items: [{ text: [person.born.date && readableDate(person.born.date), person.born.place].filter(Boolean).join(', '), citations: lifeMarks('Born') }] });
	}
	if (person.died && (person.died.date || person.died.place)) {
		glance.push({ field: 'died', label: 'Died', items: [{ text: [person.died.date && readableDate(person.died.date), person.died.place].filter(Boolean).join(', '), citations: lifeMarks('Died') }] });
	}
	if (person.education.length > 0) {
		const marks = lifeMarks('Education');
		glance.push({
			field: 'education',
			label: 'Education',
			items: person.education.map((school, index) => ({
				text: [school.school, school.degree, school.year].filter(Boolean).join(', '),
				citations: index === person.education.length - 1 ? marks : undefined
			}))
		});
	}

	sourceUses.part('Cases on this site');
	const rows: ServiceRow[] = appointments.map((appointment) => ({
		name: person.name,
		person: person.key,
		role: appointment.role,
		from: appointment.oath,
		to: appointment.left ?? today()
	}));
	// For an Associate Justice, the Chief Justices they served under, so the chart shows each Court.
	if (appointments.every((appointment) => appointment.role === 'Associate Justice')) {
		const start = appointments[0].oath;
		const end = appointments.at(-1)!.left ?? today();
		for (const court of sat) {
			rows.push({
				name: court.chief.name,
				person: personOf(court.chief).key,
				role: 'Chief Justice',
				from: court.start > start ? court.start : start,
				to: (court.end ?? today()) < end ? court.end! : end,
				link: justicePath(personOf(court.chief))
			});
		}
	}
	const cases = casesOf([person]);

	sourceUses.part('Career');
	const careerMarks: CitationMark[] = [];
	if (person.career.length > 0 || person.other_federal_service.length > 0) {
		sourceUses.cite(biographySource, { section: 'Career', text: 'Career before and beside the Court' }, careerMarks);
	}
	const otherService = person.other_federal_service.map((entry) =>
		'text' in entry
			? careerLine(entry.text)
			: careerLine(`${entry.title}, ${entry.court}, ${entry.commissioned?.slice(0, 4) ?? ''}-${entry.ended?.slice(0, 4) ?? 'present'}`)
	);
	const career = sortedCareer([...person.career.map(careerLine), ...otherService]);

	const roles = appointments.map((appointment) => `${appointment.role}, ${yearsOf(appointment)}`);
	return {
		key: person.key,
		name: person.name,
		summary: roles.join('; '),
		portrait: pictureView(person.key),
		glance,
		rows,
		start: appointments[0].oath,
		end: appointments.at(-1)!.left ?? today(),
		cases,
		chartCases: chartCasesOfPeople([person.key]),
		career,
		careerMarks,
		sources: sourceUses.list
	};
}

function presidentYears(president: PresidentPerson): string {
	const runs = president.years.map(([start, end]) => (start === end ? String(start) : `${start}–${end}`));
	if (president.serving_since) runs.push(`${president.serving_since.slice(0, 4)}–`);
	return runs.join(', ');
}

/** Nominees to the Court whom the Senate never confirmed, for a President who appointed no Justice (content/supreme-court/unconfirmed-nominations.yaml). */
interface UnconfirmedNominations {
	source: string;
	nominations: { president: string; nominee: string; nominated: string; outcome: string }[];
}

let unconfirmedCache: UnconfirmedNominations | undefined;

function unconfirmedNominations(): UnconfirmedNominations {
	unconfirmedCache ??= parse(readFileSync(path.join(repositoryRoot, 'content/supreme-court/unconfirmed-nominations.yaml'), 'utf8')) as UnconfirmedNominations;
	return unconfirmedCache;
}

/** "Apr. 15, 1865 – Mar. 4, 1869", or "Jan. 20, 2025 –" for the President serving now. */
function termText(run: { from: string; to?: string }): string {
	return run.to ? `${readableDate(run.from)} – ${readableDate(run.to)}` : `${readableDate(run.from)} –`;
}

export function presidentPage(key: string): PresidentPage | null {
	const president = peopleFile().presidents.find((candidate) => candidate.key === key);
	if (!president) return null;
	const sourceUses = new SourceUses();
	const files = peopleFile().sources;
	const serviceSource = justicesFile().sources.service;
	const path_ = presidentPath(president);
	const runs = termsOf(president.key);
	if (runs.length === 0) throw new Error(`src/lib/president-terms.ts has no term for ${president.key} (content/supreme-court/people.yaml)`);
	const documents = presidentDocuments(president.key);

	sourceUses.part('Key facts');
	const yearMarks: CitationMark[] = [];
	sourceUses.cite(files.presidents, { section: 'Key facts', text: 'In office' }, yearMarks);
	sourceUses.cite(files.inaugurations, { section: 'Key facts', text: 'In office: the first day of each term' }, yearMarks);
	const glance: FactGroup[] = [{ field: 'in-office', label: 'In office', items: runs.map((run) => ({ text: termText(run), citations: yearMarks })) }];
	if (president.party) {
		const marks: CitationMark[] = [];
		sourceUses.cite(files.biography, { section: 'Key facts', text: 'Party' }, marks);
		glance.push({ field: 'party', label: 'Party', items: [{ text: president.party, citations: marks }] });
	}
	const neighbor = (other: string | undefined): FactItem[] => {
		const person = other ? presidentByKey(other) : undefined;
		return person ? [{ text: person.name, link: presidentPath(person) }] : [];
	};
	const before = neighbor(runs[0].before);
	const after = neighbor(runs.at(-1)!.after);
	if (before.length > 0) glance.push({ field: 'before', label: 'Before', items: before });
	if (after.length > 0) glance.push({ field: 'after', label: 'After', items: after });

	sourceUses.part('Treaties proclaimed');
	const treatyMarks: CitationMark[] = [];
	if (documents.treaties.length > 0) sourceUses.cite(treatyDates().source, { section: 'Treaties proclaimed', text: 'The dates each treaty was signed and proclaimed, from the treaty’s header' }, treatyMarks);

	sourceUses.part('Justices appointed');
	const appointed = justicesFile()
		.justices.filter((appointment) => appointment.appointed_by === president.name)
		.sort((first, second) => first.oath.localeCompare(second.oath));
	const people = [...new Set(appointed.map(personOf))];
	const cases = casesOf(people);
	const appointees: AppointeeRow[] = appointed.map((appointment) => {
		const person = personOf(appointment);
		return {
			key: `${person.key}-${appointment.seat}`,
			name: appointment.name,
			link: justicePath(person),
			role: appointment.role,
			joined: appointment.oath,
			left: appointment.left,
			cases: cases.filter((item) => item.parts.some((part) => part.link === justicePath(person))).length
		};
	});
	const appointeeMarks: CitationMark[] = [];
	if (appointed.length > 0) sourceUses.cite(serviceSource, { section: 'Justices appointed', text: 'Each Justice the President appointed, and the dates of service' }, appointeeMarks);
	const unconfirmed = appointed.length > 0 ? [] : unconfirmedNominations().nominations.filter((entry) => entry.president === president.key);
	const nomineeMarks: CitationMark[] = [];
	if (unconfirmed.length > 0) sourceUses.cite(unconfirmedNominations().source, { section: 'Justices appointed', text: 'Nominees the Senate did not confirm' }, nomineeMarks);
	const nominees = unconfirmed.map((entry) => `He nominated ${entry.nominee} on ${readableDate(entry.nominated)}; ${entry.outcome}.`);
	const rows: ServiceRow[] = appointed.map((appointment) => ({
		name: appointment.name,
		person: personOf(appointment).key,
		role: appointment.role,
		from: appointment.oath,
		to: appointment.left ?? today(),
		link: justicePath(personOf(appointment))
	}));

	sourceUses.part('Supreme Court cases decided');
	const decidedMarks: CitationMark[] = [];
	if (documents.cases.length > 0) {
		sourceUses.cite(files.presidents, { section: 'Supreme Court cases decided', text: 'The years of the term' }, decidedMarks);
		sourceUses.cite(files.inaugurations, { section: 'Supreme Court cases decided', text: 'The first day of each term' }, decidedMarks);
	}

	// The side column: the page's own sections, in the page's order, as on a nation's page.
	const items: OutlineItem[] = [
		{ label: 'Executive orders and proclamations', link: '#orders-heading' },
		{ label: 'Treaties proclaimed', link: '#treaties-heading' },
		{ label: 'Acts of Congress', link: '#acts-heading' },
		{ label: 'Justices appointed', link: '#justices-heading' },
		{ label: 'Supreme Court cases decided', link: '#decided-heading' },
		...(cases.length > 0 ? [{ label: 'Cases heard by Justices he appointed', link: '#cases-heading' }] : []),
		{ label: 'References', link: '#sources-heading' }
	];

	return {
		key: president.key,
		name: president.name,
		summary: `President, ${presidentYears(president)}`,
		portrait: pictureView(president.key),
		glance,
		orders: documents.orders,
		ordersLink: documents.orders.length > 0 ? `/laws/executive-orders?president=${encodeURIComponent(president.key)}` : undefined,
		treaties: documents.treaties,
		treatyMarks,
		acts: documents.acts,
		decided: documents.cases,
		decidedMarks,
		nominees,
		nomineeMarks,
		appointees,
		appointeeMarks,
		rows,
		start: rows.reduce((first, row) => (row.from < first ? row.from : first), rows[0]?.from ?? today()),
		end: rows.reduce((last, row) => (row.to > last ? row.to : last), rows[0]?.to ?? today()),
		cases,
		chartCases: chartCasesOfPeople(people.map((each) => each.key)),
		sources: sourceUses.list,
		outline: { title: president.name, items },
		family: { title: president.name, link: path_, pages: [{ label: 'President Page', link: path_ }] }
	};
}

/** Every Justice and President with a page, for the prerender lists and the Supreme Court index. */
export function justiceKeys(): string[] {
	return peopleFile().justices.map((person) => person.key);
}

export function presidentKeys(): string[] {
	return peopleFile().presidents.map((person) => person.key);
}

/** The Supreme Court index's tables: every Justice and every appointing President, with their cases on this site. */
export function peopleIndex(): {
	justices: { key: string; name: string; link: string; roles: string; years: string; start: string; appointedBy: string[]; cases: number }[];
	presidents: { key: string; name: string; link: string; years: string; start: number; justices: number; cases: number }[];
} {
	const everyCase = casesOf(peopleFile().justices);
	const justices = peopleFile().justices.map((person) => {
		const appointments = appointmentsOf(person);
		return {
			key: person.key,
			name: person.name,
			link: justicePath(person),
			roles: [...new Set(appointments.map((appointment) => appointment.role))].join(', '),
			years: `${appointments[0].oath.slice(0, 4)}–${appointments.at(-1)!.left?.slice(0, 4) ?? ''}`,
			start: appointments[0].oath,
			appointedBy: [...new Set(appointments.map((appointment) => appointment.appointed_by))],
			cases: everyCase.filter((item) => item.parts.some((part) => part.link === justicePath(person))).length
		};
	});
	const presidents = peopleFile().presidents.map((president) => {
		const appointed = justicesFile().justices.filter((appointment) => appointment.appointed_by === president.name);
		const links = new Set(appointed.map((appointment) => justicePath(personOf(appointment))));
		return {
			key: president.key,
			name: president.name,
			link: presidentPath(president),
			years: presidentYears(president),
			start: president.years[0][0],
			justices: appointed.length,
			cases: everyCase.filter((item) => item.parts.some((part) => links.has(part.link))).length
		};
	});
	return { justices, presidents };
}
