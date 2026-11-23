import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseEssay } from '../src/lib/essays/document.ts';
import { currentAttestations, essaySections, sectionText, sha256Hex, type Attestation } from '../src/lib/essays/attestations.ts';
import { attest, essayAttestations, withdrawAttestation } from '#lib/server/essay-attestations.ts';
import { testDatabase } from './database.ts';

const body = ['## The Cherokee Cases', '', 'Opening.', '', '### Worcester', '', 'Marshall wrote.', '', '## Allotment', '', 'Later.', '', '## Allotment', '', 'Again.', ''].join('\n');

describe('essay sections', () => {
	it('finds sections and subsections with the ids the page gives their headings', () => {
		const sections = essaySections(parseEssay(body));
		expect(sections.map((section) => [section.slug, section.level, section.index, section.end])).toEqual([
			['the-cherokee-cases', 2, 0, 4],
			['worcester', 3, 2, 4],
			['allotment', 2, 4, 6],
			['allotment-2', 2, 6, 8]
		]);
	});

	it('takes a section with its subsections, and a subsection alone', () => {
		const doc = parseEssay(body);
		const [section, subsection] = essaySections(doc);
		expect(sectionText(doc, section)).toBe('## The Cherokee Cases\n\nOpening.\n\n### Worcester\n\nMarshall wrote.');
		expect(sectionText(doc, subsection)).toBe('### Worcester\n\nMarshall wrote.');
	});

	it('shows the newest attestation per person and role, writers first', () => {
		const make = (role: Attestation['role'], person: string, createdAt: string): Attestation => ({
			identifier: `${person}-${createdAt}`,
			sectionSlug: 'worcester',
			sectionTitle: 'Worcester',
			role,
			personIdentifier: person,
			personName: person,
			sectionSha256: '0'.repeat(64),
			note: null,
			createdAt
		});
		const shown = currentAttestations(
			[make('reviewed', 'patrick', '2026-11-20'), make('wrote', 'trevor', '2026-11-19'), make('wrote', 'trevor', '2026-11-21'), make('edited', 'danielle', '2026-11-21')],
			'worcester'
		);
		expect(shown.map((attestation) => `${attestation.role} ${attestation.personIdentifier} ${attestation.createdAt}`)).toEqual([
			'wrote trevor 2026-11-21',
			'edited danielle 2026-11-21',
			'reviewed patrick 2026-11-20'
		]);
	});
});

describe('attestations in the database', () => {
	let database: D1Database;
	beforeEach(async () => {
		database = testDatabase();
		await database.batch([
			database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Trevor', 'lead-author', 'active', '2026-11-22T00:00:00Z')`),
			database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('advisor', 'a@example.org', 'Patrick', 'advisor', 'active', '2026-11-22T00:00:00Z')`),
			database.prepare(`INSERT INTO essays (identifier, part, created_at) VALUES ('i-timeline', 'foundations', '2026-11-22T00:00:00Z')`)
		]);
	});

	const input = { essay: 'i-timeline', role: 'wrote' as const, sectionSlug: 'worcester', sectionTitle: 'Worcester', sectionLevel: 3 as const, sectionText: '### Worcester\n\nMarshall wrote.\n', note: null };

	it('keeps the text and its SHA-256, and logs the attestation', async () => {
		const saved = await attest(database, { ...input, personIdentifier: 'lead' });
		expect(saved.sha256).toBe(await sha256Hex('### Worcester\n\nMarshall wrote.'));
		const [row] = await essayAttestations(database, 'i-timeline');
		expect(row).toMatchObject({ sectionSlug: 'worcester', role: 'wrote', personName: 'Trevor', sectionSha256: saved.sha256 });
		const logged = await database.prepare(`SELECT action FROM events WHERE target_identifier = 'essay:i-timeline'`).all<{ action: string }>();
		expect(logged.results.map((entry) => entry.action)).toEqual(['Attested "Written by" for the subsection "Worcester"']);
	});

	it('lets only its person, or someone with full access, withdraw it, and never deletes it', async () => {
		const saved = await attest(database, { ...input, personIdentifier: 'lead' });
		expect(await withdrawAttestation(database, { essay: 'i-timeline', identifier: saved.identifier, personIdentifier: 'advisor', anyone: false })).toBe(false);
		expect(await withdrawAttestation(database, { essay: 'i-timeline', identifier: saved.identifier, personIdentifier: 'lead', anyone: false })).toBe(true);
		expect(await essayAttestations(database, 'i-timeline')).toEqual([]);
		expect(await withdrawAttestation(database, { essay: 'i-timeline', identifier: saved.identifier, personIdentifier: 'lead', anyone: true })).toBe(false);
		await expect(database.prepare('DELETE FROM essay_attestations').run()).rejects.toThrow(/cannot be deleted/);
		await expect(database.prepare(`UPDATE essay_attestations SET note = 'changed'`).run()).rejects.toThrow(/only be withdrawn/);
	});

	it('refuses an empty section', async () => {
		await expect(attest(database, { ...input, sectionText: '  ', personIdentifier: 'lead' })).rejects.toThrow(/empty/);
	});
});
