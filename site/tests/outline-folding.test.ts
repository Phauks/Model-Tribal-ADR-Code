import { describe, expect, it } from 'vitest';
import { holds, isUnfolded } from '../src/lib/outline-folding.ts';
import type { OutlineItem } from '../src/lib/site-sections.ts';

const outline: OutlineItem[] = [
	{ label: 'Before contact', link: '#before-contact', children: [{ label: 'Councils', link: '#councils' }] },
	{ label: 'Removal', link: '#removal', children: [{ label: 'The Cherokee Cases', link: '#the-cherokee-cases', children: [{ label: 'Worcester', link: '#worcester' }] }] }
];
const at = (id: string) => (item: OutlineItem) => item.link === `#${id}`;

describe('folding the sidebar outline', () => {
	it('opens only the entries that hold where the reader is', () => {
		expect(outline.map((item) => isUnfolded(item, {}, at('worcester')))).toEqual([false, true]);
		expect(isUnfolded(outline[1].children![0], {}, at('worcester'))).toBe(true);
		expect(holds(outline[0], at('worcester'))).toBe(false);
	});

	it('keeps what the reader opened or shut', () => {
		expect(isUnfolded(outline[0], { '#before-contact': true }, at('worcester'))).toBe(true);
		expect(isUnfolded(outline[1], { '#removal': false }, at('worcester'))).toBe(false);
	});
});
