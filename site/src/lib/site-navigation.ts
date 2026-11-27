/**
 * The site's six sections, as the section bar under the masthead lists them
 * (SectionBar.svelte) and the side column follows them (SiteSidebar.svelte).
 *
 * Trevor chose this navigation on Nov. 27, 2026 (model C, design/navigation-models):
 * the sections sit in a row under the header, each opening a menu of its
 * pages in groups, and the side column shows only where the reader is (the
 * section's pages, or a nation's own pages) and the headings of the page.
 * The sections follow the groups of the Statistics page
 * (src/lib/server/collections.ts), then the writing and the About pages, so
 * the treaties, laws and cases have a home of their own and no section
 * singles out dispute resolution.
 */

/** One link in a section's menu. */
export type NavigationLink = {
	label: string;
	link: string;
	/**
	 * The collection whose count shows beside the link
	 * (src/lib/server/collections.ts), counted when the site is built.
	 */
	count?: string;
	/** Not published yet: named, not linked. */
	soon?: boolean;
};

export type NavigationGroup = { title: string; links: NavigationLink[] };

export type NavigationSection = {
	key: string;
	label: string;
	/** The section's own page, where it has one. */
	home?: string;
	groups: NavigationGroup[];
	/**
	 * The addresses that belong to the section besides its links: a path and
	 * everything under it. The longest match across the sections wins, so
	 * /stats belongs to the Library while /stats/treaties belongs to Federal law.
	 */
	holds: string[];
};

export const navigationSections: NavigationSection[] = [
	{
		key: 'nations',
		label: 'Nations',
		home: '/nations',
		groups: [
			{
				title: 'Find',
				links: [
					{ label: 'Directory', link: '/nations', count: 'native-nations' },
					{ label: 'Map', link: '/nations/map' },
					{ label: 'Find the law', link: '/nations/law' },
					{ label: 'Find recourse', link: '/nations/recourse' }
				]
			},
			{
				title: 'Explore',
				links: [
					{ label: 'Timeline', link: '/nations/timeline' },
					{ label: 'Data and charts', link: '/nations/data', count: 'charts' },
					{ label: 'Federal offices', link: '/nations/federal-offices' },
					{ label: 'Coverage', link: '/nations/coverage' }
				]
			},
			{
				title: 'Nations’ own law',
				links: [
					{ label: 'Constitutions', link: '/stats/tribal-constitutions', count: 'tribal-constitutions' },
					{ label: 'Codes and laws', link: '/stats/tribal-codes', count: 'tribal-codes' },
					{ label: 'Compacts and agreements', link: '/stats/intergovernmental-agreements', count: 'intergovernmental-agreements' },
					{ label: 'Oklahoma state-tribal agreements', link: '/stats/oklahoma-state-tribal-agreements', count: 'oklahoma-state-tribal-agreements' },
					{ label: 'Governing document histories', link: '/stats/governing-documents', count: 'governing-documents' }
				]
			}
		],
		holds: ['/nations', '/stats/native-nations', '/stats/charts']
	},
	{
		key: 'federal-law',
		label: 'Federal law',
		groups: [
			{
				title: 'Laws',
				links: [
					{ label: 'Treaties and agreements', link: '/stats/treaties', count: 'treaties' },
					{ label: 'Statutes', link: '/stats/federal-statutes', count: 'federal-statutes' },
					{ label: 'U.S. Code, Title 25', link: '/stats/united-states-code-sections', count: 'united-states-code-sections' },
					{ label: 'Executive orders', link: '/stats/executive-orders', count: 'executive-orders' }
				]
			},
			{
				title: 'Regulations and notices',
				links: [
					{ label: 'Regulations', link: '/stats/federal-regulations', count: 'federal-regulations' },
					{ label: '25 C.F.R. sections', link: '/stats/regulation-sections', count: 'regulation-sections' },
					{ label: 'Federal Register notices', link: '/stats/federal-register-notices', count: 'federal-register-notices' }
				]
			},
			{
				title: 'Agency records',
				links: [
					{ label: 'Acknowledgment petitions', link: '/stats/federal-acknowledgment', count: 'federal-acknowledgment' },
					{ label: 'Gaming Commission', link: '/stats/national-indian-gaming-commission', count: 'national-indian-gaming-commission' },
					{ label: 'Land cessions', link: '/stats/land-cessions', count: 'land-cessions' }
				]
			}
		],
		holds: ['/laws']
	},
	{
		key: 'courts-and-cases',
		label: 'Courts and cases',
		groups: [
			{
				title: 'U.S. Supreme Court',
				links: [
					{ label: 'Cases', link: '/stats/supreme-court-cases', count: 'supreme-court-cases' },
					{ label: 'Courts by Chief Justice', link: '/supreme-court', count: 'supreme-courts' },
					{ label: 'Justices', link: '/stats/justices', count: 'justices' }
				]
			},
			{
				title: 'Other courts',
				links: [
					{ label: 'Tribal court opinions', link: '/stats/tribal-court-opinions', count: 'tribal-court-opinions' },
					{ label: 'State court opinions', link: '/stats/state-court-opinions', count: 'state-court-opinions' },
					{ label: 'Interior Board of Indian Appeals', link: '/stats/interior-board-of-indian-appeals', count: 'interior-board-of-indian-appeals' },
					{ label: 'Other court cases', link: '/stats/other-court-cases', count: 'other-court-cases' }
				]
			},
			{
				title: 'Directory',
				links: [{ label: 'Courts', link: '/courts', count: 'courts' }]
			}
		],
		holds: ['/cases', '/stats/supreme-courts', '/stats/courts']
	},
	{
		key: 'library',
		label: 'Library',
		home: '/library',
		groups: [
			{
				title: 'Reference',
				links: [
					{ label: 'Glossary', link: '/glossary', count: 'glossary-terms' },
					{ label: 'Biographies', link: '/biographies', count: 'biographies' },
					{ label: 'U.S. Presidents', link: '/stats/presidents', count: 'presidents' },
					{ label: 'Historic maps', link: '/stats/historic-maps', count: 'historic-maps' }
				]
			},
			{
				title: 'Files',
				links: [
					{ label: 'Source documents', link: '/copies', count: 'source-copies' },
					{ label: 'Data sets', link: '/downloads' },
					{ label: 'Forms', link: '/forms', count: 'forms' }
				]
			},
			{
				title: 'About the collection',
				links: [
					{ label: 'Statistics', link: '/stats' },
					{ label: 'Licenses by material', link: '/licenses' },
					{ label: 'Back matter', link: '/back-matter' }
				]
			}
		],
		holds: ['/library', '/verify', '/stats/biographies', '/stats/glossary-terms', '/stats/source-copies', '/stats/forms']
	},
	{
		key: 'writing',
		label: 'Writing',
		groups: [
			{
				title: 'Published',
				links: [
					{ label: 'Foundations', link: '/foundations' },
					{ label: 'Essays', link: '/essays' },
					{ label: 'Methods and stories', link: '/stories', count: 'stories' }
				]
			},
			{
				title: 'Being written',
				links: [
					{ label: 'Model code', link: '/code', soon: true },
					{ label: 'Peacemaking', link: '/peacemaking', soon: true }
				]
			}
		],
		holds: ['/stats/stories']
	},
	{
		key: 'about',
		label: 'About',
		home: '/about',
		groups: [
			{
				title: 'The project',
				links: [
					{ label: 'About the project', link: '/about' },
					{ label: 'Timeline to public review', link: '/about/timeline' },
					{ label: 'Events', link: '/events' }
				]
			},
			{
				title: 'Take part',
				links: [
					{ label: 'Contribute', link: '/requests?kind=contribute' },
					{ label: 'Sponsorship', link: '/sponsor' },
					{ label: 'Store', link: '/store' }
				]
			}
		],
		holds: ['/requests', '/sponsors', '/sponsorship', '/book', '/orders', '/contributors', '/acknowledgments', '/charter', '/changelog', '/using-ai', '/join']
	}
];

/** A section's links, in menu order. */
export function sectionLinks(section: NavigationSection): NavigationLink[] {
	return section.groups.flatMap((group) => group.links);
}

const within = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** The section a page belongs to, if any: the one with the longest address that holds it. */
export function navigationSectionOf(path: string): NavigationSection | undefined {
	let best: { section: NavigationSection; length: number } | undefined;
	for (const section of navigationSections) {
		const prefixes = [...sectionLinks(section).filter((link) => !link.soon).map((link) => link.link.split('?')[0]), ...section.holds];
		if (section.home) prefixes.push(section.home);
		for (const prefix of prefixes) {
			if (within(path, prefix) && (!best || prefix.length > best.length)) best = { section, length: prefix.length };
		}
	}
	return best?.section;
}

/**
 * The link in a section's menu that is the page being read: an exact match,
 * with its query where the link has one (Contribute is /requests?kind=contribute).
 */
export function currentNavigationLink(section: NavigationSection | undefined, path: string, search: string): NavigationLink | undefined {
	if (!section) return undefined;
	const links = sectionLinks(section);
	return links.find((link) => link.link === `${path}${search}`) ?? links.find((link) => link.link === path);
}

/** The counts shown beside the menus' links, by collection, when the site is built. */
export type NavigationCounts = Record<string, number>;

/**
 * The link in a section's menu that holds the page being read, for the side
 * column: the page itself, or the link with the longest address above it
 * (a chart under /nations/data is in Data and charts).
 */
export function holdingNavigationLink(section: NavigationSection, path: string, search: string): NavigationLink | undefined {
	const exact = currentNavigationLink(section, path, search);
	if (exact) return exact;
	let best: NavigationLink | undefined;
	for (const link of sectionLinks(section)) {
		const address = link.link.split('?')[0];
		if (!link.soon && path.startsWith(`${address}/`) && (!best || address.length > best.link.split('?')[0].length)) best = link;
	}
	return best;
}
