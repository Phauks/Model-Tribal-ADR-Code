import { describe, expect, it } from 'vitest';
import { claimedPage, storyReviewStatus, unclaimedPage } from '#lib/review-status.ts';
import { historyBadgeLabel, lastChangeSentence } from '#lib/page-history.ts';
import { pageOverlay } from '#lib/server/nation-page-overlay.ts';

describe('the status line on pages about a nation', () => {
	it('says Unclaimed with a clock, and Claimed by the nation with a check', () => {
		expect(unclaimedPage).toEqual({ label: 'Unclaimed', verified: false });
		expect(claimedPage).toEqual({ label: 'Claimed by the nation', verified: true });
	});

	it('gives a story the same kind of status, from its review', () => {
		expect(storyReviewStatus(undefined)).toEqual({ label: 'Unreviewed', verified: false });
		expect(storyReviewStatus('drafted-from-public-sources')).toEqual({ label: 'Unreviewed', verified: false });
		expect(storyReviewStatus('reviewed-by-nation')).toEqual({ label: 'Reviewed by the nation', verified: true });
		expect(storyReviewStatus('approved-by-nation')).toEqual({ label: 'Approved by the nation', verified: true });
	});

	it('draws a claimed page’s badge with a panel naming the offices that keep it, never people', () => {
		const status =
			pageOverlay('navajo-nation', {}, { claimedSince: '2026-11-23T12:00:00.000Z', offices: ['Office of the President <b>'] })?.slots
				.status ?? '';
		expect(status).toContain('<details class="status-popover">');
		expect(status).toContain('class="review-badge review-badge-verified"');
		expect(status).toContain('<li>Office of the President &lt;b&gt;</li>');
		expect(status).toContain('Confirmed with the nation’s office on');
		expect(status).toContain('/profile/nation-team?nation=navajo-nation');
		expect(status).toContain('[data-build-status]{display:none!important}');
	});

	it('keeps the page history out of the status panel, as a badge of its own', () => {
		const claimed = pageOverlay('navajo-nation', {}, { claimedSince: '2026-11-23T12:00:00.000Z' })?.slots ?? {};
		expect(claimed.status).not.toContain('/changes?page=');
		expect(claimed.history).toBeUndefined();

		const latest = {
			id: 'page-7',
			change: 'edit' as const,
			parts: ['Dispute resolution'],
			who: 'Site release',
			textHidden: false,
			madeAt: '2026-11-23T06:12:00Z'
		};
		const history = pageOverlay('navajo-nation', {}, undefined, { count: 2, latest: latest as never, recordedSince: undefined })?.slots.history ?? '';
		expect(history).toContain('[data-build-history]{display:none!important}');
		expect(history).toContain('<span class="visually-hidden">Page history:</span>');
		expect(history).toContain('2 changes');
		// Pacific time: 06:12 UTC on Nov. 23 is the evening of Nov. 22.
		expect(history).toContain('<strong>Last changed Nov. 22, 2026.</strong> Dispute resolution was updated in a site release.');
		// The page's own Changes view, so the nation's side column stays (design/page-changes-in-page, option B).
		expect(history).toContain('href="/nations/navajo-nation/changes"');

		const unchanged = pageOverlay('navajo-nation', {}, undefined, { count: 0, latest: undefined, recordedSince: '2026-11-23T03:49:00Z' })?.slots.history ?? '';
		expect(unchanged).toContain('No changes yet');
		expect(unchanged).toContain('No changes since Nov. 22, 2026,');
	});

	it('words the badge and the newest change plainly, naming parts and never wording', () => {
		expect([0, 1, 2, 1200].map(historyBadgeLabel)).toEqual(['No changes yet', '1 change', '2 changes', '1,200 changes']);
		const change = { change: 'edit' as const, parts: ['Courts', 'Contacts', 'Gaming'], who: 'Site release', textHidden: false };
		expect(lastChangeSentence(change)).toBe('Courts, Contacts, and Gaming were updated in a site release.');
		expect(lastChangeSentence({ ...change, parts: ['About'], who: 'Office of the President' })).toBe('About was updated by Office of the President.');
		expect(lastChangeSentence({ ...change, change: 'new' })).toBe('The page was added in a site release.');
		expect(lastChangeSentence({ ...change, textHidden: true, who: undefined })).toBe('The page was updated.');
	});
});
