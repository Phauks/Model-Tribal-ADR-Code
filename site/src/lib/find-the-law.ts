/**
 * Find the law (/nations/law): one Native nation's law on one subject, from
 * every part of the site at once: the nation's own law, court decisions,
 * agreements, and the federal law and jurisdiction that apply. Product idea 1
 * in the refactor report; Trevor approved the mockup, with its seven subjects,
 * on Nov. 24, 2026 (design/find-the-law).
 *
 * Each item is tagged with the subjects it belongs to when the nation's file
 * is built (src/lib/server/find-the-law.ts); the page only filters. The nation
 * and the subject go in the page address, so the result is linkable.
 */

/** The subjects a reader picks from, in the order the dropdown lists them. */
export const lawSubjects = [
	{ key: 'courts', label: 'Courts and procedure' },
	{ key: 'family', label: 'Family and children' },
	{ key: 'criminal', label: 'Criminal' },
	{ key: 'land', label: 'Land and resources' },
	{ key: 'gaming', label: 'Gaming' },
	{ key: 'business', label: 'Business and employment' },
	{ key: 'government', label: 'Government and elections' }
] as const;

export type LawSubject = (typeof lawSubjects)[number]['key'];

/** "all" shows every item of the nation, with its subjects. */
export type LawSubjectChoice = LawSubject | 'all';

export const lawSubjectLabels: Record<LawSubject, string> = Object.fromEntries(
	lawSubjects.map((subject) => [subject.key, subject.label])
) as Record<LawSubject, string>;

export function isLawSubject(value: string | null | undefined): value is LawSubject {
	return lawSubjects.some((subject) => subject.key === value);
}

/** The parts of a result, always in this order, each shown even when empty ("None Identified"). */
export const lawParts = [
	{ key: 'tribal', heading: 'Tribal law and courts' },
	{ key: 'decisions', heading: 'Court decisions' },
	{ key: 'agreements', heading: 'Agreements' },
	{ key: 'federal', heading: 'Federal law and jurisdiction' }
] as const;

export type LawPart = (typeof lawParts)[number]['key'];

/** One thing a reader can open: a code section, a court, an opinion, a compact, a federal law. */
export interface LawItem {
	key: string;
	part: LawPart;
	/** What it is, such as "Code section", "Tribal court opinion" or "Gaming compact". */
	kind: string;
	title: string;
	/** Case names are set in italics. */
	italic?: boolean;
	/** Its page on this site, or where it is published. Never a repository link. */
	link?: string;
	/** The citation or a short detail under the title. */
	detail?: string;
	/** YYYY, YYYY-MM or YYYY-MM-DD. */
	date?: string;
	subjects: LawSubject[];
	/** True for the federal laws that apply to every nation, so the table can say so. */
	everyNation?: boolean;
}

/** One nation's file, /nations/law/<id>.json. */
export interface NationLaw {
	id: string;
	name: string;
	/** Where the nation publishes its laws, linked: read the full code there. */
	codes: { title: string; link: string }[];
	items: LawItem[];
	/** The nation's published Tribal court opinions; only some are sorted by subject. */
	opinions?: { count: number; link: string };
}

/** The page address for a nation and a subject. */
export function lawAddress(nation: string, subject: LawSubjectChoice): string {
	const search = new URLSearchParams();
	if (nation) search.set('nation', nation);
	if (subject !== 'all') search.set('subject', subject);
	const query = search.toString();
	return `/nations/law${query ? `?${query}` : ''}`;
}

/** The items of one part for the subject chosen. */
export function itemsFor(law: NationLaw, part: LawPart, subject: LawSubjectChoice): LawItem[] {
	return law.items.filter((item) => item.part === part && (subject === 'all' ? item.subjects.length > 0 : item.subjects.includes(subject)));
}
