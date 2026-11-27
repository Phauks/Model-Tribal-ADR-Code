import { describe, expect, it } from 'vitest';
import { fragmentId, samePageTarget } from '#lib/arrival-highlight.ts';

describe('arrival highlight', () => {
	it('reads the id a fragment names', () => {
		expect(fragmentId('#source-3')).toBe('source-3');
		expect(fragmentId('cite-1-2')).toBe('cite-1-2');
		expect(fragmentId('#caf%C3%A9')).toBe('café');
		expect(fragmentId('#')).toBeUndefined();
		expect(fragmentId('')).toBeUndefined();
		// A broken escape is kept as written rather than throwing.
		expect(fragmentId('#100%')).toBe('100%');
	});

	it('follows only links to a place on the same page', () => {
		const here = new URL('https://triballawproject.org/nations/karuk-tribe#source-2');
		const link = (href: string) => new URL(href, here) as unknown as HTMLAnchorElement;
		expect(samePageTarget(link('#source-4'), here)).toBe('source-4');
		expect(samePageTarget(link('/nations/karuk-tribe#cite-2-1'), here)).toBe('cite-2-1');
		expect(samePageTarget(link('/nations/navajo-nation#source-1'), here)).toBeUndefined();
		expect(samePageTarget(link('/nations/karuk-tribe?tab=map#source-1'), here)).toBeUndefined();
		expect(samePageTarget(link('https://example.org/nations/karuk-tribe#source-1'), here)).toBeUndefined();
		expect(samePageTarget(link('/nations/karuk-tribe'), here)).toBeUndefined();
	});
});
