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
	'activity',
	'archive',
	'bell',
	'book-a',
	'book-marked',
	'book-open',
	'book-user',
	'briefcase',
	'building',
	'building-2',
	'calendar',
	'calendar-clock',
	'chart-column',
	'chart-pie',
	'clipboard-list',
	'contact',
	'copyright',
	'database',
	'dices',
	'eye-off',
	'file-check',
	'file-code',
	'file-diff',
	'file-pen',
	'file-search',
	'file-text',
	'flag',
	'folder',
	'folder-input',
	'gauge',
	'gavel',
	'hand-coins',
	'hand-heart',
	'handshake',
	'heart',
	'history',
	'inbox',
	'info',
	'key-round',
	'landmark',
	'languages',
	'layers',
	'library',
	'life-buoy',
	'list',
	'list-ordered',
	'mail',
	'map',
	'map-pinned',
	'message-square',
	'newspaper',
	'notebook-pen',
	'pen-line',
	'pen-tool',
	'radar',
	'receipt',
	'scale',
	'scroll',
	'scroll-text',
	'send',
	'shield-check',
	'shopping-bag',
	'signature',
	'star',
	'text-cursor-input',
	'upload',
	'user-round',
	'users',
	'video',
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

/** A picture on a section home's card (SectionCards.svelte): a copy served from this site, credited under the cards. */
export type SectionPicture = {
	src: string;
	/** Empty when the picture only decorates the card's name. */
	alt: string;
	width: number;
	height: number;
	/** What it shows, who made it and when, where the original is, and its license, as the "Picture credits" fold lists it. */
	credit: string;
	/** The holding library's or archive's record of the original. */
	source?: string;
};

export type NavigationGroup = {
	title: string;
	links: NavigationLink[];
	/** One line under the group's name on the section's home page. */
	line?: string;
	/** The picture at the top of the group's card on the section's home page. */
	picture?: SectionPicture;
	/** Sits beneath the other groups, across the whole menu, rather than beside them, and under the cards on the home page (Courts and Cases' Directory, which covers every kind of court). */
	beneath?: boolean;
};

export type NavigationSection = {
	key: string;
	label: string;
	/**
	 * The section's own page, which its name in the section bar and the phone
	 * Menu sheet links to (Trevor, Nov. 27, 2026: no "All of …" link; every
	 * section has a home). Each of the six sections has one; the Workspace
	 * has one only when the reader's role opens its Overview.
	 */
	home?: string;
	/** The section's name in sentence case, as its own page's title and the breadcrumbs give it. */
	title?: string;
	groups: NavigationGroup[];
	/**
	 * The addresses that belong to the section besides its links: a path and
	 * everything under it. The longest match across the sections wins, so
	 * /stats belongs to the Library while /stats/treaties belongs to Federal law.
	 */
	holds: string[];
};

/** The directory's kinds of court behind each Courts link in the Courts and Cases menu (src/lib/server/courts.ts names the kinds), keyed by the count beside the link. */
export const courtKindGroups: Record<string, string[]> = {
	'courts-tribal': ['Tribal court'],
	'courts-state-and-territorial': ['State court', 'Territorial court'],
	'courts-federal': ['Federal court']
};

/** The directory of courts, filtered to one group of kinds through its table's address (DataTable `shareable`, identifier `courts`). */
function courtsOfKind(key: string): string {
	return `/courts?${courtKindGroups[key].map((kind) => `courts.kind=${kind.replaceAll(' ', '+')}`).join('&')}`;
}

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
					{ label: 'Self-Governance and Federal Programs', link: '/nations/federal-programs', icon: 'handshake' },
					{ label: 'Languages', link: '/languages', icon: 'languages', count: 'languages' },
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
		holds: ['/nations', '/languages', '/stats/native-nations', '/stats/charts', '/stats/languages', '/stats/language-families']
	},
	{
		key: 'federal-law',
		label: 'Federal Law',
		title: 'Federal law',
		home: '/laws',
		groups: [
			{
				title: 'Treaties',
				line: 'Made with Native nations',
				picture: { src: '/pictures/federal-law/treaties.jpg', alt: '', width: 720, height: 400, credit: 'Treaty with the Delawares, Fort Pitt, September 17, 1778, the marks and seals of White Eyes and The Pipe. National Archives (Ratified Indian Treaty 8). Public domain.', source: 'https://catalog.archives.gov/id/176316991' },
				links: [
					{ label: 'Treaties and Agreements', link: '/stats/treaties', icon: 'scroll', count: 'treaties' },
					{ label: 'Land Cessions', link: '/stats/land-cessions', icon: 'map-pinned', count: 'land-cessions' }
				]
			},
			{
				title: 'Congress',
				line: 'Acts of Congress and the record behind them',
				picture: { src: '/pictures/federal-law/congress.jpg', alt: '', width: 720, height: 400, credit: 'United States Capitol, photograph by Carol M. Highsmith, December 7, 2008. Carol M. Highsmith’s America, Library of Congress. Public domain.', source: 'https://lccn.loc.gov/2010630189' },
				links: [
					{ label: 'Statutes', link: '/stats/federal-statutes', icon: 'book-marked', count: 'federal-statutes' },
					{ label: 'U.S. Code, Title 25', link: '/laws/usc-25', icon: 'library', count: 'united-states-code-sections' },
					{ label: 'Hearings', link: '/stats/congressional-hearings', icon: 'message-square', count: 'congressional-hearings' },
					{ label: 'Committee Reports', link: '/stats/committee-reports', icon: 'file-text', count: 'committee-reports' },
					{ label: 'Committee Prints', link: '/stats/committee-prints', icon: 'scroll-text', count: 'committee-prints' },
					{ label: 'Research Service Reports', link: '/stats/congressional-research-service-reports', icon: 'library', count: 'congressional-research-service-reports' },
					{ label: 'Serial Set, 1817–1899', link: '/stats/serial-set', icon: 'archive', count: 'serial-set' }
				]
			},
			{
				title: 'President',
				line: 'Orders, proclamations and memoranda',
				picture: { src: '/pictures/federal-law/president.jpg', alt: '', width: 720, height: 400, credit: 'The White House, photograph by Carol M. Highsmith, October 3, 2008. Carol M. Highsmith’s America, Library of Congress. Public domain.', source: 'https://lccn.loc.gov/2010630940' },
				links: [{ label: 'Executive Orders', link: '/laws/executive-orders', icon: 'pen-line', count: 'executive-orders' }]
			},
			{
				title: 'Agencies',
				line: 'Rules, notices, opinions and decisions',
				picture: { src: '/pictures/federal-law/agencies.jpg', alt: '', width: 720, height: 400, credit: 'Department of the Interior headquarters, Washington, D.C., photograph by Carol M. Highsmith, between 1980 and 2006. Carol M. Highsmith Archive, Library of Congress. Public domain.', source: 'https://lccn.loc.gov/2011634641' },
				links: [
					{ label: 'Regulations', link: '/stats/federal-regulations', icon: 'clipboard-list', count: 'federal-regulations' },
					{ label: '25 C.F.R. Sections', link: '/stats/regulation-sections', icon: 'list-ordered', count: 'regulation-sections' },
					{ label: 'Federal Register Notices', link: '/stats/federal-register-notices', icon: 'newspaper', count: 'federal-register-notices' },
					{ label: 'Solicitor’s Opinions', link: '/stats/solicitor-opinions', icon: 'scale', count: 'solicitor-opinions' },
					{ label: 'Indian Affairs Manual', link: '/stats/indian-affairs-manual', icon: 'book-open', count: 'indian-affairs-manual' },
					{ label: 'Acknowledgment Petitions', link: '/stats/federal-acknowledgment', icon: 'file-check', count: 'federal-acknowledgment' },
					{ label: 'Gaming Commission', link: '/stats/national-indian-gaming-commission', icon: 'dices', count: 'national-indian-gaming-commission' },
					{ label: 'Films and Recordings', link: '/stats/indian-affairs-films', icon: 'archive', count: 'indian-affairs-films' }
				]
			}
		],
		holds: ['/laws']
	},
	{
		key: 'courts-and-cases',
		label: 'Courts and Cases',
		title: 'Courts and cases',
		home: '/cases',
		// One group for each court system, side by side and none above another (Trevor, Nov. 27, 2026: "imposing the supreme court over all the others is a bit imposing, we should try and treat it more fairy"), Tribal courts first; the directory of every court sits beneath them (design/section-homes/nav/2-balanced-menu-and-page.png).
		groups: [
			{
				title: 'Tribal Courts',
				line: 'Courts of Native nations, deciding under each nation’s own law.',
				picture: { src: '/pictures/courts-and-cases/tribal-courts.jpg', alt: '', width: 720, height: 400, credit: 'Cherokee National Supreme Court Building (1844), Tahlequah, Oklahoma, photograph by the National Trails Office, U.S. National Park Service, March 31, 2016. Public domain.', source: 'https://commons.wikimedia.org/wiki/File:The_exterior_of_the_Cherokee_National_Supreme_Court_Museum_in_Tahlequah,_Oklahoma_(0c9bfdfd-54db-422b-85d7-786908473ff7).JPG' },
				links: [
					{ label: 'Opinions', link: '/stats/tribal-court-opinions', icon: 'file-text', count: 'tribal-court-opinions' },
					{ label: 'Courts', link: courtsOfKind('courts-tribal'), icon: 'building', count: 'courts-tribal' }
				]
			},
			{
				title: 'State Courts',
				line: 'State and territorial courts, in cases that reach Native nations, people and lands.',
				picture: { src: '/pictures/courts-and-cases/state-courts.jpg', alt: '', width: 720, height: 400, credit: 'New Mexico Supreme Court Building, Santa Fe, photograph by WhisperToMe, released by the photographer to the public domain.', source: 'https://commons.wikimedia.org/wiki/File:NMSupremeCourtSantaFe.JPG' },
				links: [
					{ label: 'Opinions', link: '/stats/state-court-opinions', icon: 'building-2', count: 'state-court-opinions' },
					{ label: 'Courts', link: courtsOfKind('courts-state-and-territorial'), icon: 'building', count: 'courts-state-and-territorial' }
				]
			},
			{
				title: 'U.S. Supreme Court',
				line: 'Its cases on Native law, its Justices and each Court by Chief Justice.',
				picture: { src: '/pictures/courts-and-cases/supreme-court.jpg', alt: '', width: 720, height: 400, credit: 'Supreme Court Building, west front, Washington, D.C., photograph by Carol M. Highsmith, between 1980 and 2006. Carol M. Highsmith Archive, Library of Congress. Public domain.', source: 'https://lccn.loc.gov/2011631106' },
				links: [
					{ label: 'Cases', link: '/stats/supreme-court-cases', icon: 'gavel', count: 'supreme-court-cases' },
					{ label: 'Courts by Chief Justice', link: '/supreme-court', icon: 'landmark', count: 'supreme-courts' },
					{ label: 'Justices', link: '/stats/justices', icon: 'users', count: 'justices' },
					{ label: 'Timeline', link: '/supreme-court/timeline', icon: 'history' }
				]
			},
			{
				title: 'Other Federal Courts',
				line: 'District courts, courts of appeals, the Court of Claims and others.',
				picture: { src: '/pictures/courts-and-cases/federal-courts.jpg', alt: '', width: 720, height: 400, credit: 'Robert T. Matsui United States Courthouse, Sacramento, California, photograph by Carol M. Highsmith, between 1980 and 2006. Carol M. Highsmith Archive, Library of Congress. Public domain.', source: 'https://lccn.loc.gov/2011634780' },
				links: [
					{ label: 'Cases', link: '/stats/other-court-cases', icon: 'folder', count: 'other-court-cases' },
					{ label: 'Courts', link: courtsOfKind('courts-federal'), icon: 'building', count: 'courts-federal' }
				]
			},
			{
				title: 'Federal Agency Boards',
				line: 'Appeals and final decisions made inside federal agencies.',
				picture: { src: '/pictures/federal-law/agencies.jpg', alt: '', width: 720, height: 400, credit: 'Department of the Interior headquarters, Washington, D.C., photograph by Carol M. Highsmith, between 1980 and 2006. Carol M. Highsmith Archive, Library of Congress. Public domain.', source: 'https://lccn.loc.gov/2011634641' },
				links: [
					{ label: 'Interior Board of Indian Appeals', link: '/stats/interior-board-of-indian-appeals', icon: 'scale', count: 'interior-board-of-indian-appeals' },
					{ label: 'Gaming Commission Decisions', link: '/stats/national-indian-gaming-commission?national-indian-gaming-commission.detail=Commission+final+decision', icon: 'dices', count: 'gaming-commission-final-decisions' }
				]
			},
			{
				title: 'Directory',
				line: 'Every court named on this site, with its kind, nation, opinions and cases.',
				beneath: true,
				links: [{ label: 'All Courts', link: '/courts', icon: 'building', count: 'courts' }]
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
					{ label: 'Historic Maps', link: '/stats/historic-maps', icon: 'map', count: 'historic-maps' },
					// The reader's own starred pages, kept on this device, so readers who are not signed in still find them (they are in the account menu too).
					{ label: 'Starred Pages', link: '/starred', icon: 'star' }
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
		holds: ['/library', '/verify', '/presidents', '/stats/biographies', '/stats/glossary-terms', '/stats/source-copies', '/stats/forms']
	},
	{
		key: 'writing',
		label: 'Writing',
		home: '/writing',
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
					// Posts for readers, written and published on the site like the essays (src/lib/server/news-posts.ts; design/news-section).
					{ label: 'News', link: '/news', icon: 'newspaper' },
					{ label: 'Timeline to Public Review', link: '/about/timeline', icon: 'calendar-clock' },
					{ label: 'Events', link: '/events', icon: 'calendar' },
					// Every change to the site's pages, like a wiki's (site/COLLABORATION.md, "Recent changes"); it left the side column on Nov. 27, 2026.
					{ label: 'Recent Changes', link: '/changes', icon: 'history' }
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
