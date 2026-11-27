import { describe, expect, it, vi } from 'vitest';

vi.mock('virtual:source-citations', () => ({ sourceCitations: {} }));
import { documentBreakdown } from '#lib/server/collections.ts';
import type { PublicCopy } from '#lib/public-copies.ts';

const copy = (key: string, mediaType: string, pages?: number) => ({ key, mediaType, pages }) as PublicCopy;

// A document box's number in parts that add up to it (Trevor, Nov. 27, 2026: "if a stat is giving a number, provide more info about that number").
describe('documentBreakdown', () => {
	it('splits items into documents with their pages, saved web pages and items without a copy', () => {
		const items = [
			{ title: 'A', copies: [copy('a.pdf', 'application/pdf', 10), copy('a.html', 'text/html')] },
			{ title: 'B', copies: [copy('b.pdf', 'application/pdf', 5)] },
			{ title: 'C', copies: [copy('c.html', 'text/html')] },
			{ title: 'D' }
		];
		expect(documentBreakdown(items)).toEqual(['2 documents (15 pages)', '1 saved web page', '1 without a copy']);
	});

	it('counts a copy two items share once', () => {
		const shared = copy('s.pdf', 'application/pdf', 7);
		expect(documentBreakdown([{ title: 'A', copies: [shared] }, { title: 'B', copies: [shared] }])).toEqual(['2 documents (7 pages)']);
	});

	it('says nothing for a collection with no copies', () => {
		expect(documentBreakdown([{ title: 'A' }])).toEqual([]);
	});
});
