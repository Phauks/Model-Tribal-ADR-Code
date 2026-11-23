/**
 * Attestations to an essay's sections and subsections, in D1
 * (migrations/20261123T0531_add_essay_attestations.sql; docs/editing.md,
 * "Attesting to a section"). Each attestation and withdrawal is recorded in
 * the activity log in the same batch.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import { attestationRoleLabels, sha256Hex, type Attestation, type AttestationRole } from '../essays/attestations.ts';

/** The longest section text an attestation keeps, in characters. */
export const largestAttestedText = 400_000;

/** Every attestation to an essay that has not been withdrawn, oldest first. */
export async function essayAttestations(database: D1Database, essay: string): Promise<Attestation[]> {
	const result = await database
		.prepare(
			`SELECT essay_attestations.identifier, section_slug AS sectionSlug, section_title AS sectionTitle, essay_attestations.role,
				person_identifier AS personIdentifier, people.display_name AS personName, section_sha256 AS sectionSha256,
				note, created_at AS createdAt, shown_to_readers AS shownToReaders
			 FROM essay_attestations JOIN people ON people.identifier = essay_attestations.person_identifier
			 WHERE essay_identifier = ? AND withdrawn_at IS NULL
			 ORDER BY created_at, essay_attestations.identifier`
		)
		.bind(essay)
		.all<Omit<Attestation, 'shownToReaders'> & { shownToReaders: number }>();
	return result.results.map((row) => ({ ...row, shownToReaders: row.shownToReaders === 1 }));
}

export interface NewAttestation {
	essay: string;
	personIdentifier: string;
	role: AttestationRole;
	sectionSlug: string;
	sectionTitle: string;
	sectionLevel: 2 | 3;
	sectionText: string;
	note: string | null;
	/** Whether readers see the person's name under the section. */
	shownToReaders: boolean;
}

/** Records an attestation, and answers its identifier and the text's SHA-256. */
export async function attest(database: D1Database, input: NewAttestation): Promise<{ identifier: string; sha256: string }> {
	const text = input.sectionText.normalize('NFC').trim();
	if (!text) throw new Error('The section is empty.');
	if (text.length > largestAttestedText) throw new Error('The section is too long to attest to as one. Attest to its subsections.');
	const sha256 = await sha256Hex(text);
	const identifier = newIdentifier();
	await database.batch([
		database
			.prepare(
				`INSERT INTO essay_attestations (identifier, essay_identifier, section_slug, section_title, section_level, role,
					person_identifier, section_text, section_sha256, note, created_at, shown_to_readers)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(
				identifier,
				input.essay,
				input.sectionSlug,
				input.sectionTitle,
				input.sectionLevel,
				input.role,
				input.personIdentifier,
				text,
				sha256,
				input.note,
				now(),
				input.shownToReaders ? 1 : 0
			),
		eventStatement(database, {
			personIdentifier: input.personIdentifier,
			action: `Attested "${attestationRoleLabels[input.role]}" for the ${input.sectionLevel === 2 ? 'section' : 'subsection'} "${input.sectionTitle}"`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`,
			note: input.note
		})
	]);
	return { identifier, sha256 };
}

/**
 * Withdraws an attestation. Only its own person may, or someone with full
 * access to the essay. Answers false when there was nothing to withdraw.
 */
export async function withdrawAttestation(
	database: D1Database,
	input: { essay: string; identifier: string; personIdentifier: string; anyone: boolean }
): Promise<boolean> {
	const row = await database
		.prepare(
			`SELECT person_identifier AS personIdentifier, section_title AS sectionTitle, role
			 FROM essay_attestations WHERE identifier = ? AND essay_identifier = ? AND withdrawn_at IS NULL`
		)
		.bind(input.identifier, input.essay)
		.first<{ personIdentifier: string; sectionTitle: string; role: AttestationRole }>();
	if (!row || (!input.anyone && row.personIdentifier !== input.personIdentifier)) return false;
	await database.batch([
		database.prepare('UPDATE essay_attestations SET withdrawn_at = ? WHERE identifier = ?').bind(now(), input.identifier),
		eventStatement(database, {
			personIdentifier: input.personIdentifier,
			action: `Withdrew an attestation "${attestationRoleLabels[row.role]}" for "${row.sectionTitle}"`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
	return true;
}

/** Shows or hides a person's own attestation to readers. Answers false when there is none to change. */
export async function showToReaders(
	database: D1Database,
	input: { essay: string; identifier: string; personIdentifier: string; shown: boolean }
): Promise<boolean> {
	const result = await database
		.prepare(
			`UPDATE essay_attestations SET shown_to_readers = ?
			 WHERE identifier = ? AND essay_identifier = ? AND person_identifier = ? AND withdrawn_at IS NULL`
		)
		.bind(input.shown ? 1 : 0, input.identifier, input.essay, input.personIdentifier)
		.run();
	return result.meta.changes > 0;
}
