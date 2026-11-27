import { describe, expect, it } from 'vitest';
import { readRequestForm } from '#lib/server/request-form.ts';
import { partReport, reportedAddress, reportLink } from '#lib/report-request.ts';
import { similarPages, similarQuery } from '#lib/similar-pages.ts';
import type { PanelAnswer } from '#lib/search-everything.ts';

describe('pages with a similar address', () => {
	it('searches the words of the address’s last part', () => {
		expect(similarQuery('/nations/karuk-trib')).toBe('karuk trib');
		expect(similarQuery('/laws/indian-reorganization-act-of-1934/')).toBe('indian reorganization act 1934');
		expect(similarQuery('/library/a%20treaty.pdf')).toBe('treaty');
		expect(similarQuery('/')).toBe('');
	});

	it('lists the first three results with their kind, leaving out the address itself', () => {
		const answer = {
			total: 5,
			groups: [
				{ group: 'nation', count: 2, results: [{ title: 'Karuk Tribe', link: '/nations/karuk-tribe', detail: 'California' }, { title: 'Karuk Trib', link: '/nations/karuk-trib' }] },
				{
					group: 'document',
					count: 3,
					results: [
						{ title: 'Liquor Ordinance of the Karuk Tribe of California', link: '/a', detail: 'Federal Register notice · 2007 · Karuk Tribe' },
						{ title: 'HEARTH Act Approval', link: '/b', detail: 'Federal Register notice · 2022' },
						{ title: 'Another', link: '/c' }
					]
				}
			]
		} as PanelAnswer;
		expect(similarPages(answer, '/nations/karuk-trib')).toEqual([
			{ title: 'Karuk Tribe', link: '/nations/karuk-tribe', detail: 'Nation · California' },
			{ title: 'Liquor Ordinance of the Karuk Tribe of California', link: '/a', detail: 'Federal Register notice · 2007' },
			{ title: 'HEARTH Act Approval', link: '/b', detail: 'Federal Register notice · 2022' }
		]);
	});
});

describe('Report from an error', () => {
	it('names the address without its query, where sign-in links carry codes', () => {
		expect(reportedAddress(new URL('https://triballawproject.org/sign-in/link?code=123456'))).toBe('https://triballawproject.org/sign-in/link');
	});

	it('links to the request page with the same answers for a reader without scripts', () => {
		const link = reportLink(partReport(new URL('https://triballawproject.org/nations/map?view=lands'), 'The map failed to load.'));
		const query = new URL(link, 'https://triballawproject.org').searchParams;
		expect(query.get('kind')).toBe('broken-page');
		expect(query.get('address')).toBe('https://triballawproject.org/nations/map');
		expect(query.get('details')).toBe('The map failed to load.');
	});

	it('keeps a broken page as a correction that needs the address but not details', async () => {
		const form = new FormData();
		for (const [name, value] of Object.entries({ kind: 'broken-page', contact: 'reader@example.org', material: 'https://triballawproject.org/nations/karuk-trib', acceptStatements: 'yes' })) form.set(name, value);
		const result = await readRequestForm(form);
		if (!result.ok) throw new Error(JSON.stringify(result.errors));
		expect(result.request).toMatchObject({ kind: 'correct', material: 'https://triballawproject.org/nations/karuk-trib', details: 'Broken page.' });
	});
});
