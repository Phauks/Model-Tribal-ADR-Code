/**
 * The Justices of the Supreme Court of the United States and the Presidents
 * who appointed them, as people (Trevor, Nov. 24, 2026: "sub-pages for each
 * justice and appointed by person to show their relationship to cases").
 *
 * content/supreme-court/people.yaml, which scripts/law/supreme_court_people.py
 * builds from the Federal Judicial Center's Directory, the Library of
 * Congress list of Presidents, has one entry per person; each person's
 * picture is in pictures.yaml (supreme-court-pictures.ts). Who served and when
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
	return `/presidents/${person.key}`;
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

/**
 * The address of the page of the Justice a case record names, or nothing
 * where the name is no one's (per curiam's "The Court") or fits more than one
 * Justice serving that day, so a link never goes to the wrong person.
 */
export function justiceLinkFor(name: string, decided: string | undefined, caseKey: string): string | undefined {
	try {
		return justicePath(personForCase(name, decided, caseKey));
	} catch {
		return undefined;
	}
}

/** A record's decision day, YYYY-MM-DD, when it gives the full date. */
export function decidedDay(issued: { 'date-parts'?: number[][] } | undefined): string | undefined {
	const parts = issued?.['date-parts']?.[0] ?? [];
	return parts.length >= 3 ? `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}` : undefined;
}
