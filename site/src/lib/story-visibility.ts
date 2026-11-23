/**
 * Which story records, tellings and excerpts the website may show (decision
 * records 0019 and 0029). Kept free of build-time imports so the rules can be
 * tested on their own.
 *
 * - A story or telling marked `restricted` is never shown.
 * - One `embargoed` is shown only from its `until` date.
 * - One marked `nation-review-first` is shown with a notice that the nation
 *   has not reviewed it yet, as the lead author asked on Nov. 22, 2026
 *   (decision record 0029), but only when it cites a published source. A
 *   telling that came from a person (a contributor filing) stays held until
 *   it is `public`, because the contributor agreed only to what the filing
 *   says.
 * - An excerpt is shown only when its telling is shown and the record carries
 *   its exact words. An excerpt held privately (Tribal law, a court opinion,
 *   or a publisher that asks to be asked first) is shown as its pinpoint
 *   only, with the telling's link.
 * - The whole story is shown (decision record 0034) only when its telling is
 *   shown and the record says why no permission is needed or that permission
 *   was given: a public-domain telling, a nation's own law the site serves
 *   (decision record 0031), or a telling permitted to be published in full.
 */

export type AccessLevelName = 'public' | 'nation-review-first' | 'embargoed' | 'restricted';

export interface AccessLevel {
	level: AccessLevelName;
	until?: string;
}

export interface Credit {
	form: 'name' | 'name-and-nation' | 'role' | 'pseudonym' | 'none';
	name?: string;
	nation?: string;
	role?: string;
	pseudonym?: string;
}

export interface StoryTelling {
	id: string;
	source?: string;
	filing?: string;
	locator?: string;
	as_of?: string | number;
	teller?: Credit;
	published_by?: string;
	authority: string;
	language?: string;
	verification?: string;
	permitted_uses: { level: string; scope?: string[] };
	access: AccessLevel;
	note?: string;
}

export interface StoryExcerpt {
	telling: string;
	locator: string;
	text?: string;
	held_privately?: boolean;
	words: number;
	sha256: string;
}

/** A passage left out of a story's full text, marked where it was. */
export interface StoryOmission {
	omitted: string;
	locator: string;
}

export interface StoryFullText {
	telling: string;
	locator: string;
	basis: 'public-domain' | 'nation-law' | 'permission' | 'lead-author-decision';
	basis_note: string;
	transcribed_from: string;
	paragraphs: (string | StoryOmission)[];
	notes?: string[];
	words: number;
	sha256: string;
}

export interface StoryProtocol {
	kind: string;
	statement: string;
	source: string;
	locator?: string;
	how_the_project_follows_it?: string;
}

export interface StoryRecord {
	id: string;
	title: string;
	titles_in_language?: { text: string; language: string; source?: string }[];
	nations: string[];
	community?: string;
	kind: string;
	length?: string;
	excerpts?: StoryExcerpt[];
	full_text?: StoryFullText;
	methods?: string[];
	topics?: string[];
	tellings: StoryTelling[];
	protocols?: StoryProtocol[];
	access: AccessLevel;
	sensitivity?: { restricted?: boolean; tribal_review_required?: boolean };
	review_status?: string;
	found_in: string[];
	notes?: string;
}

/** The longest excerpt quoted without the teller's permission (decision record 0019). */
export const maximumExcerptWords = 50;

/** Today's date as YYYY-MM-DD, the form an embargo's `until` uses. */
export function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

/** Whether material at this access level may be on the website on this date. */
export function accessAllowsDisplay(access: AccessLevel | undefined, today: string): boolean {
	switch (access?.level ?? 'public') {
		case 'public':
		case 'nation-review-first':
			return true;
		case 'embargoed':
			return Boolean(access?.until) && (access?.until as string) <= today;
		default:
			return false;
	}
}

/** Whether one telling may be shown. */
export function tellingIsShown(telling: StoryTelling, today: string): boolean {
	if (!accessAllowsDisplay(telling.access, today)) return false;
	if (telling.filing) return (telling.access?.level ?? 'public') === 'public';
	return Boolean(telling.source);
}

/** The tellings of a story that may be shown, in the record's order (the nation's own first). */
export function shownTellings(record: StoryRecord, today: string): StoryTelling[] {
	return record.tellings.filter((telling) => tellingIsShown(telling, today));
}

/** Whether a story may be on the website at all: allowed by its access and with at least one telling shown. */
export function storyIsShown(record: StoryRecord, today: string): boolean {
	if (record.sensitivity?.restricted) return false;
	if (record.review_status === 'withdrawn-at-request') return false;
	if (!accessAllowsDisplay(record.access, today)) return false;
	return shownTellings(record, today).length > 0;
}

/**
 * The stories a nation's page lists: those the website shows that name the
 * nation among their nations, in the order given. A restricted, withdrawn or
 * not-yet-released story is left out here as it is everywhere else.
 */
export function storiesOfNation<T extends StoryRecord>(records: T[], nationId: string, today: string): T[] {
	return records.filter((record) => record.nations.includes(nationId) && storyIsShown(record, today));
}

/** The excerpts that may be shown, quoted or as a pinpoint only. */
export function shownExcerpts(
	record: StoryRecord,
	today: string
): (StoryExcerpt & { quoted: boolean })[] {
	const tellings = new Map(shownTellings(record, today).map((telling) => [telling.id, telling]));
	return (record.excerpts ?? [])
		.filter((excerpt) => tellings.has(excerpt.telling))
		.map((excerpt) => {
			const level = tellings.get(excerpt.telling)?.permitted_uses.level;
			const mayQuote =
				level === 'publish-in-full' || (level === 'quote' && excerpt.words <= maximumExcerptWords);
			return { ...excerpt, quoted: Boolean(excerpt.text) && !excerpt.held_privately && mayQuote };
		});
}

/**
 * The story's full text, when it may be shown: its telling is shown, and a
 * full text resting on permission has a telling permitted to be published in
 * full. The other grounds (public domain, a nation's law) are checked against
 * the source records when the records are validated (scripts/validate_records.py).
 */
export function shownFullText(record: StoryRecord, today: string): StoryFullText | undefined {
	const fullText = record.full_text;
	if (!fullText) return undefined;
	const telling = shownTellings(record, today).find((candidate) => candidate.id === fullText.telling);
	if (!telling) return undefined;
	if (fullText.basis === 'permission' && telling.permitted_uses.level !== 'publish-in-full') return undefined;
	return fullText;
}

/** Every source key the shown stories cite, so the build can format their citations. Used by vite.config.ts. */
export function storySourceKeys(records: StoryRecord[]): string[] {
	const keys = new Set<string>();
	for (const record of records) {
		for (const telling of record.tellings) if (telling.source) keys.add(telling.source);
		for (const protocol of record.protocols ?? []) keys.add(protocol.source);
		for (const title of record.titles_in_language ?? []) if (title.source) keys.add(title.source);
	}
	return [...keys];
}
