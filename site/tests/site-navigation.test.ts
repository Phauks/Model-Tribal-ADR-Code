import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import {
	currentNavigationLink,
	holdingNavigationLink,
	navigationSectionOf,
	navigationSections,
	sectionLinks
} from '../src/lib/site-navigation.ts';
import { nationFamily } from '../src/lib/nation-family.ts';
import { browseIdentifiers } from '../src/lib/browse-identifiers.ts';

const sectionOf = (path: string) => navigationSectionOf(path)?.label;
const section = (key: string) => navigationSections.find((candidate) => candidate.key === key)!;

describe('the sections in the bar under the masthead', () => {
	it('lists the sections Trevor chose, in order (design/navigation-models, model C; Support and Store apart from About, Nov. 28, 2026)', () => {
		expect(navigationSections.map((candidate) => candidate.label)).toEqual(['Nations', 'Federal Law', 'Courts and Cases', 'Library', 'Writing', 'About', 'Support', 'Store']);
	});

	it('links only to pages that exist, apart from those marked soon', () => {
		for (const candidate of navigationSections) {
			for (const link of sectionLinks(candidate)) {
				// Contribute opens Request a Change over the page being read (src/lib/report-request.ts).
				if (link.soon || link.link.startsWith('#request')) continue;
				const address = link.link.split('?')[0];
				const route = `src/routes${address}`;
				// A browsed Federal collection's page is drawn by /laws/[collection=browse] (src/lib/browse-identifiers.ts).
				const browsed = /^\/laws\/([^/]+)$/.exec(address)?.[1];
				const found =
					existsSync(`${route}/+page.svelte`) ||
					existsSync(`${route}/+page.server.ts`) ||
					existsSync(`${route.replace(/\/[^/]+$/, '')}/[collection]/+page.svelte`) ||
					(browsed !== undefined && (browseIdentifiers as readonly string[]).includes(browsed) && existsSync('src/routes/laws/[collection=browse]/+page.svelte'));
				expect(found, `${candidate.label}: ${link.label} (${link.link})`).toBe(true);
			}
		}
	});

	it('gives every section a home page of its own, which its name links to (Trevor, Nov. 27, 2026)', () => {
		expect(navigationSections.map((candidate) => candidate.home)).toEqual(['/nations', '/laws', '/cases', '/library', '/writing', '/about', '/sponsor', '/store']);
		for (const candidate of navigationSections) {
			expect(existsSync(`src/routes${candidate.home}/+page.svelte`), `${candidate.label}: ${candidate.home}`).toBe(true);
		}
		expect(sectionOf('/laws')).toBe('Federal Law');
		expect(sectionOf('/cases')).toBe('Courts and Cases');
		expect(sectionOf('/writing')).toBe('Writing');
	});

	it('finds the section of a page from its address, the longest match winning', () => {
		expect(sectionOf('/nations')).toBe('Nations');
		expect(sectionOf('/nations/navajo-nation')).toBe('Nations');
		expect(sectionOf('/nations/navajo-nation/opinions')).toBe('Nations');
		expect(sectionOf('/stats/treaties')).toBe('Federal Law');
		expect(sectionOf('/laws/some-law')).toBe('Federal Law');
		expect(sectionOf('/cases/worcester-v-georgia')).toBe('Courts and Cases');
		expect(sectionOf('/supreme-court/marshall-court')).toBe('Courts and Cases');
		expect(sectionOf('/stats')).toBe('Library');
		expect(sectionOf('/copies/view/constitutions/law.pdf')).toBe('Library');
		expect(sectionOf('/glossary/adr')).toBe('Library');
		expect(sectionOf('/stories/some-story')).toBe('Writing');
		expect(sectionOf('/essays/first')).toBe('Writing');
		expect(sectionOf('/book')).toBe('Store');
		expect(sectionOf('/sponsor/levels')).toBe('Support');
		expect(sectionOf('/about/project')).toBe('About');
		expect(sectionOf('/nations/directory')).toBe('Nations');
		expect(sectionOf('/')).toBeUndefined();
		expect(sectionOf('/nationsx')).toBeUndefined();
		// Pages not published yet do not claim their addresses.
		expect(sectionOf('/code')).toBeUndefined();
	});

	it('marks the link that is the page being read, with its query where it has one', () => {
		const courts = section('courts-and-cases');
		const gaming = '/stats/national-indian-gaming-commission';
		expect(currentNavigationLink(courts, gaming, '?national-indian-gaming-commission.detail=Commission+final+decision')?.label).toBe('Gaming Commission Decisions');
		expect(currentNavigationLink(courts, gaming, '')?.label).not.toBe('Gaming Commission Decisions');
		expect(currentNavigationLink(section('nations'), '/nations/map', '')?.label).toBe('Map');
	});

	it('finds the link above a page for the side column', () => {
		expect(holdingNavigationLink(section('nations'), '/nations/data/population', '')?.label).toBe('Data and Charts');
		expect(holdingNavigationLink(section('nations'), '/nations/map', '')?.label).toBe('Map');
		expect(holdingNavigationLink(section('library'), '/glossary/adr', '')?.label).toBe('Glossary');
	});
});

describe('a nation’s own pages in the side column', () => {
	it('lists the nation page, and its court opinions only when it has some', () => {
		expect(nationFamily('navajo-nation', 'Navajo Nation', 949)).toEqual({
			title: 'Navajo Nation',
			pages: [
				{ label: 'Nation Page', link: '/nations/navajo-nation' },
				{ label: 'Court Opinions', link: '/nations/navajo-nation/opinions', count: 949 }
			]
		});
		expect(nationFamily('hopi-tribe', 'Hopi Tribe', 0).pages).toHaveLength(1);
	});
});
