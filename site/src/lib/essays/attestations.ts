/**
 * Attesting to a section or subsection of an essay (Trevor, Nov. 22, 2026:
 * "Allow attestation of authors and editors within sections and
 * sub-sections"). A person says they wrote, edited or reviewed a section as
 * it stands; the site keeps the section's Markdown and its SHA-256
 * (migrations/20261123T0531_add_essay_attestations.sql), so the editor can
 * tell when the text has changed since.
 *
 * Used by the editor and the server alike, so it runs in both.
 */
import type { Node as EditorNode } from 'prosemirror-model';
import { headingSlug } from './render.ts';
import { serializeEssay } from './document.ts';
import { unitEnd } from './placement.ts';
import { escapeHtml } from '../escape-html.ts';

export const attestationRoles = ['wrote', 'edited', 'reviewed'] as const;
export type AttestationRole = (typeof attestationRoles)[number];

/** How each role reads under a heading. */
export const attestationRoleLabels: Record<AttestationRole, string> = {
	wrote: 'Written by',
	edited: 'Edited by',
	reviewed: 'Reviewed by'
};

/** How each role reads as a choice in the Attest dialog. */
export const attestationRoleChoices: Record<AttestationRole, string> = {
	wrote: 'I wrote it',
	edited: 'I edited it',
	reviewed: 'I reviewed it'
};

export function isAttestationRole(value: unknown): value is AttestationRole {
	return typeof value === 'string' && (attestationRoles as readonly string[]).includes(value);
}

/** One section or subsection of an essay in the editor. */
export interface EssaySection {
	/** The heading's id on the essay page (render.ts, headingSlug). */
	slug: string;
	title: string;
	level: 2 | 3;
	/** The heading's index among the document's top-level blocks. */
	index: number;
	/** The index just past the section, subsections included. */
	end: number;
}

/**
 * The sections (level 2 headings) and subsections (level 3) of an essay,
 * with the ids the essay page gives their headings. Every heading takes an
 * id in order, as on the page, where "sources-heading" is already taken.
 */
export function essaySections(doc: EditorNode): EssaySection[] {
	const used = new Set(['sources-heading']);
	const found: EssaySection[] = [];
	doc.forEach((node, _offset, index) => {
		if (node.type.name !== 'heading') return;
		const slug = headingSlug(node.textContent, used);
		const level = Number(node.attrs.level ?? 2);
		if (level !== 2 && level !== 3) return;
		found.push({ slug, title: node.textContent.trim(), level, index, end: unitEnd(doc, index, level) });
	});
	return found;
}

/** A section's Markdown, heading and subsections included, as attested and compared. */
export function sectionText(doc: EditorNode, section: Pick<EssaySection, 'index' | 'end'>): string {
	const blocks: EditorNode[] = [];
	for (let index = section.index; index < section.end && index < doc.childCount; index += 1) blocks.push(doc.child(index));
	return serializeEssay(doc.type.create(null, blocks)).normalize('NFC').trim();
}

/** The SHA-256 of a text, in lower-case hexadecimal. */
export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A section as the Attest dialog shows it. */
export interface AttestSection {
	slug: string;
	title: string;
	level: 2 | 3;
	text: string;
	/** The section's SHA-256 as it stands. */
	sha256: string;
}

/** An attestation as the editor shows it. */
export interface Attestation {
	identifier: string;
	sectionSlug: string;
	sectionTitle: string;
	role: AttestationRole;
	personIdentifier: string;
	personName: string;
	sectionSha256: string;
	note: string | null;
	createdAt: string;
	/** Whether the person chose to show their name to readers under the section. */
	shownToReaders: boolean;
}

/**
 * The attestations to show for a section: the newest per person and role,
 * in the order Written, Edited, Reviewed, then oldest first.
 */
export function currentAttestations(attestations: Attestation[], slug: string): Attestation[] {
	const newest = new Map<string, Attestation>();
	for (const attestation of attestations) {
		if (attestation.sectionSlug !== slug) continue;
		const key = `${attestation.personIdentifier} ${attestation.role}`;
		const known = newest.get(key);
		if (!known || known.createdAt < attestation.createdAt) newest.set(key, attestation);
	}
	return [...newest.values()].sort(
		(first, second) =>
			attestationRoles.indexOf(first.role) - attestationRoles.indexOf(second.role) || first.createdAt.localeCompare(second.createdAt)
	);
}

/**
 * Whether the "Show my name to readers" box starts checked. Advisors stay
 * unnamed on the public site until the lead author says otherwise, so it
 * starts off for them in every role; for everyone else it starts on for
 * writing and editing and off for reviewing.
 */
export function namesShownByDefault(personRole: string, role: AttestationRole): boolean {
	return personRole !== 'advisor' && role !== 'reviewed';
}

/** Each section's SHA-256 as the text stands, by heading id. */
export async function essaySectionHashes(doc: EditorNode): Promise<Record<string, string>> {
	const hashes: Record<string, string> = {};
	for (const section of essaySections(doc)) hashes[section.slug] = await sha256Hex(sectionText(doc, section));
	return hashes;
}

/** Who readers see under a section: each role with its names, in the order Written, Edited, Reviewed. */
export type ReaderCredits = Record<string, { role: AttestationRole; names: string[] }[]>;

/**
 * The credits readers see under each heading of a published text: the
 * attestations whose person chose to show them and whose text is the
 * section as published (`hashes`, from essaySectionHashes).
 */
export function readerCredits(attestations: Attestation[], hashes: Record<string, string>): ReaderCredits {
	const credits: ReaderCredits = {};
	for (const slug of new Set(attestations.map((attestation) => attestation.sectionSlug))) {
		if (!hashes[slug]) continue;
		const lines: ReaderCredits[string] = [];
		for (const attestation of currentAttestations(attestations, slug)) {
			if (!attestation.shownToReaders || attestation.sectionSha256 !== hashes[slug]) continue;
			const line = lines.find((candidate) => candidate.role === attestation.role);
			if (!line) lines.push({ role: attestation.role, names: [attestation.personName] });
			else if (!line.names.includes(attestation.personName)) line.names.push(attestation.personName);
		}
		if (lines.length) credits[slug] = lines;
	}
	return credits;
}

/** "Ann", "Ann and Ben", "Ann, Ben, and Cal" (the style guide uses the serial comma). */
export function joinNames(names: string[]): string {
	if (names.length < 3) return names.join(' and ');
	return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

/** Puts each section's credit line under its heading in an essay's HTML. */
export function withReaderCredits(html: string, credits: ReaderCredits): string {
	if (Object.keys(credits).length === 0) return html;
	return html.replace(/(<h([23])\b[^>]*\bid="([^"]+)"[^>]*>[\s\S]*?<\/h\2>)/g, (heading: string, _all: string, _level: string, slug: string) => {
		const lines = credits[slug];
		if (!lines) return heading;
		const text = lines.map((line) => `${attestationRoleLabels[line.role]} ${escapeHtml(joinNames(line.names))}.`).join(' ');
		return `${heading}\n<p class="essay-section-credit">${text}</p>`;
	});
}
