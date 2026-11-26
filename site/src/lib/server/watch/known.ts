/**
 * Dedupe against the records we hold (docs/source-watch.md, "Dedupe against
 * the records we have"). The watch Worker cannot read content/ while it
 * runs, so its build makes an index of known identifiers from the records
 * (./known-build.ts, written by site/watch/make-known-identifiers.ts) and
 * bundles it. Workers Builds rebuilds the Worker when the records change. The
 * index is never served.
 *
 * A candidate whose identifier or file hash is already known is closed as
 * "already have it" without a person seeing it. One whose link is known but
 * whose file is new is proposed as a new version of that record. One that
 * matches only on its normalized title is shown as "possibly the same as".
 */
import type { MatchKind } from './watcher.ts';

export interface KnownSource {
	/** The source record's key. */
	key: string;
	kind: string;
	title: string;
	/** The original link, normalized (linkForMatching). */
	link?: string;
	/** The stored file's SHA-256 (file.checksum), cut by shortHash. */
	checksum?: string;
	/** A Federal Register document number, such as "2022-01789", from citation.number. */
	federalRegisterNumber?: string;
	/** U.S. Reports or another reporter, as "volume reporter page". */
	reporter?: string;
	nations?: string[];
}

export interface KnownHistory {
	identifier: string;
	title: string;
	kind: string;
	nations: string[];
	/** Every version's capture SHA-256, cut by shortHash. */
	sha256s: string[];
}

export interface KnownNation {
	identifier: string;
	/** Official name first, then other names it is known by. */
	names: string[];
}

export interface KnownIdentifiers {
	/** Changes whenever the build's records change. */
	buildHash: string;
	madeAt: string;
	sources: KnownSource[];
	histories: KnownHistory[];
	nations: KnownNation[];
	/** SHA-256 of every file in the capture index, cut by shortHash. */
	capturedSha256s: string[];
}

export const emptyKnownIdentifiers: KnownIdentifiers = { buildHash: '', madeAt: '', sources: [], histories: [], nations: [], capturedSha256s: [] };

/** File hashes in the index are cut to 20 hexadecimal characters (80 bits) to keep it small (./known-build.ts). */
export function shortHash(sha256: string): string {
	return sha256.toLowerCase().slice(0, 20);
}

/** A link reduced so the same address written two ways compares alike: https, no fragment, no "www.", no trailing slash. */
export function normalizeLink(link: string): string | undefined {
	if (!URL.canParse(link)) return undefined;
	const address = new URL(link);
	if (address.protocol !== 'https:' && address.protocol !== 'http:') return undefined;
	address.protocol = 'https:';
	address.hash = '';
	address.hostname = address.hostname.toLowerCase().replace(/^www\./, '');
	return address.href.replace(/\/$/, '');
}

/** "FR Doc. 2022-01789", "2022-01789" and "E8-12345" read alike. */
export function normalizeFederalRegisterNumber(text: string): string | undefined {
	const match = /([A-Z]?\d{1,4}-\d{3,6})/i.exec(text);
	return match ? match[1].toUpperCase() : undefined;
}

/** A title reduced for loose comparison: lower case, letters and numbers only. */
export function normalizeTitle(title: string): string {
	return title
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** The index with lookups built once. */
export interface KnownLookup {
	index: KnownIdentifiers;
	byLink: Map<string, KnownSource>;
	byFederalRegisterNumber: Map<string, KnownSource>;
	byChecksum: Map<string, string>;
	byTitle: Map<string, KnownSource>;
	/** Each record's title by the name a match gives it (a source key or "document:<history>"). */
	titles: Map<string, string>;
	nationNames: { identifier: string; name: string; pattern: RegExp }[];
}

function escapeForPattern(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function lookupFor(index: KnownIdentifiers): KnownLookup {
	const byLink = new Map<string, KnownSource>();
	const byFederalRegisterNumber = new Map<string, KnownSource>();
	const byChecksum = new Map<string, string>();
	const byTitle = new Map<string, KnownSource>();
	const titles = new Map<string, string>();
	for (const history of index.histories) titles.set(`document:${history.identifier}`, history.title);
	for (const source of index.sources) {
		titles.set(source.key, source.title);
		const link = source.link ? normalizeLink(source.link) : undefined;
		if (link && !byLink.has(link)) byLink.set(link, source);
		if (source.federalRegisterNumber) byFederalRegisterNumber.set(source.federalRegisterNumber, source);
		if (source.checksum) byChecksum.set(source.checksum, source.key);
		const title = normalizeTitle(source.title);
		if (title.length > 12 && !byTitle.has(title)) byTitle.set(title, source);
	}
	for (const history of index.histories) for (const sha256 of history.sha256s) if (!byChecksum.has(sha256)) byChecksum.set(sha256, `document:${history.identifier}`);
	for (const sha256 of index.capturedSha256s) if (!byChecksum.has(sha256)) byChecksum.set(sha256, 'capture-index');
	// Longer names first, so "Picayune Rancheria of the Chukchansi Indians" wins over a shorter name inside it.
	const nationNames = index.nations
		.flatMap((nation) => nation.names.filter((name) => name.length >= 6).map((name) => ({ identifier: nation.identifier, name })))
		.sort((first, second) => second.name.length - first.name.length)
		.map((entry) => ({ ...entry, pattern: new RegExp(`(^|[^A-Za-z])${escapeForPattern(entry.name).replace(/\s+/g, '\\s+')}([^A-Za-z]|$)`, 'i') }));
	return { index, byLink, byFederalRegisterNumber, byChecksum, byTitle, titles, nationNames };
}

export interface MatchInput {
	title: string;
	link?: string | null;
	federalRegisterNumber?: string | null;
	sha256?: string | null;
}

export interface Match {
	kind: MatchKind;
	/** A source key, "document:<history>", or "capture-index". */
	record: string | null;
	reason: string;
}

/** What the dedupe step finds for an item. */
export function matchKnown(lookup: KnownLookup, input: MatchInput): Match {
	if (input.federalRegisterNumber) {
		const number = normalizeFederalRegisterNumber(input.federalRegisterNumber);
		const found = number ? lookup.byFederalRegisterNumber.get(number) : undefined;
		if (found) return { kind: 'same', record: found.key, reason: `Federal Register document ${number} is already the record ${found.key}.` };
	}
	if (input.sha256) {
		const found = lookup.byChecksum.get(shortHash(input.sha256));
		if (found) return { kind: 'same', record: found, reason: `The same file (SHA-256 ${input.sha256.slice(0, 12)}…) is already held.` };
	}
	const link = input.link ? normalizeLink(input.link) : undefined;
	if (link) {
		const found = lookup.byLink.get(link);
		if (found) {
			if (input.sha256 && found.checksum && found.checksum !== shortHash(input.sha256)) return { kind: 'new-version', record: found.key, reason: `Same link as the record ${found.key}, but the file is new.` };
			if (!input.sha256 || !found.checksum) return { kind: 'same', record: found.key, reason: `The link is already the record ${found.key}.` };
		}
	}
	const title = normalizeTitle(input.title);
	const byTitle = lookup.byTitle.get(title);
	if (byTitle) return { kind: 'possible-duplicate', record: byTitle.key, reason: `Same title as the record ${byTitle.key}.` };
	return { kind: 'none', record: null, reason: 'No record matches its identifier, file or title.' };
}

/** The nations whose names appear in a text, by profile identifier. A name inside a longer matched name is not counted twice. */
export function nationsNamedIn(lookup: KnownLookup, text: string): string[] {
	const found: string[] = [];
	let remaining = text;
	for (const entry of lookup.nationNames) {
		if (!entry.pattern.test(remaining)) continue;
		if (!found.includes(entry.identifier)) found.push(entry.identifier);
		remaining = remaining.replace(entry.pattern, '$1 $2');
	}
	return found;
}
