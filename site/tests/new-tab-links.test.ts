import { describe, expect, it } from 'vitest';
import { isOutsideLink } from '#lib/new-tab-links.ts';

const origin = 'https://triballawproject.org';

describe('which links on a nation page open in a new tab', () => {
	it('opens links to other websites in a new tab', () => {
		expect(isOutsideLink('https://www.ecfr.gov/current/title-25/part-83', origin)).toBe(true);
		expect(isOutsideLink('http://example.org/', origin)).toBe(true);
	});

	it('keeps links within the site, anchors and email links in the same tab', () => {
		expect(isOutsideLink('/requests?kind=contribute', origin)).toBe(false);
		expect(isOutsideLink('#sources', origin)).toBe(false);
		expect(isOutsideLink(`${origin}/glossary`, origin)).toBe(false);
		expect(isOutsideLink('mailto:office@example.org', origin)).toBe(false);
		expect(isOutsideLink('tel:+15555550100', origin)).toBe(false);
	});
});
