import { describe, expect, it } from 'vitest';
import {
	accessAllowsDisplay,
	awaitsNationReview,
	shownExcerpts,
	shownFullText,
	shownTellings,
	storiesOfNation,
	storyIsShown,
	storySourceKeys,
	type StoryRecord,
	type StoryTelling
} from '#lib/story-visibility.ts';

const today = '2026-11-22';

function telling(overrides: Partial<StoryTelling> = {}): StoryTelling {
	return {
		id: 'nation-page',
		source: 'example-nation-history-page',
		authority: 'nation-government',
		permitted_uses: { level: 'quote' },
		access: { level: 'nation-review-first' },
		...overrides
	};
}

function story(overrides: Partial<StoryRecord> = {}): StoryRecord {
	return {
		id: 'example-nation-peace',
		title: 'The peace',
		nations: ['example-nation'],
		kind: 'historical-account',
		tellings: [telling()],
		excerpts: [
			{
				telling: 'nation-page',
				locator: 'second paragraph',
				text: 'The two towns made peace.',
				words: 5,
				sha256: '0'.repeat(64)
			}
		],
		access: { level: 'nation-review-first' },
		sensitivity: { tribal_review_required: true },
		review_status: 'drafted-from-public-sources',
		found_in: ['2026-11-21-peacemaking-stories'],
		...overrides
	};
}

describe('access levels on the website (decision record 0029)', () => {
	it('shows public and nation-review-first material', () => {
		expect(accessAllowsDisplay({ level: 'public' }, today)).toBe(true);
		expect(accessAllowsDisplay({ level: 'nation-review-first' }, today)).toBe(true);
	});

	it('never shows restricted material', () => {
		expect(accessAllowsDisplay({ level: 'restricted' }, today)).toBe(false);
	});

	it('shows embargoed material only from its date', () => {
		expect(accessAllowsDisplay({ level: 'embargoed', until: '2026-12-01' }, today)).toBe(false);
		expect(accessAllowsDisplay({ level: 'embargoed', until: '2026-11-22' }, today)).toBe(true);
		expect(accessAllowsDisplay({ level: 'embargoed' }, today)).toBe(false);
	});
});

describe('which stories are shown', () => {
	it('shows a story awaiting the nation’s review, with the notice', () => {
		const record = story();
		expect(storyIsShown(record, today)).toBe(true);
		expect(awaitsNationReview(record)).toBe(true);
	});

	it('drops the notice once the nation has reviewed it', () => {
		expect(awaitsNationReview(story({ review_status: 'approved-by-nation' }))).toBe(false);
	});

	it('hides restricted and withdrawn stories', () => {
		expect(storyIsShown(story({ access: { level: 'restricted' } }), today)).toBe(false);
		expect(storyIsShown(story({ sensitivity: { restricted: true } }), today)).toBe(false);
		expect(storyIsShown(story({ review_status: 'withdrawn-at-request' }), today)).toBe(false);
	});

	it('holds a telling from a contributor filing until it is public', () => {
		const fromPerson = telling({ id: 'interview', source: undefined, filing: 'filing-2026-0001' });
		const record = story({ tellings: [fromPerson], excerpts: [] });
		expect(shownTellings(record, today)).toEqual([]);
		expect(storyIsShown(record, today)).toBe(false);

		const cleared = story({
			tellings: [{ ...fromPerson, access: { level: 'public' } }],
			excerpts: []
		});
		expect(storyIsShown(cleared, today)).toBe(true);
	});

	it('hides a restricted telling but keeps the others', () => {
		const record = story({
			tellings: [telling(), telling({ id: 'recorder', authority: 'outside-recorder', access: { level: 'restricted' } })]
		});
		expect(shownTellings(record, today).map((item) => item.id)).toEqual(['nation-page']);
	});
});

describe('which excerpts are quoted', () => {
	it('quotes a short excerpt the telling allows', () => {
		expect(shownExcerpts(story(), today)[0].quoted).toBe(true);
	});

	it('gives only the pinpoint for an excerpt held privately', () => {
		const record = story({
			excerpts: [{ telling: 'nation-page', locator: 'part II', held_privately: true, words: 27, sha256: '0'.repeat(64) }]
		});
		const [excerpt] = shownExcerpts(record, today);
		expect(excerpt.quoted).toBe(false);
		expect(excerpt.locator).toBe('part II');
	});

	it('does not quote when the telling allows reference only', () => {
		const record = story({ tellings: [telling({ permitted_uses: { level: 'reference-only' } })] });
		expect(shownExcerpts(record, today)[0].quoted).toBe(false);
	});

	it('does not quote more than 50 words without permission to publish in full', () => {
		const long = { ...story().excerpts![0], words: 51 };
		expect(shownExcerpts(story({ excerpts: [long] }), today)[0].quoted).toBe(false);
		const permitted = story({
			excerpts: [long],
			tellings: [telling({ permitted_uses: { level: 'publish-in-full' } })]
		});
		expect(shownExcerpts(permitted, today)[0].quoted).toBe(true);
	});

	it('leaves out excerpts of a telling that is not shown', () => {
		const record = story({ tellings: [telling({ access: { level: 'restricted' } })] });
		expect(shownExcerpts(record, today)).toEqual([]);
	});
});

it('lists every source a story cites', () => {
	const record = story({
		titles_in_language: [{ text: 'Name', language: 'und', source: 'language-page' }],
		protocols: [{ kind: 'seasonal', statement: 'Told in winter.', source: 'protocol-page' }]
	});
	expect(storySourceKeys([record]).sort()).toEqual(['example-nation-history-page', 'language-page', 'protocol-page']);
});

describe('full text (decision record 0034)', () => {
	const fullText = {
		telling: 'nation-page',
		locator: 'pages 1-3',
		basis: 'public-domain' as const,
		basis_note: 'Published in 1901.',
		transcribed_from: 'The 1901 printing.',
		paragraphs: ['The two towns made peace.', { omitted: 'A passage is left out.', locator: 'page 2' }],
		words: 5,
		sha256: '0'.repeat(64)
	};

	it('shows the full text of a shown telling', () => {
		expect(shownFullText(story({ full_text: fullText }), today)).toEqual(fullText);
	});

	it('shows nothing when the record has no full text', () => {
		expect(shownFullText(story(), today)).toBeUndefined();
	});

	it('never shows the full text of a restricted telling', () => {
		const record = story({ full_text: fullText, tellings: [telling({ access: { level: 'restricted' } })] });
		expect(shownFullText(record, today)).toBeUndefined();
	});

	it('shows a full text resting on permission only when the telling may be published in full', () => {
		const permitted = { ...fullText, basis: 'permission' as const };
		expect(shownFullText(story({ full_text: permitted }), today)).toBeUndefined();
		const record = story({ full_text: permitted, tellings: [telling({ permitted_uses: { level: 'publish-in-full' } })] });
		expect(shownFullText(record, today)).toEqual(permitted);
	});

	it('shows a full text resting on the lead author\'s decision, but never for a restricted telling (decision record 0035)', () => {
		const decided = { ...fullText, basis: 'lead-author-decision' as const };
		expect(shownFullText(story({ full_text: decided }), today)).toEqual(decided);
		const restricted = story({ full_text: decided, tellings: [telling({ access: { level: 'restricted' } })] });
		expect(shownFullText(restricted, today)).toBeUndefined();
	});
});

describe('stories on a nation’s page', () => {
	it('lists the stories that name the nation, including shared ones', () => {
		const own = story({ id: 'own' });
		const shared = story({ id: 'shared', nations: ['other-nation', 'example-nation'] });
		const elsewhere = story({ id: 'elsewhere', nations: ['other-nation'] });
		expect(storiesOfNation([own, shared, elsewhere], 'example-nation', today).map((record) => record.id)).toEqual([
			'own',
			'shared'
		]);
	});

	it('never lists a restricted, withdrawn or embargoed story', () => {
		const records = [
			story({ id: 'restricted', access: { level: 'restricted' } }),
			story({ id: 'flagged', sensitivity: { restricted: true } }),
			story({ id: 'withdrawn', review_status: 'withdrawn-at-request' }),
			story({ id: 'embargoed', access: { level: 'embargoed', until: '2027-01-01' } })
		];
		expect(storiesOfNation(records, 'example-nation', today)).toEqual([]);
	});
});
