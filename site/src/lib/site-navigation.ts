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

/** The icons the menus use, by their Lucide names. */
export const navigationIconNames = [
	'book-a',
	'book-marked',
	'book-open',
	'building',
	'building-2',
	'calendar',
	'calendar-clock',
	'chart-column',
	'chart-pie',
	'clipboard-list',
	'copyright',
	'database',
	'dices',
	'file-check',
	'file-code',
	'file-pen',
	'file-text',
	'folder',
	'gauge',
	'gavel',
	'hand-heart',
	'handshake',
	'heart',
	'history',
	'info',
	'landmark',
	'layers',
	'library',
	'life-buoy',
	'list',
	'list-ordered',
	'map',
	'map-pinned',
	'newspaper',
	'notebook-pen',
	'pen-line',
	'pen-tool',
	'scale',
	'scroll',
	'scroll-text',
	'shopping-bag',
	'signature',
	'user-round',
	'users',
] as const;

export type NavigationIconName = (typeof navigationIconNames)[number];

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
	/** The icon beside the link in the menu: a Lucide icon's name (navigation-icons.ts). */
	icon: NavigationIconName;
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
					{ label: 'Directory', link: '/nations', icon: 'list', count: 'native-nations' },
					{ label: 'Map', link: '/nations/map', icon: 'map' },
					{ label: 'Find the Law', link: '/nations/law', icon: 'scale' },
					{ label: 'Find Recourse', link: '/nations/recourse', icon: 'life-buoy' }
				]
			},
			{
				title: 'Explore',
				links: [
					{ label: 'Timeline', link: '/nations/timeline', icon: 'history' },
					{ label: 'Data and Charts', link: '/nations/data', icon: 'chart-column', count: 'charts' },
					{ label: 'Federal Offices', link: '/nations/federal-offices', icon: 'landmark' },
					{ label: 'Coverage', link: '/nations/coverage', icon: 'gauge' }
				]
			},
			{
				title: 'Nations’ Own Law',
				links: [
					{ label: 'Constitutions', link: '/stats/tribal-constitutions', icon: 'scroll-text', count: 'tribal-constitutions' },
					{ label: 'Codes and Laws', link: '/stats/tribal-codes', icon: 'book-open', count: 'tribal-codes' },
					{ label: 'Compacts and Agreements', link: '/stats/intergovernmental-agreements', icon: 'handshake', count: 'intergovernmental-agreements' },
					{ label: 'Oklahoma State-Tribal Agreements', link: '/stats/oklahoma-state-tribal-agreements', icon: 'signature', count: 'oklahoma-state-tribal-agreements' },
					{ label: 'Governing Document Histories', link: '/stats/governing-documents', icon: 'layers', count: 'governing-documents' }
				]
			}
		],
		holds: ['/nations', '/stats/native-nations', '/stats/charts']
	},
	{
		key: 'federal-law',
		label: 'Federal Law',
		groups: [
			{
				title: 'Laws',
				links: [
					{ label: 'Treaties and Agreements', link: '/stats/treaties', icon: 'scroll', count: 'treaties' },
					{ label: 'Statutes', link: '/stats/federal-statutes', icon: 'book-marked', count: 'federal-statutes' },
					{ label: 'U.S. Code, Title 25', link: '/stats/united-states-code-sections', icon: 'library', count: 'united-states-code-sections' },
					{ label: 'Executive Orders', link: '/stats/executive-orders', icon: 'pen-line', count: 'executive-orders' }
				]
			},
			{
				title: 'Regulations and Notices',
				links: [
					{ label: 'Regulations', link: '/stats/federal-regulations', icon: 'clipboard-list', count: 'federal-regulations' },
					{ label: '25 C.F.R. Sections', link: '/stats/regulation-sections', icon: 'list-ordered', count: 'regulation-sections' },
					{ label: 'Federal Register Notices', link: '/stats/federal-register-notices', icon: 'newspaper', count: 'federal-register-notices' }
				]
			},
			{
				title: 'Agency Records',
				links: [
					{ label: 'Acknowledgment Petitions', link: '/stats/federal-acknowledgment', icon: 'file-check', count: 'federal-acknowledgment' },
					{ label: 'Gaming Commission', link: '/stats/national-indian-gaming-commission', icon: 'dices', count: 'national-indian-gaming-commission' },
					{ label: 'Land Cessions', link: '/stats/land-cessions', icon: 'map-pinned', count: 'land-cessions' }
				]
			}
		],
		holds: ['/laws']
	},
	{
		key: 'courts-and-cases',
		label: 'Courts and Cases',
		groups: [
			{
				title: 'U.S. Supreme Court',
				links: [
					{ label: 'Cases', link: '/stats/supreme-court-cases', icon: 'gavel', count: 'supreme-court-cases' },
					{ label: 'Courts by Chief Justice', link: '/supreme-court', icon: 'landmark', count: 'supreme-courts' },
					{ label: 'Justices', link: '/stats/justices', icon: 'users', count: 'justices' }
				]
			},
			{
				title: 'Other Courts',
				links: [
					{ label: 'Tribal Court Opinions', link: '/stats/tribal-court-opinions', icon: 'file-text', count: 'tribal-court-opinions' },
					{ label: 'State Court Opinions', link: '/stats/state-court-opinions', icon: 'building-2', count: 'state-court-opinions' },
					{ label: 'Interior Board of Indian Appeals', link: '/stats/interior-board-of-indian-appeals', icon: 'scale', count: 'interior-board-of-indian-appeals' },
					{ label: 'Other Court Cases', link: '/stats/other-court-cases', icon: 'folder', count: 'other-court-cases' }
				]
			},
			{
				title: 'Directory',
				links: [{ label: 'Courts', link: '/courts', icon: 'building', count: 'courts' }]
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
					{ label: 'Glossary', link: '/glossary', icon: 'book-a', count: 'glossary-terms' },
					{ label: 'Biographies', link: '/biographies', icon: 'user-round', count: 'biographies' },
					{ label: 'U.S. Presidents', link: '/stats/presidents', icon: 'users', count: 'presidents' },
					{ label: 'Historic Maps', link: '/stats/historic-maps', icon: 'map', count: 'historic-maps' }
				]
			},
			{
				title: 'Files',
				links: [
					{ label: 'Source Documents', link: '/copies', icon: 'file-text', count: 'source-copies' },
					{ label: 'Data Sets', link: '/downloads', icon: 'database' },
					{ label: 'Forms', link: '/forms', icon: 'file-pen', count: 'forms' }
				]
			},
			{
				title: 'About the Collection',
				links: [
					{ label: 'Statistics', link: '/stats', icon: 'chart-pie' },
					{ label: 'Licenses by Material', link: '/licenses', icon: 'copyright' },
					{ label: 'Back Matter', link: '/back-matter', icon: 'book-open' }
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
					{ label: 'Foundations', link: '/foundations', icon: 'layers' },
					{ label: 'Essays', link: '/essays', icon: 'pen-tool' },
					{ label: 'Methods and Stories', link: '/stories', icon: 'notebook-pen', count: 'stories' }
				]
			},
			{
				title: 'Being Written',
				links: [
					{ label: 'Model Code', link: '/code', icon: 'file-code', soon: true },
					{ label: 'Peacemaking', link: '/peacemaking', icon: 'handshake', soon: true }
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
				title: 'The Project',
				links: [
					{ label: 'About the Project', link: '/about', icon: 'info' },
					{ label: 'Timeline to Public Review', link: '/about/timeline', icon: 'calendar-clock' },
					{ label: 'Events', link: '/events', icon: 'calendar' }
				]
			},
			{
				title: 'Take Part',
				links: [
					{ label: 'Contribute', link: '/requests?kind=contribute', icon: 'hand-heart' },
					{ label: 'Sponsorship', link: '/sponsor', icon: 'heart' },
					{ label: 'Store', link: '/store', icon: 'shopping-bag' }
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
