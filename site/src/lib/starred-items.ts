/**
 * Starred pages and private notes (site/DESIGN.md, section 6, "Star"): a
 * reader stars a nation page, a glossary entry, a story and, once they are
 * published, sections of the model code, essays, forms and sources, and can
 * keep a short note on each. Trevor approved this on Nov. 21 and 22, 2026,
 * as step 1 of the reader plan (decision record 0032): everything is kept in
 * the browser's local storage on the reader's own device, nothing is sent to
 * the site, and no account is needed. Step 2, syncing through the reader's
 * sign-in, waits until the model code has final section numbers.
 *
 * This module must work in the browser and in Node (for tests).
 */

export const starredStorageKey = 'starred-items';

/** The most a device keeps, so local storage cannot fill up. */
export const starredLimit = 500;
export const noteLengthLimit = 2000;
export const titleLengthLimit = 200;

/** Fired on window when this page changes the starred items. */
export const starredChangeEvent = 'starred-items-change';

export type StarredKind = 'nation' | 'term' | 'story' | 'section' | 'essay' | 'form' | 'source';

export interface StarredItem {
	/** The page's address on this site, such as /nations/navajo-nation. */
	address: string;
	/** The page's title when it was starred. */
	title: string;
	/** When it was starred, as an ISO 8601 date and time. */
	starredAt: string;
	/** The reader's own note, plain text. Empty when there is none. */
	note: string;
}

/**
 * The pages a reader can star, by address. Only pages with a lasting
 * address count, so a star does not point at a page that later moves
 * (repository identifiers never change once published). The model code,
 * essays, forms and sources join when their pages are built.
 */
const starrablePages: { kind: StarredKind; pattern: RegExp }[] = [
	{ kind: 'nation', pattern: /^\/nations\/(?!map$|letter$|state$)[a-z0-9][a-z0-9-]*$/ },
	{ kind: 'term', pattern: /^\/glossary\/[a-z0-9][a-z0-9-]*$/ },
	{ kind: 'story', pattern: /^\/stories\/[a-z0-9][a-z0-9-]*$/ },
	{ kind: 'section', pattern: /^\/code\/[0-9][0-9a-z.-]*$/ },
	{ kind: 'essay', pattern: /^\/essays\/[a-z0-9][a-z0-9-]*$/ },
	{ kind: 'form', pattern: /^\/forms\/[a-z0-9][a-z0-9-]*$/ },
	{ kind: 'source', pattern: /^\/sources\/[a-z0-9][a-z0-9_-]*$/ }
];

export const starredKindLabels: Record<StarredKind, string> = {
	nation: 'Nation',
	term: 'Glossary entry',
	story: 'Story',
	section: 'Section of the code',
	essay: 'Essay',
	form: 'Form',
	source: 'Source'
};

/** What kind of page an address is, or undefined when it cannot be starred. */
export function starredKindOf(address: unknown): StarredKind | undefined {
	if (typeof address !== 'string' || address.length > 200) return undefined;
	return starrablePages.find((page) => page.pattern.test(address))?.kind;
}

/** Plain text on one line: no control characters, spaces collapsed, capped. */
export function cleanLine(text: string, limit: number): string {
	return text
		.replace(/[\p{Cc}\p{Cf}\u2028\u2029]+/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, limit)
		.trim();
}

/** Plain text that may keep its line breaks: no other control characters, capped. */
export function cleanText(text: string, limit: number): string {
	return text
		.replace(/\r\n?/g, '\n')
		.replace(/[\p{Cf}\u2028\u2029]|(?![\n\t])\p{Cc}/gu, '')
		.slice(0, limit);
}

function cleanItem(value: unknown): StarredItem | undefined {
	if (typeof value !== 'object' || value === null) return undefined;
	const record = value as Record<string, unknown>;
	if (!starredKindOf(record.address)) return undefined;
	const address = record.address as string;
	const title = typeof record.title === 'string' ? cleanLine(record.title, titleLengthLimit) : '';
	const starredAt =
		typeof record.starredAt === 'string' && !Number.isNaN(Date.parse(record.starredAt)) ? record.starredAt : '';
	const note = typeof record.note === 'string' ? cleanText(record.note, noteLengthLimit) : '';
	return { address, title: title || address, starredAt, note };
}

/** Reads a list of starred items. Anything unreadable or not starrable is dropped; each address is kept once. */
export function readStarredItems(value: unknown): StarredItem[] {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const items: StarredItem[] = [];
	for (const entry of value) {
		const item = cleanItem(entry);
		if (!item || seen.has(item.address)) continue;
		seen.add(item.address);
		items.push(item);
		if (items.length === starredLimit) break;
	}
	return items;
}

export function parseStarredItems(stored: string | null): StarredItem[] {
	if (!stored) return [];
	try {
		return readStarredItems(JSON.parse(stored));
	} catch {
		return [];
	}
}

export function serializeStarredItems(items: StarredItem[]): string | null {
	return items.length > 0 ? JSON.stringify(items) : null;
}

/** Stars a page, newest first. A page already starred keeps its place and note. */
export function addStarred(items: StarredItem[], address: string, title: string, now = new Date()): StarredItem[] {
	if (!starredKindOf(address) || items.some((item) => item.address === address)) return items;
	const item: StarredItem = {
		address,
		title: cleanLine(title, titleLengthLimit) || address,
		starredAt: now.toISOString(),
		note: ''
	};
	return [item, ...items].slice(0, starredLimit);
}

export function removeStarred(items: StarredItem[], address: string): StarredItem[] {
	return items.filter((item) => item.address !== address);
}

export function setStarredNote(items: StarredItem[], address: string, note: string): StarredItem[] {
	const clean = cleanText(note, noteLengthLimit);
	return items.map((item) => (item.address === address ? { ...item, note: clean } : item));
}

/**
 * Adds items from elsewhere (an imported file or a shared collection) to the
 * reader's own. The reader's own items keep their place and notes; a note
 * comes from the other list only where the reader has none.
 */
export function mergeStarred(own: StarredItem[], other: StarredItem[]): StarredItem[] {
	const byAddress = new Map(own.map((item) => [item.address, item]));
	const merged = own.map((item) => {
		const match = other.find((entry) => entry.address === item.address);
		return match && !item.note && match.note ? { ...item, note: match.note } : item;
	});
	for (const item of other) {
		if (!byAddress.has(item.address)) merged.push(item);
	}
	return merged.slice(0, starredLimit);
}

/** Local storage can be blocked or full; then stars last for this page only. */
function storage(): Storage | undefined {
	try {
		return window.localStorage;
	} catch {
		return undefined;
	}
}

export function loadStarred(): StarredItem[] {
	try {
		return parseStarredItems(storage()?.getItem(starredStorageKey) ?? null);
	} catch {
		return [];
	}
}

/** Saves the items on this device and tells the rest of the page. Returns false when storage refused them. */
export function saveStarred(items: StarredItem[]): boolean {
	let kept = true;
	try {
		const serialized = serializeStarredItems(items);
		const store = storage();
		if (!store) kept = false;
		else if (serialized === null) store.removeItem(starredStorageKey);
		else store.setItem(starredStorageKey, serialized);
	} catch {
		kept = false;
	}
	window.dispatchEvent(new CustomEvent(starredChangeEvent));
	return kept;
}

/** Calls back whenever the starred items change, in this tab or another. Returns a function that stops it. */
export function onStarredChange(callback: () => void): () => void {
	const fromOtherTab = (event: StorageEvent) => {
		if (event.key === starredStorageKey || event.key === null) callback();
	};
	window.addEventListener(starredChangeEvent, callback);
	window.addEventListener('storage', fromOtherTab);
	return () => {
		window.removeEventListener(starredChangeEvent, callback);
		window.removeEventListener('storage', fromOtherTab);
	};
}
