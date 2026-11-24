/**
 * The Courts of the Supreme Court of the United States, each named for its
 * Chief Justice ("Marshall Court"), and who sat on each (Trevor, Nov. 23,
 * 2026: the Court named in a case box opens a page about that Court).
 *
 * Who served and when comes from content/supreme-court/justices.yaml, which
 * scripts/law/supreme_court_justices.py builds from the Court's own list and
 * the Federal Judicial Center's Directory. The Courts that have a page, with
 * a short history of each, are in content/supreme-court/courts.yaml.
 *
 * Runs at build time only (it reads the repository).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { repositoryRoot } from './content.ts';

export interface Justice {
	name: string;
	role: 'Chief Justice' | 'Associate Justice';
	state: string;
	appointed_by: string;
	/** The day the Justice took the judicial oath, which the Court counts as the start of service. */
	oath: string;
	/** Where the Court's list took the oath date from, when not its own minutes. */
	oath_note?: 'a' | 'b' | 'c';
	left?: string;
	ending?: string;
	/** The Federal Judicial Center's seat, such as SCT0603 (the third holder of seat 6). */
	seat: string;
	/** The statute that created the seat, for a Justice who filled a new one. */
	new_seat?: string;
	/** Who held the seat before. */
	follows?: string;
}

interface JusticesFile {
	sources: { service: string; seats: string };
	checked: string;
	justices: Justice[];
}

export interface CourtRecord {
	key: string;
	chief: string;
	/** Markdown with [@key] citations. */
	history: string;
}

/** One Court: a Chief Justice's time in office. */
export interface Court {
	key: string;
	/** "Marshall Court". */
	name: string;
	chief: Justice;
	start: string;
	/** The day the Chief Justice's service ended; none for the present Court. */
	end?: string;
	/** Whether the site has a page for it (a history in courts.yaml). */
	record?: CourtRecord;
}

let justicesCache: JusticesFile | undefined;
let courtsCache: Court[] | undefined;

function readYaml<T>(relative: string): T {
	return parse(readFileSync(path.join(repositoryRoot, relative), 'utf8').normalize('NFC')) as T;
}

export function justicesFile(): JusticesFile {
	justicesCache ??= readYaml<JusticesFile>('content/supreme-court/justices.yaml');
	return justicesCache;
}

/** "John Marshall" -> "Marshall"; "John G. Roberts, Jr." -> "Roberts". */
export function surname(name: string): string {
	return name.replace(/,\s*(?:Jr\.|Sr\.)$/, '').trim().split(/\s+/).pop() ?? name;
}

/** Every Court, oldest first. */
export function courts(): Court[] {
	if (!courtsCache) {
		const records = readYaml<{ courts: CourtRecord[] }>('content/supreme-court/courts.yaml').courts;
		courtsCache = justicesFile()
			.justices.filter((justice) => justice.role === 'Chief Justice')
			.sort((first, second) => first.oath.localeCompare(second.oath))
			.map((chief) => {
				const name = `${surname(chief.name)} Court`;
				const key = name.toLowerCase().replace(/[^a-z]+/g, '-');
				const record = records.find((candidate) => candidate.chief === chief.name);
				return { key, name, chief, start: chief.oath, end: chief.left, record };
			});
		for (const record of records) {
			if (!courtsCache.some((court) => court.record === record)) {
				throw new Error(`content/supreme-court/courts.yaml: no Chief Justice named ${record.chief} in justices.yaml`);
			}
		}
	}
	return courtsCache;
}

/** The address of a Court's page, by its name as case records give it ("Marshall Court"), or null when it has none. */
export function courtPath(name: string): string | null {
	const court = courts().find((candidate) => candidate.name === name && candidate.record);
	return court ? `/supreme-court/${court.key}` : null;
}

/** The Associate Justices who sat while this Chief Justice served. */
export function associatesOf(court: Court): Justice[] {
	const end = court.end ?? '9999-12-31';
	return justicesFile()
		.justices.filter(
			(justice) => justice.role === 'Associate Justice' && justice.oath < end && (justice.left ?? '9999-12-31') > court.start
		)
		.sort((first, second) => first.oath.localeCompare(second.oath));
}

/**
 * The number of seats on the Court as Congress set it (Federal Judicial
 * Center, "Supreme Court of the United States: Legislative History"). The
 * Judiciary Act of 1801 would have cut the Court to five at the next
 * vacancy, but it was repealed before one came, so it is left out; the Act
 * of 1866 cut the seats from ten to seven only as they fell vacant.
 */
export const seatLaws: { date: string; seats: number; statute: string }[] = [
	{ date: '1789-09-24', seats: 6, statute: '1 Stat. 73' },
	{ date: '1807-02-24', seats: 7, statute: '2 Stat. 420' },
	{ date: '1837-03-03', seats: 9, statute: '5 Stat. 176' },
	{ date: '1863-03-03', seats: 10, statute: '12 Stat. 794' },
	{ date: '1866-07-23', seats: 7, statute: '14 Stat. 209' },
	{ date: '1869-04-10', seats: 9, statute: '16 Stat. 44' }
];

export const seatLawsSource = 'federal-judicial-center-supreme-court-legislative-history';
