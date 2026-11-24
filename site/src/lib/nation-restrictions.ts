/**
 * How a nation that has claimed its page chooses what the site shows of its
 * own laws and its own courts' opinions (Trevor, Nov. 24, 2026, design in
 * design/nation-restrictions/, decision record 0056). Each kind has a level,
 * each item may differ from its kind, and items added later follow their kind.
 *
 * - Show: listed, with the text on this site.
 * - Cite only: listed by citation, linked to where the original is kept. No
 *   copy on this site, and no text in search, downloads, print or data sets.
 * - Hide: not listed anywhere on the site.
 *
 * Federal and state law and cases are public law and always shown (Trevor's
 * choice on the decision card); a nation can add its statement beside them.
 * Agreements, such as gaming compacts, are published by the United States,
 * so they can be cited only but not hidden.
 *
 * These rules are pure, so the server, the Worker's page overlay, the pages
 * and the tests share them.
 */

export const restrictionKinds = ['laws', 'opinions', 'agreements'] as const;
export type RestrictionKind = (typeof restrictionKinds)[number];

export const restrictionLevels = ['show', 'cite', 'hide'] as const;
export type RestrictionLevel = (typeof restrictionLevels)[number];

export const restrictionLevelLabels: Record<RestrictionLevel, string> = {
	show: 'Show',
	cite: 'Cite only',
	hide: 'Hide'
};

export const restrictionKindLabels: Record<RestrictionKind, string> = {
	laws: 'Laws',
	opinions: 'Court opinions',
	agreements: 'Agreements'
};

/** The line under each kind's name on the team's page. */
export const restrictionKindDescriptions: Record<RestrictionKind, string> = {
	laws: 'Constitutions, codes, ordinances and resolutions',
	opinions: 'Opinions of the nation’s own courts',
	agreements: 'Compacts with states and the United States'
};

/** One item, as the team's page names it in the item list. */
export const restrictionItemKindLabels: Record<RestrictionKind, string> = {
	laws: 'Law',
	opinions: 'Court opinion',
	agreements: 'Agreement'
};

/** The levels each kind can take. Agreements are published by the United States, so they stay listed. */
export const allowedLevels: Record<RestrictionKind, readonly RestrictionLevel[]> = {
	laws: ['show', 'cite', 'hide'],
	opinions: ['show', 'cite', 'hide'],
	agreements: ['show', 'cite']
};

/** What a nation has chosen: a level for each kind it changed, and for each item set apart from its kind. */
export interface RestrictionSettings {
	kinds: Partial<Record<RestrictionKind, RestrictionLevel>>;
	items: Record<string, RestrictionLevel>;
}

export const noRestrictions: RestrictionSettings = { kinds: {}, items: {} };

/** A thing the site shows that a nation can restrict. */
export interface RestrictableItem {
	/** "copy:<bucket key>" for anything this site keeps a copy of, else "version:<document>/<version>". */
	id: string;
	kind: RestrictionKind;
	/** How the team's page and the project's queue name it, such as "1975 proposed constitution". */
	title: string;
	/** For a case, its citation, court and year, which the item list shows after the name in italics. */
	citation?: string;
	/** Where the original is kept, which a cited-only item links to. */
	original?: string;
	/** The size of this site's copy, for the count on the nation's page. */
	bytes?: number;
	/** Whether the nation's downloads and offline copies hold this site's copy. */
	offline?: boolean;
}

/** What the team's page and the overlay read for a nation: its items, built with the site. */
export interface RestrictableList {
	nation: string;
	items: RestrictableItem[];
	/** The federal and state law and cases on the nation's page, which are always shown, counted for the team's page. */
	alwaysShown?: { treaties: number; cases: number };
}

/** "19 treaties, 6 cases", leaving out a part with none. */
export function alwaysShownCount(counts: RestrictableList['alwaysShown']): string {
	if (!counts) return '';
	return [
		counts.treaties > 0 ? plural(counts.treaties, 'treaty', 'treaties') : '',
		counts.cases > 0 ? plural(counts.cases, 'case', 'cases') : ''
	]
		.filter(Boolean)
		.join(', ');
}

export function isLevel(value: unknown): value is RestrictionLevel {
	return typeof value === 'string' && (restrictionLevels as readonly string[]).includes(value);
}

export function isKind(value: unknown): value is RestrictionKind {
	return typeof value === 'string' && (restrictionKinds as readonly string[]).includes(value);
}

/** The level a kind may take: a level the kind does not offer falls back to the strictest it does. */
export function clampLevel(kind: RestrictionKind, level: RestrictionLevel): RestrictionLevel {
	const allowed = allowedLevels[kind];
	return allowed.includes(level) ? level : allowed[allowed.length - 1];
}

export function kindLevel(settings: RestrictionSettings, kind: RestrictionKind): RestrictionLevel {
	return clampLevel(kind, settings.kinds[kind] ?? 'show');
}

/** The level an item is shown at: its own, else its kind's. */
export function itemLevel(settings: RestrictionSettings, item: Pick<RestrictableItem, 'id' | 'kind'>): RestrictionLevel {
	const own = settings.items[item.id];
	return own ? clampLevel(item.kind, own) : kindLevel(settings, item.kind);
}

/** Whether a nation restricts anything at all, so pages of nations that restrict nothing pass through untouched. */
export function restrictsAnything(settings: RestrictionSettings): boolean {
	return Object.values(settings.kinds).some((level) => level !== 'show') || Object.values(settings.items).some((level) => level !== 'show');
}

/** Reads stored or sent settings, keeping only known kinds and levels. */
export function readSettings(raw: unknown): RestrictionSettings {
	const value = (raw ?? {}) as { kinds?: Record<string, unknown>; items?: Record<string, unknown> };
	const kinds: RestrictionSettings['kinds'] = {};
	for (const kind of restrictionKinds) {
		const level = value.kinds?.[kind];
		if (isLevel(level)) kinds[kind] = clampLevel(kind, level);
	}
	const items: RestrictionSettings['items'] = {};
	for (const [id, level] of Object.entries(value.items ?? {})) {
		if (/^(copy|version):[^\s]{1,400}$/.test(id) && isLevel(level)) items[id] = level;
	}
	return { kinds, items };
}

/**
 * Settings without needless entries: an item at its kind's level is not set
 * apart, so a later change to the kind carries it along.
 */
export function tidySettings(settings: RestrictionSettings, items: readonly RestrictableItem[]): RestrictionSettings {
	const known = new Map(items.map((item) => [item.id, item]));
	const kinds: RestrictionSettings['kinds'] = {};
	for (const kind of restrictionKinds) {
		const level = kindLevel(settings, kind);
		if (level !== 'show') kinds[kind] = level;
	}
	const tidy: RestrictionSettings = { kinds, items: {} };
	for (const [id, level] of Object.entries(settings.items)) {
		const item = known.get(id);
		if (!item) continue;
		const clamped = clampLevel(item.kind, level);
		if (clamped !== kindLevel(tidy, item.kind)) tidy.items[id] = clamped;
	}
	return tidy;
}

/** One line of what a change did, for the project's queue, the team's activity and the log. */
export interface RestrictionChange {
	/** "kind:<kind>" or an item's id. */
	target: string;
	label: string;
	from: RestrictionLevel;
	to: RestrictionLevel;
	/** For a kind, how many of its items now take its level (those not set apart). */
	count?: number;
	/** Whether the label is a case name, which is shown in italics. */
	caseName?: boolean;
}

/** What differs between two settings: kinds first, then the items set apart before or after, in the list's order. */
export function settingsChanges(
	before: RestrictionSettings,
	after: RestrictionSettings,
	items: readonly RestrictableItem[]
): RestrictionChange[] {
	const changes: RestrictionChange[] = [];
	for (const kind of restrictionKinds) {
		const from = kindLevel(before, kind);
		const to = kindLevel(after, kind);
		if (from === to) continue;
		const count = items.filter((item) => item.kind === kind && !(item.id in after.items) && itemLevel(before, item) !== to).length;
		changes.push({ target: `kind:${kind}`, label: restrictionKindLabels[kind], from, to, count });
	}
	for (const item of items) {
		const wasApart = item.id in before.items;
		const isApart = item.id in after.items;
		if (!wasApart && !isApart) continue;
		const from = itemLevel(before, item);
		const to = itemLevel(after, item);
		// Set apart now, at a level of its own: say so even when the level stays, since its kind moved.
		const newlyApart = isApart && (!wasApart || before.items[item.id] !== after.items[item.id]);
		if (from === to && !newlyApart) continue;
		if (from === to && kindLevel(before, item.kind) === kindLevel(after, item.kind)) continue;
		changes.push({ target: item.id, label: item.title, from, to, caseName: item.kind === 'opinions' });
	}
	return changes;
}

function plural(count: number, one: string, many: string): string {
	return count === 1 ? `1 ${one}` : `${count.toLocaleString('en-US')} ${many}`;
}

/** A change as one sentence of plain text, for the activity log. */
export function describeRestrictionChange(change: RestrictionChange): string {
	if (change.target.startsWith('kind:')) {
		return `${change.label} set to ${restrictionLevelLabels[change.to]} (was ${restrictionLevelLabels[change.from]})`;
	}
	if (change.from === change.to) return `${change.label} kept at ${restrictionLevelLabels[change.to]}`;
	return `${change.label} set to ${restrictionLevelLabels[change.to]}`;
}

export function describeRestrictionChanges(changes: readonly RestrictionChange[]): string {
	return changes.length === 0 ? 'No change' : `${changes.map(describeRestrictionChange).join('. ')}.`;
}

/** The kinds' counts the team's page shows: "10 documents", "121 opinions". */
export function kindCount(kind: RestrictionKind, count: number): string {
	return kind === 'opinions' ? plural(count, 'opinion', 'opinions') : plural(count, 'document', 'documents');
}

/**
 * One line of what saving will do, as the team's page lists them. An item's
 * name is kept apart from the words around it so the page can set case
 * names in italics.
 */
export interface SavingLine {
	before: string;
	name?: string;
	caseName?: boolean;
	after: string;
}

const kindNouns: Record<RestrictionKind, [string, string]> = {
	laws: ['law', 'laws'],
	opinions: ['court opinion', 'court opinions'],
	agreements: ['agreement', 'agreements']
};

export function savingLines(changes: readonly RestrictionChange[], items: readonly RestrictableItem[]): SavingLine[] {
	const byId = new Map(items.map((item) => [item.id, item]));
	return changes.flatMap((change): SavingLine[] => {
		if (change.target.startsWith('kind:')) {
			const kind = change.target.slice(5) as RestrictionKind;
			const count = change.count ?? 0;
			if (count === 0) return [];
			const noun = plural(count, ...kindNouns[kind]);
			const where = kind === 'opinions' ? 'the Caselaw Access Project' : 'where the original is kept';
			if (change.to === 'cite') return [{ before: `list ${noun} by citation, each linked to ${where}`, after: '' }];
			if (change.to === 'hide') return [{ before: `stop listing ${noun}`, after: '' }];
			return [{ before: `show ${noun} in full`, after: '' }];
		}
		const item = byId.get(change.target);
		const caseName = item?.kind === 'opinions';
		const name = caseName ? change.label : `the ${change.label}`;
		if (change.to === 'show') return [{ before: change.from === 'show' ? 'keep ' : 'show ', name, caseName, after: ' in full' }];
		if (change.to === 'cite') return [{ before: 'list ', name, caseName, after: ' by citation only' }];
		return [{ before: 'stop listing ', name, caseName, after: '' }];
	});
}

/** The line a section shows when some of its items are hidden. It never counts or names them. */
export const withheldLine = 'Some items are not listed at the nation’s request.';

/** What the address of a hidden copy answers, without naming it. */
export const hiddenCopyMessage = 'At the nation’s request, this site does not show this document.';

/**
 * The note under a nation's court opinions when any are cited only, in place
 * of the note on the Caselaw Access Project's copies.
 */
export function opinionsNote(kind: RestrictionLevel, cited: number, inFull: number): string {
	if (kind === 'show') {
		return `At the nation’s request, ${cited === 1 ? 'one of its courts’ opinions is' : `${cited.toLocaleString('en-US')} of its courts’ opinions are`} listed by citation only, each linked to the Caselaw Access Project. The others are copies of the Caselaw Access Project’s text, with the publisher’s headnotes removed.`;
	}
	const kept = inFull === 0 ? '' : inFull === 1 ? ' One is shown on this site in full.' : ` ${inFull.toLocaleString('en-US')} are shown on this site in full.`;
	return `At the nation’s request, its courts’ opinions are listed by citation only, each linked to the Caselaw Access Project.${kept}`;
}

/** Which of a nation's choices a copy this site keeps follows: its kind, and the nations it belongs to. */
export interface CopyRestriction {
	kind: RestrictionKind;
	nations: string[];
}

/**
 * The choices a copy follows, as the offline sets and copy lists work out
 * its nations (src/lib/server/copy-lists.ts), or undefined for a copy no
 * nation can restrict, such as a federal document.
 */
export function copyRestriction(copy: { key: string; topic: string; nations: string[] }): CopyRestriction | undefined {
	const kind: RestrictionKind | undefined =
		copy.topic === 'caselaw-access-project' ? 'opinions' : copy.topic === 'constitutions' || copy.topic === 'tribal-law' ? 'laws' : undefined;
	if (!kind) return undefined;
	const nations = copy.nations.length > 0 ? copy.nations : copy.topic === 'constitutions' ? [copy.key.split('/')[1]] : [];
	return nations.length > 0 ? { kind, nations } : undefined;
}

/** The attribute on an item's whole entry on a page, holding its id, so the Worker can take a hidden item off before the page runs. */
export const restrictItemAttribute = 'data-restrict-item';

/** The id of an item this site keeps a copy of, from the copy's address: "/copies/view/a/b%20c.pdf" -> "copy:a/b c.pdf". */
export function copyItemId(path: string): string {
	return `copy:${path
		.replace(/^\/copies\/(view\/)?/, '')
		.split('/')
		.map((part) => decodeURIComponent(part))
		.join('/')}`;
}

/** The id of a document's version: its copy's, when this site keeps one, or else the document's and version's. */
export function versionItemId(link: string | undefined, documentId: string, versionId: string): string {
	return link?.startsWith('/copies/') ? copyItemId(link) : `version:${documentId}/${versionId}`;
}

/**
 * What a nation's page needs to follow the choices about its laws and
 * opinions, sent with the page's other live changes (/nations/<id>/changes.json):
 * the level of each item that is not shown in full, where cited items' originals
 * are kept, and the counts the page shows. Items shown in full are left out.
 */
export interface PageRestrictions {
	levels: Record<string, Exclude<RestrictionLevel, 'show'>>;
	originals: Record<string, string>;
	opinions: { kind: RestrictionLevel; total: number; cited: number; hidden: number };
	/** Whether any of the nation's laws or agreements are hidden, so the section says so once. */
	lawsWithheld: boolean;
	/** The copies the nation's downloads leave out, so their count and size drop. */
	withheldCopies: { count: number; bytes: number };
}

export const noPageRestrictions: PageRestrictions = {
	levels: {},
	originals: {},
	opinions: { kind: 'show', total: 0, cited: 0, hidden: 0 },
	lawsWithheld: false,
	withheldCopies: { count: 0, bytes: 0 }
};

/**
 * Works out what a page follows from each item's level, already the
 * strictest of the nations it belongs to (src/lib/server/nation-restrictions.ts,
 * copyLevels), and the nation's own setting for its opinions.
 */
export function pageRestrictions(
	items: readonly RestrictableItem[],
	levelOf: (item: RestrictableItem) => RestrictionLevel,
	opinionsKind: RestrictionLevel
): PageRestrictions {
	const result: PageRestrictions = {
		levels: {},
		originals: {},
		opinions: { kind: opinionsKind, total: 0, cited: 0, hidden: 0 },
		lawsWithheld: false,
		withheldCopies: { count: 0, bytes: 0 }
	};
	for (const item of items) {
		const level = levelOf(item);
		if (item.kind === 'opinions') {
			result.opinions.total += 1;
			if (level === 'cite') result.opinions.cited += 1;
			if (level === 'hide') result.opinions.hidden += 1;
		}
		if (level === 'show') continue;
		result.levels[item.id] = level;
		if (level === 'cite' && item.original) result.originals[item.id] = item.original;
		if (level === 'hide' && item.kind !== 'opinions') result.lawsWithheld = true;
		if (item.offline) {
			result.withheldCopies.count += 1;
			result.withheldCopies.bytes += item.bytes ?? 0;
		}
	}
	return result;
}

/** Whether a page has anything to follow. */
export function pageRestricts(restrictions: PageRestrictions): boolean {
	return Object.keys(restrictions.levels).length > 0;
}

/** Reads what the Worker or the page put in the page (src/lib/server/nation-page-overlay.ts), or nothing restricted. */
export function readPageRestrictions(text: string | null | undefined): PageRestrictions {
	if (!text) return noPageRestrictions;
	try {
		const value = JSON.parse(text) as Partial<PageRestrictions>;
		if (!value || typeof value.levels !== 'object' || value.levels === null) return noPageRestrictions;
		return { ...noPageRestrictions, ...value } as PageRestrictions;
	} catch {
		return noPageRestrictions;
	}
}

/**
 * Why a person may not change what the site shows of a nation's laws and
 * cases, or undefined when they may: the lead author, or an editor or
 * steward whose place covers the whole page. Everyone on the team can see
 * the settings.
 */
export function restrictionProblem(granter: { isAdministrator: boolean; level?: string; parts?: readonly string[] | null }): string | undefined {
	if (granter.isAdministrator) return undefined;
	if (granter.level !== 'editor' && granter.level !== 'steward') return 'Only an editor or steward for this nation can change these.';
	if (granter.parts) return 'Only an editor or steward for the whole page can change these.';
	return undefined;
}
