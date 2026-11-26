/**
 * The source watch's plug-in interface (docs/source-watch.md, "Watchers";
 * decision record 0059). A watcher knows one source: how to ask it what is new
 * since last time, and which collections its items can join. Most watchers
 * are a few settings for a shared driver (./drivers/); adding a source means
 * adding one file in site/watch/watchers/ and one line in its index.
 *
 * Everything a watcher returns is a Candidate in one shape, so dedupe, rules,
 * the model step and the review page are shared.
 */

/** How a watcher reaches its source. */
export const driverNames = ['api', 'feed', 'sitemap', 'page', 'email', 'bulk', 'by-hand'] as const;
export type DriverName = (typeof driverNames)[number];

/**
 * What the site may do with what a watcher finds (docs/source-watch.md,
 * "Storage and hosting"): serve our copy (U.S. government works and nations'
 * governing documents), keep a private copy and link, link only (state
 * material), or only with the nation's consent.
 */
export const hostingRules = ['serve', 'private', 'link-only', 'by-consent'] as const;
export type HostingRule = (typeof hostingRules)[number];

/** The data coverage tiers (Trevor, Nov. 24, 2026): federal core, lower federal, states; "nations" for nations' own sites. */
export type Tier = 1 | 2 | 3 | 'nations';

/**
 * What a watcher feeds: a collection's identifier in the collections
 * registry (src/lib/server/collections.ts), or a part of a nation's profile
 * as "nation:<top-level field>" (schemas/tribe.schema.json).
 */
export type Feed = string;

/** Sensitivity flags, set by rules before any model reads anything (docs/source-watch.md, "Privacy"). */
export type SensitivityFlag = 'child-or-family-case' | 'protection-order' | 'nation-restriction' | 'rights-not-settled' | 'tribal-court-opinion';

/** What the dedupe step found against the records we hold (./known.ts). */
export type MatchKind = 'none' | 'same' | 'new-version' | 'possible-duplicate';

/** A file a watcher fetched, before it is stored. */
export interface FetchedFile {
	bytes: ArrayBuffer;
	mediaType: string;
	/** Where it came from. */
	address: string;
	/** The answer's ETag and Last-Modified, kept with the copy. */
	entityTag?: string | null;
	lastModified?: string | null;
}

/** One possible new or changed item, as a watcher returns it. */
export interface FoundItem {
	/** The source's own stable identifier: a Federal Register document number, an address, a section. With the watcher, unique. */
	sourceIdentifier: string;
	/** What it seems to be, such as "notice", "rule", "regulation-section", "changed-file". */
	kind: string;
	title: string;
	/** As the source gives it, YYYY-MM-DD. */
	date?: string;
	/** The source's page for the item. */
	link?: string;
	/** A file to fetch, store and scan: the document itself (a PDF, a page). */
	fileAddress?: string;
	/** Collections it might join; the rules narrow this. */
	feeds?: Feed[];
	/** Facts the rules read, such as the agency, document type or C.F.R. parts. */
	facts?: Record<string, string | string[] | number | boolean | null>;
	/** A short summary or abstract from the source, never written by the watcher. */
	summary?: string;
	/** A copy the check already kept with context.keep, such as a changed page. */
	capture?: { key: string; sha256: string };
	/** For a changed page or file: the earlier copy and a short difference. */
	change?: { previousKey?: string | null; previousSha256?: string | null; difference?: string };
	/** The host's robots.txt or content signals say no model may read its text (docs/source-watch.md, "robots.txt and content signals"). */
	noModelText?: boolean;
}

/** What a watcher's check gets. */
export interface CheckContext {
	/** The watcher's cursor from its last run, as it saved it. */
	cursor: string | null;
	now: Date;
	/** Fetches through the host's desk: obeys robots.txt, spaces requests, identifies the project (./polite-fetch.ts). */
	fetch(address: string, options?: import('./polite-fetch.ts').PoliteFetchOptions): Promise<import('./polite-fetch.ts').PoliteAnswer>;
	/** Records the watcher knows, for watchers that walk them (cited links). */
	known(): Promise<import('./known.ts').KnownIdentifiers>;
	/** Stores a fetched file privately and puts it in line for the scan (./capture.ts). */
	keep(sourceIdentifier: string, file: FetchedFile): Promise<{ key: string; sha256: string }>;
	/** Per-address memory for page and sitemap watching (the watch_pages table). */
	pages: import('./store.ts').PageMemory;
	/** Earlier versions' main text, so a changed page can show a difference (./drivers/page.ts). */
	pageTexts: import('./drivers/page.ts').PageTexts;
	/** For logs and the progress page; never document text. */
	note(message: string): void;
}

/** What a watcher's check answers. */
export interface CheckResult {
	items: FoundItem[];
	/** The cursor to save, so the next run asks only for what is newer. */
	cursor: string | null;
	/** There is more to fetch now; the next run starts at once rather than on the schedule. */
	more?: boolean;
}

/** A watcher's own rules, applied before the shared ones (./rules.ts). */
export interface WatcherRule {
	name: string;
	/** Close the item without review, keep it for review, or flag it. */
	decide(item: FoundItem): { action: 'close' | 'review'; reason: string; feeds?: Feed[]; proposed?: ProposedAction; relevance?: number } | null;
}

export type ProposedAction = 'add' | 'new-version' | 'same-as' | 'note';

export interface WatcherDefinition {
	/** Stable and unique, such as "federal-register". */
	identifier: string;
	title: string;
	tier: Tier;
	/** Collections (registry identifiers) and nation page parts ("nation:<field>") it can add to. */
	feeds: Feed[];
	driver: DriverName;
	/** A five-field cron expression in UTC (minute hour day month weekday). */
	schedule: string;
	/** Every host it fetches from; "*" for a watcher that follows links the records cite to any host. */
	hosts: string[];
	hosting: HostingRule;
	/** The source's documentation and terms. */
	documentation: string[];
	check(context: CheckContext): Promise<CheckResult>;
	/** Its own rules, run before the shared ones. */
	rules?: WatcherRule[];
	/** False for a watcher that is written but should not run yet, with the reason (a key it needs, an answer it waits for). */
	enabled?: true | { off: string };
}

/** Defines a watcher. The guard test (tests/source-watch-guard.test.ts) checks every field. */
export function defineWatcher(definition: WatcherDefinition): WatcherDefinition {
	return definition;
}

/**
 * A collection or nation page part that no watcher feeds, and why. "planned"
 * names the watcher that will (and what it waits for); "never" says why it is
 * not watched at all, such as stories, which come from people.
 */
export interface NotWatched {
	feed: Feed;
	kind: 'planned' | 'never' | 'derived';
	reason: string;
}

function listed(text: string | undefined): Set<string> {
	return new Set((text ?? '').split(',').map((entry) => entry.trim()).filter(Boolean));
}

/** Whether a watcher runs: WATCH_TURN_OFF wins, then WATCH_TURN_ON, then the watcher's own setting. */
export function watcherIsOn(watcher: WatcherDefinition, settings: { WATCH_TURN_ON?: string; WATCH_TURN_OFF?: string }): { on: boolean; off?: string } {
	if (listed(settings.WATCH_TURN_OFF).has(watcher.identifier)) return { on: false, off: 'Turned off with WATCH_TURN_OFF.' };
	if (listed(settings.WATCH_TURN_ON).has(watcher.identifier)) return { on: true };
	if (watcher.enabled && watcher.enabled !== true) return { on: false, off: watcher.enabled.off };
	return { on: true };
}
