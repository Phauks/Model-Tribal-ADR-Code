import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseEssay } from '../src/lib/essays/document.ts';
import { currentAttestations, essaySectionHashes, namesShownByDefault, essaySections, readerCredits, sectionText, sha256Hex, withReaderCredits, type Attestation } from '../src/lib/essays/attestations.ts';
import { attest, essayAttestations, showToReaders, withdrawAttestation } from '#lib/server/essay-attestations.ts';
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
			createdAt,
			shownToReaders: true
		});
		const shown = currentAttestations(
			[make('reviewed', 'cal', '2026-11-20'), make('wrote', 'ann', '2026-11-19'), make('wrote', 'ann', '2026-11-21'), make('edited', 'ben', '2026-11-21')],
			'worcester'
		);
		expect(shown.map((attestation) => `${attestation.role} ${attestation.personIdentifier} ${attestation.createdAt}`)).toEqual([
			'wrote ann 2026-11-21',
			'edited ben 2026-11-21',
			'reviewed cal 2026-11-20'
		]);
	});
});

describe('attestations in the database', () => {
	let database: D1Database;
	beforeEach(async () => {
		database = testDatabase();
		await database.batch([
			database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Ann', 'lead-author', 'active', '2026-11-22T00:00:00Z')`),
			database.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('advisor', 'a@example.org', 'Cal', 'advisor', 'active', '2026-11-22T00:00:00Z')`),
			database.prepare(`INSERT INTO essays (identifier, part, created_at) VALUES ('i-timeline', 'foundations', '2026-11-22T00:00:00Z')`)
		]);
	});

	const input = { essay: 'i-timeline', role: 'wrote' as const, sectionSlug: 'worcester', sectionTitle: 'Worcester', sectionLevel: 3 as const, sectionText: '### Worcester\n\nMarshall wrote.\n', note: null, shownToReaders: true };

	it('keeps the text and its SHA-256, and logs the attestation', async () => {
		const saved = await attest(database, { ...input, personIdentifier: 'lead' });
		expect(saved.sha256).toBe(await sha256Hex('### Worcester\n\nMarshall wrote.'));
		const [row] = await essayAttestations(database, 'i-timeline');
		expect(row).toMatchObject({ sectionSlug: 'worcester', role: 'wrote', personName: 'Ann', sectionSha256: saved.sha256 });
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

	it('keeps whether readers see the name, which only its person can change', async () => {
		const saved = await attest(database, { ...input, shownToReaders: false, personIdentifier: 'lead' });
		expect((await essayAttestations(database, 'i-timeline'))[0].shownToReaders).toBe(false);
		expect(await showToReaders(database, { essay: 'i-timeline', identifier: saved.identifier, personIdentifier: 'advisor', shown: true })).toBe(false);
		expect(await showToReaders(database, { essay: 'i-timeline', identifier: saved.identifier, personIdentifier: 'lead', shown: true })).toBe(true);
		expect((await essayAttestations(database, 'i-timeline'))[0].shownToReaders).toBe(true);
	});

	it('starts the reader-name box off for advisors, and for reviewing', () => {
		expect(namesShownByDefault('lead-author', 'wrote')).toBe(true);
		expect(namesShownByDefault('editor', 'edited')).toBe(true);
		expect(namesShownByDefault('editor', 'reviewed')).toBe(false);
		expect(namesShownByDefault('advisor', 'wrote')).toBe(false);
		expect(namesShownByDefault('advisor', 'reviewed')).toBe(false);
	});

	it('refuses an empty section', async () => {
		await expect(attest(database, { ...input, sectionText: '  ', personIdentifier: 'lead' })).rejects.toThrow(/empty/);
	});
});

describe('credits for readers', () => {
	const make = (role: Attestation['role'], name: string, sha: string, shown = true): Attestation => ({
		identifier: `${name}-${role}`,
		sectionSlug: 'worcester',
		sectionTitle: 'Worcester',
		role,
		personIdentifier: name.toLowerCase(),
		personName: name,
		sectionSha256: sha,
		note: null,
		createdAt: '2026-11-21T00:00:00Z',
		shownToReaders: shown
	});

	it('shows only people who chose to be shown, for the text as published', async () => {
		const doc = parseEssay(body);
		const hashes = await essaySectionHashes(doc);
		const credits = readerCredits(
			[
				make('wrote', 'Ann', hashes.worcester),
				make('wrote', 'Dee', hashes.worcester),
				make('edited', 'Ben', 'f'.repeat(64)),
				make('reviewed', 'Cal', hashes.worcester, false)
			],
			hashes
		);
		expect(credits).toEqual({ worcester: [{ role: 'wrote', names: ['Ann', 'Dee'] }] });
		const html = withReaderCredits('<h2 id="the-cherokee-cases">The Cherokee Cases</h2>\n<h3 id="worcester">Worcester</h3>\n<p>Marshall wrote.</p>', credits);
		expect(html).toBe(
			'<h2 id="the-cherokee-cases">The Cherokee Cases</h2>\n<h3 id="worcester">Worcester</h3>\n<p class="essay-section-credit">Written by Ann and Dee.</p>\n<p>Marshall wrote.</p>'
		);
	});
});
