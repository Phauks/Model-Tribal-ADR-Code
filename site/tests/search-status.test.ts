import { describe, expect, it } from 'vitest';
import { emptySectionNote } from '../src/lib/search-status.ts';

const what = 'a court or other forum';
const why = 'A nation can settle disputes through its council.';

describe('emptySectionNote', () => {
	it('says how far a finished search went, and never that none exists', () => {
		const empty = emptySectionNote(what, why, {
			status: 'none-found',
			lastSearched: '2026-11-22',
			places: 6,
			placeKinds: ['nation-website', 'project-capture', 'bureau-of-indian-affairs-list', 'state-court-directory']
		});
		expect(empty.text).toBe('None found');
		expect(empty.note).toContain('searched 6 places for a court or other forum');
		expect(empty.note).toContain(
			'including the nation’s website, the Bureau of Indian Affairs’ list and state court directories'
		);
		expect(empty.note).toContain('Nov. 22, 2026');
		expect(empty.note).toContain(why);
		expect(empty.note).not.toMatch(/does not exist|no court exists/i);
	});

	it('says a search is not finished', () => {
		const empty = emptySectionNote(what, why, { status: 'partly-searched', places: 1, placeKinds: [] });
		expect(empty.text).toBe('None found yet');
		expect(empty.note).toContain('one place');
		expect(empty.note).toContain('not finished');
	});

	it('says when no search has been made', () => {
		const empty = emptySectionNote('a constitution', '', undefined);
		expect(empty.text).toBe('None found yet');
		expect(empty.note).toBe(
			'None of the sources checked so far name a constitution, and a full search has not been made yet.'
		);
	});

	it('says a lead is being checked when a search found something not yet shown', () => {
		const empty = emptySectionNote(what, why, {
			status: 'found',
			lastSearched: '2026-11-22',
			places: 2,
			placeKinds: []
		});
		expect(empty.text).toBe('None shown yet');
		expect(empty.note).toBe(
			'A search on Nov. 22, 2026 found a lead on a court or other forum, which is being checked before it is shown here.'
		);
	});
});
