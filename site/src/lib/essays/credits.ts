/**
 * Credits under each section heading of an essay (docs/editing.md,
 * "Credits"). The lead author chose on Nov. 24, 2026 ("History plus Add
 * someone", essay-editor/screenshots/attest-proposal-mockup.png) to credit a
 * section from three places, in place of attesting:
 *
 * - the edit history: who wrote the words still there and who changed
 *   them (word-blame.ts);
 * - review requests: who is reviewing the section, and who finished;
 * - credits added by hand, by someone with full access, for what the
 *   history cannot know, such as research.
 *
 * Readers see a name only when its person chose, once, in Profile and
 * credit, to be credited on the website. Used by the editor and the server
 * alike.
 */

export const creditRoles = ['wrote', 'edited', 'researched', 'reviewed'] as const;
export type CreditRole = (typeof creditRoles)[number];

/** How each role reads in the line under a heading. */
export const creditRoleLabels: Record<CreditRole, string> = {
	wrote: 'Written by',
	edited: 'Edited by',
	researched: 'Researched by',
	reviewed: 'Reviewed by'
};

/** How each role reads in the Credits popover: "Researched it". */
export const creditRoleDoings: Record<CreditRole, string> = {
	wrote: 'Wrote it',
	edited: 'Edited it',
	researched: 'Researched it',
	reviewed: 'Reviewed it'
};

/** How each role reads as a choice when adding someone. */
export const creditRoleChoices: Record<CreditRole, string> = {
	wrote: 'Wrote',
	edited: 'Edited',
	researched: 'Researched',
	reviewed: 'Reviewed'
};

export function isCreditRole(value: unknown): value is CreditRole {
	return typeof value === 'string' && (creditRoles as readonly string[]).includes(value);
}

/** One person's part in a section from the edit history, as the editor shows it. */
export interface HistoryCredit {
	person: string;
	name: string;
	role: 'wrote' | 'edited';
	/** Words of theirs still in the section. */
	words: number;
	/** Paragraphs of the section they changed. */
	paragraphs: number;
	/** When the words still there were first saved, the first and last. */
	wordsFrom: string | null;
	wordsTo: string | null;
	/** When they changed the section, the first and last time. */
	changedFrom: string | null;
	changedTo: string | null;
}

/** A credit someone added by hand. */
export interface HandCredit {
	identifier: string;
	sectionSlug: string;
	person: string;
	name: string;
	role: CreditRole;
	addedBy: string;
	addedByName: string;
	addedAt: string;
}

/** What the edit history says about one section of a saved version. */
export interface SectionCredits {
	slug: string;
	title: string;
	level: 2 | 3;
	/** Words in the section, its heading's and subsections' included. */
	total: number;
	history: HistoryCredit[];
}

/** Everything the editor needs for the credits under its headings. */
export interface EssayCredits {
	/** The saved version the history is of. */
	version: number | null;
	sections: SectionCredits[];
	hand: HandCredit[];
	/** People who can be added by hand: everyone on the project. */
	people: { identifier: string; name: string }[];
	/** Whether the person asking can add and take away credits (full access). */
	canAdd: boolean;
}

/** "Ann", "Ann and Ben", "Ann, Ben, and Cal" (the style guide uses the serial comma). */
export function joinNames(names: string[]): string {
	if (names.length < 3) return names.join(' and ');
	return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

/** One credit in a section's line: a role and its people, in order. */
export interface CreditLine {
	role: CreditRole;
	people: { person: string; name: string }[];
}

/**
 * The line under a heading: written, edited, researched, reviewed, each with
 * its people, from the history, finished reviews and credits added by hand.
 * A person shows once per role, and someone who wrote a section is not also
 * listed as editing it.
 */
export function creditLine(
	section: Pick<SectionCredits, 'history'> | undefined,
	hand: Pick<HandCredit, 'person' | 'name' | 'role'>[],
	reviewed: { person: string; name: string }[]
): CreditLine[] {
	const byRole = new Map<CreditRole, Map<string, string>>(creditRoles.map((role) => [role, new Map()]));
	for (const credit of section?.history ?? []) byRole.get(credit.role)!.set(credit.person, credit.name);
	for (const credit of hand) byRole.get(credit.role)!.set(credit.person, credit.name);
	for (const reviewer of reviewed) byRole.get('reviewed')!.set(reviewer.person, reviewer.name);
	for (const person of byRole.get('wrote')!.keys()) byRole.get('edited')!.delete(person);
	return creditRoles
		.map((role) => ({ role, people: [...byRole.get(role)!].map(([person, name]) => ({ person, name })) }))
		.filter((line) => line.people.length > 0);
}

/** The credits added by hand that stand now: the newest row per section, person and role, if it adds. */
export function standingHandCredits<T extends { sectionSlug: string; person: string; role: CreditRole; action: 'add' | 'remove'; addedAt: string }>(rows: T[]): T[] {
	const newest = new Map<string, T>();
	for (const row of rows) {
		const key = `${row.sectionSlug} ${row.person} ${row.role}`;
		const known = newest.get(key);
		if (!known || known.addedAt <= row.addedAt) newest.set(key, row);
	}
	return [...newest.values()].filter((row) => row.action === 'add').sort((first, second) => first.addedAt.localeCompare(second.addedAt));
}

/** Who finished reviewing a section, from its review requests. */
export function finishedReviewers(
	requests: { sectionSlug: string | null; reviewers: { personIdentifier: string; personName: string; doneAt: string | null }[] }[],
	slug: string
): { person: string; name: string }[] {
	const found = new Map<string, string>();
	for (const request of requests) {
		if (request.sectionSlug !== slug) continue;
		for (const reviewer of request.reviewers) if (reviewer.doneAt) found.set(reviewer.personIdentifier, reviewer.personName);
	}
	return [...found].map(([person, name]) => ({ person, name }));
}

/** The credit lines readers see, by heading id, with each name as its person chose to be credited and their contributor page, if any. */
export type ReaderCredits = Record<string, { role: CreditRole; people: { name: string; link: string | null }[] }[]>;

function escapeText(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Puts each section's credit line under its heading in an essay's HTML: "Written by Ann. Researched by Ben and Cal." */
export function withReaderCredits(html: string, credits: ReaderCredits): string {
	if (Object.keys(credits).length === 0) return html;
	return html.replace(/(<h([23])\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/h\2>)/g, (heading: string, _all: string, _level: string, slug: string) => {
		const lines = credits[slug];
		if (!lines?.length) return heading;
		const text = lines
			.map((line) => {
				const names = line.people.map((person) => (person.link ? `<a href="${escapeText(person.link)}">${escapeText(person.name)}</a>` : escapeText(person.name)));
				return `${creditRoleLabels[line.role]} ${joinNames(names)}.`;
			})
			.join(' ');
		return `${heading}\n<p class="essay-section-credit">${text}</p>`;
	});
}
