import { describe, expect, it } from 'vitest';
import { claimedPage, storyReviewStatus, unclaimedPage } from '#lib/review-status.ts';
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
});
