import { describe, expect, it } from 'vitest';
import { nationNamesAndKinds, nationNameVariants, nations, nationsForReview } from '#lib/server/content.ts';

// The case pages call nationNamesAndKinds() for every case and every nation in it. When it read
// and parsed all of content/tribes/ on each call, the prerender spent 805 of its 1,153 seconds on
// that alone (Nov. 24, 2026), and Cloudflare stopped half of that day's deploys at their time limit.
describe('the nation records', () => {
	it('are read once and shared', () => {
		expect(nationNamesAndKinds()).toBe(nationNamesAndKinds());
	});

	it('give the same nations to every reader of them', () => {
		const names = nationNamesAndKinds();
		const reviewed = nationsForReview();
		expect(reviewed.map((record) => record.id).sort()).toEqual([...names.keys()].sort());
		for (const record of nations()) expect(names.has(record.id)).toBe(true);
		const variants = new Set(nationNameVariants());
		for (const { name } of names.values()) expect(variants.has(name)).toBe(true);
	});
});
