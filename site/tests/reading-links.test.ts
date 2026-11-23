import { describe, expect, it } from 'vitest';
import { readingLinksHtml } from '#lib/reading-links.ts';

describe('reading links after a citation', () => {
	it('groups free and official texts, then subscription services, then background', () => {
		const html = readingLinksHtml({
			checked: '2026-11-23',
			links: [
				{ site: 'courtlistener', label: 'CourtListener', access: 'free', link: 'https://www.courtlistener.com/opinion/109857/santa-clara-pueblo-v-martinez/' },
				{ site: 'westlaw', label: 'Westlaw', access: 'subscription', link: 'https://1.next.westlaw.com/Link/Document/FullText?findType=Y&cite=436%20U.S.%2049' },
				{ site: 'library-of-congress', label: 'Library of Congress', access: 'official', link: 'https://www.loc.gov/item/usrep436049/' },
				{ site: 'wikipedia', label: 'Wikipedia', access: 'background', link: 'https://en.wikipedia.org/wiki/Santa_Clara_Pueblo_v._Martinez' },
				{ site: 'lexis', label: 'Lexis', access: 'subscription', link: 'https://advance.lexis.com/api/search?q=436%20U.S.%2049' }
			]
		});
		const text = html.replace(/<[^>]+>/g, '');
		expect(text.trim()).toBe(
			'Read it at CourtListener and Library of Congress. With a subscription: Westlaw and Lexis. Background, not legal authority: Wikipedia.'
		);
		expect(html).toContain('href="https://1.next.westlaw.com/Link/Document/FullText?findType=Y&amp;cite=436%20U.S.%2049"');
	});

	it('is empty for a record with no reading links', () => {
		expect(readingLinksHtml(undefined)).toBe('');
	});
});
