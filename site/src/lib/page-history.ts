/**
 * Recent changes and page histories: what the browser, the Worker and the
 * build share (site/COLLABORATION.md, "Recent changes"; the database side is
 * src/lib/server/page-history.ts).
 *
 * The site lists every change to its pages, newest first, the way a wiki's
 * "Recent changes" does (MediaWiki, "Help:Recent changes",
 * https://www.mediawiki.org/wiki/Help:Recent_changes), and each page's
 * history. Nation pages and stories show who changed them, when and which
 * parts, never their earlier wording (Trevor, Nov. 23, 2026).
 */

export const pageKinds = [
	'code',
	'foundations',
	'essays',
	'back-matter',
	'nation',
	'story',
	'glossary',
	'front-matter',
	'about'
] as const;
export type PageKind = (typeof pageKinds)[number];

export const pageKindLabels: Record<PageKind, string> = {
	code: 'Model code',
	foundations: 'Foundations',
	essays: 'Essay',
	'back-matter': 'Back matter',
	nation: 'Nation',
	story: 'Story',
	glossary: 'Glossary',
	'front-matter': 'Front matter',
	about: 'About the site'
};

/** Plural names for the "Kind of page" filter. */
export const pageKindFilterLabels: Record<PageKind, string> = {
	code: 'Model code',
	foundations: 'Foundations',
	essays: 'Essays',
	'back-matter': 'Back matter',
	nation: 'Nation pages',
	story: 'Stories',
	glossary: 'Glossary',
	'front-matter': 'Front matter',
	about: 'About the site'
};

/** Pages whose earlier wording is never shown: a change names only the parts that changed. */
export function wordingIsShown(kind: string): boolean {
	return kind !== 'nation' && kind !== 'story';
}

export const changeKinds = ['edit', 'new', 'published', 'restored', 'removed'] as const;
export type ChangeKind = (typeof changeKinds)[number];

export const changeKindLabels: Record<ChangeKind, string> = {
	edit: 'Edits',
	new: 'New pages',
	published: 'Published versions',
	// An essay publication of a version restored from an earlier one in the workspace.
	restored: 'Restored versions',
	removed: 'Removed pages'
};

/** The reasons readers see for a hidden change. */
export const hideReasons = {
	'nation-request': 'Hidden at a nation’s request',
	'person-request': 'Hidden at a person’s request',
	private: 'Hidden: private information',
	copyright: 'Hidden: copyright',
	mistake: 'Hidden: posted by mistake'
} as const;
export type HideReason = keyof typeof hideReasons;

export function isHideReason(value: string | null | undefined): value is HideReason {
	return typeof value === 'string' && Object.hasOwn(hideReasons, value);
}

/** What one change looks like to a reader, with anything hidden already taken out. */
export interface ChangeView {
	/** "page-<number>" or "essay-<essay identifier>-<publication number>". */
	id: string;
	address: string;
	kind: PageKind;
	/** Undefined when the page is no longer on the site and its title is not kept. */
	title: string | undefined;
	change: ChangeKind;
	/** Undefined when there is none or it is hidden. */
	summary: string | undefined;
	summaryHidden: boolean;
	/** The person's name, "Site release" for a change that came with a new build, or undefined when hidden. */
	who: string | undefined;
	whoHidden: boolean;
	/** The person, for the "Who" filter; "site" for a site release. */
	whoKey: string;
	/** The change in size, in bytes; undefined when not shown. */
	sizeChange: number | undefined;
	/** The page's size after the change, in bytes; undefined when not shown. */
	size: number | undefined;
	/** For nation pages and stories: the parts of the page that changed. */
	parts: string[] | undefined;
	/** Whether the two versions can be compared here. */
	comparable: boolean;
	textHidden: boolean;
	/** The reason readers see, when anything is hidden. */
	hiddenReason: string | undefined;
	bulk: boolean;
	/** ISO 8601. */
	madeAt: string;
}

export const siteReleaseName = 'Site release';
/** Who made a change a nation's team published on its own page: the name the team gave, else this. */
export const nationTeamName = 'The nation’s team';
/** The "Who" filter's key for every change nations' teams published. */
export const nationTeamsKey = 'nation-teams';

// ---------------------------------------------------------------------------
// Change identifiers

export type ChangeReference =
	| { source: 'page'; identifier: number }
	| { source: 'essay'; essay: string; number: number }
	// A change a nation's team published on its own page (decision record 0041).
	| { source: 'nation'; identifier: string };

export function changeIdentifier(reference: ChangeReference): string {
	if (reference.source === 'page') return `page-${reference.identifier}`;
	if (reference.source === 'nation') return `nation-${reference.identifier}`;
	return `essay-${reference.essay}-${reference.number}`;
}

export function parseChangeIdentifier(value: string | null | undefined): ChangeReference | undefined {
	if (!value || value.length > 200) return undefined;
	const page = /^page-([1-9][0-9]{0,15})$/.exec(value);
	if (page) return { source: 'page', identifier: Number(page[1]) };
	const nation = /^nation-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(value);
	if (nation) return { source: 'nation', identifier: nation[1] };
	const essay = /^essay-([a-z0-9]+(?:-[a-z0-9]+)*)-([1-9][0-9]{0,8})$/.exec(value);
	if (essay) return { source: 'essay', essay: essay[1], number: Number(essay[2]) };
	return undefined;
}

// ---------------------------------------------------------------------------
// Filters, read from and written to the address's query

export const dayChoices = [1, 7, 30, 90, 365, 0] as const;
export const sizeChoices = [0, 100, 500, 2000, 10000] as const;
export const limitChoices = [50, 100, 250, 500] as const;

export interface ChangeFilters {
	/** One page's address, for its history. */
	page: string | undefined;
	/** Words from a page's title, for the "Page" filter: only pages whose title has them. */
	title: string | undefined;
	kinds: PageKind[];
	/** A person's identifier, or "site" for site releases. */
	who: string | undefined;
	/** 0 for any time. */
	days: number;
	/** The least change in size, in bytes; 0 for any. */
	size: number;
	changes: ChangeKind[];
	/** Only changes with something hidden (the "Hidden changes" chip). */
	hidden: boolean;
	/** Only pages the signed-in reader follows. */
	following: boolean;
	showBulk: boolean;
	group: boolean;
	limit: number;
}

export const defaultFilters: ChangeFilters = {
	page: undefined,
	title: undefined,
	kinds: [],
	who: undefined,
	days: 30,
	size: 0,
	changes: [...changeKinds],
	hidden: false,
	following: false,
	showBulk: false,
	group: true,
	limit: 100
};

function choice<Value extends number>(text: string | null, choices: readonly Value[], fallback: Value): Value {
	const number = Number(text);
	return text !== null && choices.includes(number as Value) ? (number as Value) : fallback;
}

/** A page address a reader may filter by: a path on this site, nothing more. */
export function cleanAddress(value: string | null | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	return /^\/[a-z0-9][a-z0-9/-]{0,250}$/.test(trimmed) && !trimmed.includes('//') ? trimmed.replace(/\/$/, '') : undefined;
}

export function readFilters(query: URLSearchParams): ChangeFilters {
	const kinds = query.getAll('kind').filter((kind): kind is PageKind => (pageKinds as readonly string[]).includes(kind));
	const chosenChanges = query.getAll('change').filter((kind): kind is ChangeKind => (changeKinds as readonly string[]).includes(kind));
	const who = query.get('who') ?? '';
	const page = cleanAddress(query.get('page'));
	const title = (query.get('title') ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
	const bulk = query.getAll('bulk');
	return {
		page,
		title: title && !page ? title : undefined,
		kinds,
		who: /^(site|[A-Za-z0-9_-]{1,80})$/.test(who) ? who : undefined,
		// A page's history reaches back to its first change unless the reader chose otherwise.
		days: choice(query.get('days'), dayChoices, page ? 0 : defaultFilters.days),
		size: choice(query.get('size'), sizeChoices, 0),
		changes: chosenChanges.length > 0 ? chosenChanges : [...changeKinds],
		hidden: query.get('hidden') === '1',
		following: query.get('follow') === '1' && !page,
		// The form's "Hide bulk updates" switch sends bulk=0 when on, after a hidden bulk=1; a link sends bulk=1 alone.
		showBulk: (bulk.includes('1') && !bulk.includes('0')) || Boolean(page),
		// The form sends group=0 from a hidden field and group=1 from the box when it is ticked.
		group: !(query.getAll('group').includes('0') && !query.getAll('group').includes('1')) && !page,
		limit: choice(query.get('limit'), limitChoices, page ? 500 : defaultFilters.limit)
	};
}

/** The query for a set of filters, leaving out anything at its default. */
export function filterQuery(filters: ChangeFilters, changes: Partial<ChangeFilters> = {}): string {
	const chosen = { ...filters, ...changes };
	const query = new URLSearchParams();
	if (chosen.page) query.set('page', chosen.page);
	for (const kind of chosen.kinds) query.append('kind', kind);
	if (chosen.who) query.set('who', chosen.who);
	if (chosen.days !== (chosen.page ? 0 : defaultFilters.days)) query.set('days', String(chosen.days));
	if (chosen.size) query.set('size', String(chosen.size));
	if (chosen.changes.length < changeKinds.length) for (const kind of chosen.changes) query.append('change', kind);
	if (chosen.showBulk && !chosen.page) query.set('bulk', '1');
	if (!chosen.group && !chosen.page) query.set('group', '0');
	if (chosen.limit !== (chosen.page ? 500 : defaultFilters.limit)) query.set('limit', String(chosen.limit));
	if (chosen.title && !chosen.page) query.set('title', chosen.title);
	if (chosen.hidden) query.set('hidden', '1');
	if (chosen.following && !chosen.page) query.set('follow', '1');
	const text = query.toString();
	return text ? `?${text}` : '';
}

// ---------------------------------------------------------------------------
// Showing changes

/** A change in size as a wiki shows it: "+1,204", "−88" (with a minus sign) or "0". */
export function sizeChangeText(change: number): string {
	const digits = Math.abs(change).toLocaleString('en-US');
	return change > 0 ? `+${digits}` : change < 0 ? `−${digits}` : '0';
}

/** A change this large is marked, the way a wiki shows large edits in bold. */
export const largeChange = 2000;

export interface DayGroup<Item> {
	/** YYYY-MM-DD in the reader's time zone is not known on the server, so days are in Pacific time, where the project is. */
	day: string;
	items: Item[];
}

/** Changes in order, gathered into days. */
export function byDay<Item extends { madeAt: string }>(items: Item[], dayOf: (iso: string) => string): DayGroup<Item>[] {
	const days: DayGroup<Item>[] = [];
	for (const item of items) {
		const day = dayOf(item.madeAt);
		const last = days.at(-1);
		if (last?.day === day) last.items.push(item);
		else days.push({ day, items: [item] });
	}
	return days;
}

export interface PageGroup<Item> {
	address: string;
	items: Item[];
}

/** One day's changes, with the changes to each page gathered under its newest one, in order of each page's newest change. */
export function byPage<Item extends { address: string }>(items: Item[]): PageGroup<Item>[] {
	const groups = new Map<string, PageGroup<Item>>();
	for (const item of items) {
		const group = groups.get(item.address);
		if (group) group.items.push(item);
		else groups.set(item.address, { address: item.address, items: [item] });
	}
	return [...groups.values()];
}

/** The page a file in the repository is built into, for files named after the page. */
/** The words on a page's history badge: "2 changes", "1 change" or "No changes yet". */
export function historyBadgeLabel(count: number): string {
	if (count === 0) return 'No changes yet';
	return count === 1 ? '1 change' : `${count.toLocaleString('en-US')} changes`;
}

/** "Courts", "Courts and Contacts", "Courts, Contacts, and Gaming". */
function listOf(names: string[]): string {
	if (names.length <= 2) return names.join(' and ');
	return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * What the newest change did, in a sentence, for the history badge's panel:
 * "Dispute resolution was updated in a site release." Never earlier wording.
 */
export function lastChangeSentence(change: Pick<ChangeView, 'change' | 'parts' | 'who' | 'textHidden'>): string {
	const parts = change.textHidden ? [] : (change.parts ?? []);
	const what =
		change.change === 'new'
			? 'The page was added'
			: change.change === 'removed'
				? 'The page was taken off the site'
				: parts.length > 0
					? `${listOf(parts)} ${parts.length === 1 ? 'was' : 'were'} updated`
					: 'The page was updated';
	if (!change.who) return `${what}.`;
	return change.who === siteReleaseName ? `${what} in a site release.` : `${what} by ${change.who}.`;
}

/** Pages under /nations/ that list nations rather than being one nation's page. */
const nationListings = new Set(['data', 'map', 'recourse', 'law', 'timeline', 'federal-offices', 'coverage']);

/**
 * The address whose history "Changes to this page" opens, for a page whose
 * changes the site records (src/lib/server/page-history-build.ts and the
 * essays); undefined for listings, the workspace and other pages it does not.
 */
export function followedPageAddress(path: string): string | undefined {
	const address = cleanAddress(path);
	if (!address) return undefined;
	const nation = /^\/nations\/([a-z0-9-]+)$/.exec(address);
	if (nation) return nationListings.has(nation[1]) ? undefined : address;
	if (/^\/(stories|glossary|essays|foundations|back-matter|licenses)\/[a-z0-9][a-z0-9-]*$/.test(address)) return address;
	return ['/acknowledgments', '/charter', '/licenses', '/about', '/sponsor'].includes(address) ? address : undefined;
}

export function pageAddressOfFile(file: string): string | undefined {
	const nation = /^content\/tribes\/[a-z0-9]\/([a-z0-9-]+)\.yaml$/.exec(file);
	if (nation) return `/nations/${nation[1]}`;
	const story = /^content\/stories\/[a-z0-9]\/([a-z0-9-]+)\.yaml$/.exec(file);
	if (story) return `/stories/${story[1]}`;
	const term = /^content\/glossary\/(?:[a-z0-9]\/)?([a-z0-9-]+)\.yaml$/.exec(file);
	if (term) return `/glossary/${term[1]}`;
	return undefined;
}

// ---------------------------------------------------------------------------
// What the build lists (src/lib/server/page-history-build.ts)

/** A merged change that touched a page. */
export interface HistoryCommit {
	title: string;
	/** ISO 8601. */
	merged: string;
	/** True when it touched many pages at once. */
	bulk: boolean;
}

export interface HistoryPage {
	address: string;
	kind: PageKind;
	title: string;
	/** A hash of what the page shows readers. */
	fingerprint: string;
	/** For pages whose earlier wording may be shown: the text readers see, and its size in bytes. */
	text?: string;
	bytes?: number;
	/** For nation pages and stories: a hash of each part of the page, by the part's name. */
	parts?: Record<string, string>;
	/** The newest merged changes that touched the page, newest first, as places in HistoryBuild.commits. */
	commits: number[];
}

export interface HistoryBuild {
	builtAt: string;
	buildHash: string;
	fingerprintVersion: number;
	/** Merged changes, listed once for all the pages they touched. */
	commits: HistoryCommit[];
	pages: HistoryPage[];
}
