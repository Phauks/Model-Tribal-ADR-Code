/**
 * What a law's page (law-pages.ts) says beyond its record's box: an
 * executive order's number and the President who signed it, and the nation
 * pages that cite the law. Kept apart from law-pages.ts so the tests can read
 * it without the essays.
 */
import { displayName } from '../nation-labels.ts';
import { presidentOn, presidentTerms, type PresidentTerm } from '../president-terms.ts';
import { nations, type SourceRecord } from './content.ts';

export interface LawNation {
	id: string;
	name: string;
	/** What the nation's page cites the law for, such as "Jemez Pueblo additional lands, New Mexico". */
	what: string[];
}

/** [1906, 12, 19] as "1906-12-19". */
export function isoOf(parts: number[] | undefined): string | undefined {
	if (!parts?.length) return undefined;
	return parts.map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0'))).join('-');
}

/**
 * The order's number: "Exec. Order No. 537" in its citation, "Executive
 * Order 14053" in its title. Most orders from before 1907 have none.
 */
export function orderNumber(record: SourceRecord): string | undefined {
	const notes = (record as SourceRecord & { notes?: string }).notes ?? '';
	return (/Executive Order (?:No\. )?(\d+(?:-[A-Z])?)\b/.exec(record.citation.title ?? '') ?? /Exec\. Order No\. (\d+(?:-[A-Z])?)\b/.exec(notes))?.[1];
}

/** The words a name is matched on: its first and last, without "Jr.". */
function nameEnds(name: string): [string, string] {
	const words = name.replace(/,?\s+Jr\.?$/, '').toLocaleLowerCase('en-US').split(/\s+/);
	return [words[0], words.at(-1)!];
}

/**
 * The President who signed an order: the one its record names ("President:
 * …", from the Oklahoma State University Tribal Treaties Database), else the
 * one in office on the day it is dated (president-terms.ts). Where a name
 * fits two terms (Grover Cleveland, the two Bushes) the term nearest the
 * date wins.
 */
export function orderPresident(record: SourceRecord): PresidentTerm | undefined {
	const date = isoOf(record.citation.issued?.['date-parts']?.[0]);
	const inOffice = presidentOn(date);
	const notes = (record as SourceRecord & { notes?: string }).notes ?? '';
	// scripts/law/executive_order_records.py writes "President: Ulysses S. Grant. Date from …".
	const named = /President: (.+?)\.\s+Date from/.exec(notes)?.[1]?.trim();
	if (!named) return inOffice;
	const [first, last] = nameEnds(named);
	const fits = presidentTerms.filter((term) => {
		const [termFirst, termLast] = nameEnds(term.name);
		return termFirst === first && termLast === last;
	});
	if (fits.length === 0) return inOffice;
	return fits.find((term) => term.key === inOffice?.key) ?? fits.reduce((best, term) => (date && Math.abs(Number(term.from.slice(0, 4)) - Number(date.slice(0, 4))) < Math.abs(Number(best.from.slice(0, 4)) - Number(date.slice(0, 4))) ? term : best));
}

let citingNations: Map<string, LawNation[]> | undefined;

/** What a cited fact on a nation page is about, in the words the page uses. */
function factSubject(fact: Record<string, unknown>): string | undefined {
	for (const field of ['land_area', 'title', 'name', 'organization', 'state']) {
		if (typeof fact[field] === 'string' && fact[field]) return fact[field] as string;
	}
	return undefined;
}

/**
 * Every source key each published nation page cites, with what for, worked
 * out once per build: a law's page lists the nations whose pages cite it.
 */
export function nationsCiting(key: string): LawNation[] {
	if (!citingNations) {
		citingNations = new Map();
		for (const record of nations()) {
			if ((record as { example?: boolean }).example) continue;
			const found = new Map<string, Set<string>>();
			const walk = (value: unknown): void => {
				if (Array.isArray(value)) return value.forEach(walk);
				if (!value || typeof value !== 'object') return;
				const fact = value as Record<string, unknown>;
				if (typeof fact.source === 'string') {
					const what = found.get(fact.source) ?? new Set<string>();
					const subject = factSubject(fact);
					if (subject) what.add(subject);
					found.set(fact.source, what);
				}
				Object.values(fact).forEach(walk);
			};
			walk(record);
			for (const [source, what] of found) {
				const list = citingNations.get(source) ?? [];
				list.push({ id: record.id, name: displayName(record.names.official), what: [...what] });
				citingNations.set(source, list);
			}
		}
		for (const list of citingNations.values()) list.sort((one, other) => one.name.localeCompare(other.name, 'en', { sensitivity: 'base' }));
	}
	return citingNations.get(key) ?? [];
}

