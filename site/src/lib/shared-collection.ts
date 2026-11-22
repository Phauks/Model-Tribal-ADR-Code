/**
 * Shared collections (site/DESIGN.md, section 6, "Star"; decision record
 * 0032): a reader can share some of their starred pages as a link that
 * names no one, as Trevor decided on Nov. 21, 2026. The link itself carries
 * the list: a title, an optional description and the pages' addresses,
 * written as base64url JSON after "#c=" in /starred/shared. The part after
 * "#" never reaches the server, so the site stores nothing and never sees
 * what was shared. Notes are never included. The title and description are
 * the only words a reader writes onto the site, so they are plain text,
 * capped, and shown with the label "A reader's collection, shared by
 * link."
 *
 * This module must work in the browser and in Node (for tests).
 */
import { cleanLine, cleanText, starredKindOf } from './starred-items.ts';

export const sharedCollectionPath = '/starred/shared';
export const sharedTitleLimit = 120;
export const sharedDescriptionLimit = 500;
/** About 100 addresses keep a link under 8,000 characters, which every common browser and chat app accepts. */
export const sharedItemsLimit = 100;
const formatVersion = 1;

export interface SharedCollection {
	title: string;
	description: string;
	addresses: string[];
}

function toBase64Url(text: string): string {
	let binary = '';
	for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string | undefined {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) return undefined;
	try {
		const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return undefined;
	}
}

/** Keeps only addresses a reader can star, each once, in order, up to the limit. */
function cleanAddresses(addresses: unknown[]): string[] {
	const kept = new Set<string>();
	for (const address of addresses) {
		if (starredKindOf(address)) kept.add(address as string);
		if (kept.size === sharedItemsLimit) break;
	}
	return [...kept];
}

export function cleanSharedCollection(collection: SharedCollection): SharedCollection {
	return {
		title: cleanLine(collection.title, sharedTitleLimit),
		description: cleanText(collection.description, sharedDescriptionLimit).trim(),
		addresses: cleanAddresses(collection.addresses)
	};
}

export function encodeSharedCollection(collection: SharedCollection): string {
	const clean = cleanSharedCollection(collection);
	return toBase64Url(
		JSON.stringify({ v: formatVersion, t: clean.title, ...(clean.description ? { d: clean.description } : {}), a: clean.addresses })
	);
}

/** The link to share, such as https://example.org/starred/shared#c=… */
export function sharedCollectionLink(origin: string, collection: SharedCollection): string {
	return `${origin}${sharedCollectionPath}#c=${encodeSharedCollection(collection)}`;
}

/** Reads the part of a link after "#". Anything malformed gives undefined; a collection with no starrable pages gives undefined too. */
export function decodeSharedCollection(fragment: string): SharedCollection | undefined {
	const encoded = new URLSearchParams(fragment.replace(/^#/, '')).get('c');
	if (!encoded || encoded.length > 16_000) return undefined;
	const text = fromBase64Url(encoded);
	if (text === undefined) return undefined;
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return undefined;
	}
	if (typeof parsed !== 'object' || parsed === null) return undefined;
	const record = parsed as Record<string, unknown>;
	if (record.v !== formatVersion || !Array.isArray(record.a)) return undefined;
	const collection = cleanSharedCollection({
		title: typeof record.t === 'string' ? record.t : '',
		description: typeof record.d === 'string' ? record.d : '',
		addresses: record.a
	});
	return collection.addresses.length > 0 ? collection : undefined;
}
