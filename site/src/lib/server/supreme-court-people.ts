/**
 * The Justices of the Supreme Court of the United States and the Presidents
 * who appointed them, as people (Trevor, Nov. 24, 2026: "sub-pages for each
 * justice and appointed by person to show their relationship to cases").
 *
 * content/supreme-court/people.yaml, which scripts/law/supreme_court_people.py
 * builds from the Federal Judicial Center's Directory, the Library of
 * Congress list of Presidents and Wikimedia Commons, has one entry per
 * person, with a portrait where its license allows one. Who served and when
 * still comes from justices.yaml, one entry per appointment; the two meet at
 * the seat (SCT0104), which the Directory gives for each appointment.
 *
 * Runs at build time only (it reads the repository).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from './content.ts';
import { justicesFile, surname, type Justice } from './supreme-courts.ts';

export interface Portrait {
	/** The file's name on Wikimedia Commons. */
	file: string;
	/** The file's page on Commons, which records its source and license. */
	page: string;
	artist?: string;
	credit?: string;
	date?: string;
	/** As Commons names it: "Public domain", "CC BY-SA 3.0". */
	license: string;
	license_link?: string;
	attribution_required: boolean;
	media_type: string;
	width: number;
	height: number;
	/** The private bucket's copy the site shows. */
	key: string;
	/** Commons' copy at the size the site shows, used to fill the bucket. */
	display_link: string;
	sha256?: string;
}

export interface Appointment {
	seat: string;
	title: string;
	recess_appointment?: string;
	nominated?: string;
	hearing?: string;
	confirmed?: string;
	senate_vote?: string;
	ayes_nays?: string;
	commissioned?: string;
	party_of_president?: string;
}

export interface JusticePerson {
	key: string;
	name: string;
	/** The Federal Judicial Center's number for the person. */
	directory: string;
	born: { date?: string; place?: string };
	died?: { date?: string; place?: string };
	education: { school: string; degree?: string; year?: string }[];
	career: string[];
	appointments: Appointment[];
	other_federal_service: ({ court: string; title: string; appointed_by?: string; commissioned?: string; ended?: string } | { text: string })[];
	portrait?: Portrait;
}

export interface PresidentPerson {
	key: string;
	/** As the Court's list gives it. */
	name: string;
	/** Years in office, from the Library of Congress list: [[1797, 1801]], or two runs for Grover Cleveland. */
	years: [number, number][];
	/** The present term's start, when the Library of Congress list stops before it. */
	serving_since?: string;
	party?: string;
	portrait?: Portrait;
}

interface PeopleFile {
	sources: { biography: string; presidents: string; inaugurations: string };
	checked: string;
	justices: JusticePerson[];
	presidents: PresidentPerson[];
}

let peopleCache: PeopleFile | undefined;

export function peopleFile(): PeopleFile {
	peopleCache ??= parse(readFileSync(path.join(repositoryRoot, 'content/supreme-court/people.yaml'), 'utf8').normalize('NFC')) as PeopleFile;
	return peopleCache;
}

/** The person who held an appointment. */
export function personOf(appointment: Justice): JusticePerson {
	const person = peopleFile().justices.find((candidate) => candidate.appointments.some((entry) => entry.seat === appointment.seat));
	if (!person) throw new Error(`content/supreme-court/people.yaml: no one holds seat ${appointment.seat}; run scripts/law/supreme_court_people.py`);
	return person;
}

/** Every appointment a person held, oldest first. */
export function appointmentsOf(person: JusticePerson): Justice[] {
	const seats = new Set(person.appointments.map((entry) => entry.seat));
	return justicesFile()
		.justices.filter((justice) => seats.has(justice.seat))
		.sort((first, second) => first.oath.localeCompare(second.oath));
}

export function justicePath(person: Pick<JusticePerson, 'key'>): string {
	return `/supreme-court/justices/${person.key}`;
}

export function presidentPath(person: Pick<PresidentPerson, 'key'>): string {
	return `/supreme-court/presidents/${person.key}`;
}

/** The President by the name the Court's list gives. */
export function presidentNamed(name: string): PresidentPerson | undefined {
	return peopleFile().presidents.find((candidate) => candidate.name === name);
}

/** "John Marshall" for the address /supreme-court/justices/john-marshall. */
export function justiceByKey(key: string): JusticePerson | undefined {
	return peopleFile().justices.find((candidate) => candidate.key === key);
}

export function presidentByKey(key: string): PresidentPerson | undefined {
	return peopleFile().presidents.find((candidate) => candidate.key === key);
}

/** Letters only, without accents, for comparing names. */
function plainName(name: string): string {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z]/g, '');
}

/**
 * The person a case record names ("Byron R. White", "John M. Harlan II"):
 * the Justice with that family name who was serving on the day the case was
 * decided, and the first initial where two were. Records spell names as Oyez
 * does ("Henry Brockholst Livingston" for the Court's "Brockholst
 * Livingston"), so the full name is not compared. A name that matches no one, or more than one, stops
 * the build, so a link never goes to the wrong person.
 */
export function personForCase(name: string, decided: string | undefined, caseKey: string): JusticePerson {
	// Every Justice and President page looks up every case's bench, so the same names come back thousands of times.
	const memoKey = `${name}|${decided ?? ''}`;
	const known = peopleForCases.get(memoKey);
	if (known) return known;
	const person = findPersonForCase(name, decided, caseKey);
	peopleForCases.set(memoKey, person);
	return person;
}

const peopleForCases = new Map<string, JusticePerson>();

function findPersonForCase(name: string, decided: string | undefined, caseKey: string): JusticePerson {
	const family = plainName(surname(name));
	const initial = plainName(name)[0];
	const serving = justicesFile().justices.filter(
		(appointment) =>
			plainName(surname(appointment.name)) === family &&
			(!decided || (appointment.oath <= decided && (appointment.left ?? '9999-12-31') >= decided))
	);
	let people = [...new Set(serving.map(personOf))];
	// Where two serving Justices share a family name, the first initial decides.
	if (people.length > 1) people = people.filter((person) => plainName(person.name)[0] === initial);
	if (people.length !== 1) {
		throw new Error(`content/sources ${caseKey}: "${name}" matches ${people.length} Justices serving on ${decided ?? 'the decision day'}`);
	}
	return people[0];
}

/** A record's decision day, YYYY-MM-DD, when it gives the full date. */
export function decidedDay(issued: { 'date-parts'?: number[][] } | undefined): string | undefined {
	const parts = issued?.['date-parts']?.[0] ?? [];
	return parts.length >= 3 ? `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}` : undefined;
}

/** The portraits the Worker may serve, for "virtual:portraits". */
export function servablePortraits(): { person: string; key: string; mediaType: string; sha256: string; link: string }[] {
	const { justices, presidents } = peopleFile();
	return [...justices, ...presidents]
		.filter((person) => person.portrait?.sha256)
		.map((person) => ({
			person: person.key,
			key: person.portrait!.key,
			mediaType: person.portrait!.media_type,
			sha256: person.portrait!.sha256!,
			link: person.portrait!.display_link
		}));
}

/** A portrait's credit line: "Henry Inman, 1832. Public domain." */
export function portraitCredit(portrait: Portrait): string {
	const maker = [portrait.artist, portrait.date].filter(Boolean).join(', ');
	const license = /^public domain$/i.test(portrait.license) ? 'Public domain' : portrait.license;
	return [maker, portrait.credit && portrait.credit !== portrait.artist ? portrait.credit : undefined, license].filter(Boolean).join('. ') + '.';
}
