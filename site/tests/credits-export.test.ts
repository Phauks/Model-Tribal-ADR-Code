import { describe, expect, it } from 'vitest';
import { creditsPage, literalMarkdown } from '#lib/credits-export.ts';

describe('the book’s Credits page', () => {
	it('prints sections in order, sorted by family name, with only book credits', () => {
		const page = creditsPage(
			[
				{ section: 'reviewers', line: 'Zoe Adams', sortKey: 'adams', biography: null, inBook: true },
				{ section: 'contributors', line: 'Ada Example (Sample Nation)', sortKey: 'example', biography: 'Writes about mediation.', inBook: true },
				{ section: 'reviewers', line: 'Bo Brown', sortKey: 'brown', biography: null, inBook: false },
				{ section: 'advisors', line: 'Al Zed', sortKey: 'zed', biography: null, inBook: true },
				{ section: 'reviewers', line: 'Cy Able', sortKey: 'able', biography: null, inBook: true }
			],
			'2026-11-22'
		);
		expect(page).toBe(
			[
				'---',
				'id: credits',
				'title: Credits',
				'exported: 2026-11-22',
				'sources: []',
				'---',
				'',
				'## Advisors',
				'',
				'Al Zed',
				'',
				'## Contributors',
				'',
				'**Ada Example \\(Sample Nation\\).** Writes about mediation\\.',
				'',
				'## Reviewers',
				'',
				'Cy Able',
				'',
				'Zoe Adams',
				''
			].join('\n')
		);
	});

	it('keeps names from starting headings, lists, links or citations', () => {
		expect(literalMarkdown('# [@key] *x* 1. -y')).toBe('\\# \\[\\@key\\] \\*x\\* 1\\. \\-y');
		expect(literalMarkdown('Line one\nline two')).toBe('Line one line two');
	});
});
