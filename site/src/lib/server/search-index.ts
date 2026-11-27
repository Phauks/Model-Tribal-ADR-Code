/**
 * Builds the site search's index, /search/index.json (src/lib/site-search.ts).
 * Trevor asked on Nov. 26, 2026 that search cover every kind of material on
 * the site, now and as new collections are added, and know the names people
 * use, such as "Marshall Trilogy" or "ICWA".
 *
 * Three parts make it:
 *
 * - The collections (src/lib/server/collections.ts). Each says which group
 *   of results lists it; nations, stories and glossary terms are built here
 *   from their own records, nations' laws come from /search/records.json,
 *   and every other collection gives one entry per item. A new collection is
 *   searchable once it has its registry entry.
 * - Pages that are not items of a collection: the site's own pages, federal
 *   offices, data topics, story methods, topics and events, and each
 *   collection's list. tests/search-coverage.test.ts fails when a page has
 *   no entry and no stated reason to be left out.
 * - Other names and sets (content/search/names.yaml), each with a published
 *   basis, added to the entries they name.
 *
 * Nations' choices about their own laws and court opinions are applied when
 * the file is served (src/lib/restricted-files.ts, filterSearchIndex).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { entityTypeLabels } from '../nation-labels.ts';
import { imageMayBeShown, imagePath } from '../official-images.ts';
import { recognitionBadges } from '../recognition-badges.ts';
import type { SearchEntry, SearchKind } from '../site-search.ts';
import { bureauRegions, healthAreas } from '../federal-offices.ts';
import { dataTopicLink, dataTopicList } from '../data-chart-list.ts';
import { eventLabels } from '../story-labels.ts';
import { collectionPath, collections, listedCollections, type CollectionItem } from './collections.ts';
import { nations, repositoryRoot, sources } from './content.ts';
import { savedCopyFor } from './markdown.ts';
import { copyPagePath } from '../public-copies.ts';
import { glossaryTermSummaries, publishedGlossary } from './glossary-entries.ts';
import { recordName, recordPageLink } from './law-records.ts';
import { nationIndexRows } from './nation-index.ts';
import { publishedStories, storySummaries, storyTags } from './stories.ts';

/** The site's own pages a reader may look for by name. */
export const sitePages: SearchEntry[] = [
	{ kind: 'page', title: 'Native nations', also: ['Nations', 'Tribes', 'Directory'], detail: 'Every nation and community, by first letter and by state', link: '/nations' },
	{ kind: 'page', title: 'Map of Native Nations', also: ['Map', 'Bureau of Indian Affairs Regions', 'Land Areas'], detail: 'Nations by State, Bureau of Indian Affairs Regions and Land Areas', link: '/nations/map' },
	{ kind: 'page', title: 'Coverage', also: ['None Identified', 'What we have found'], detail: 'What each nation page has found so far', link: '/nations/coverage' },
	{ kind: 'page', title: 'Timeline', also: ['History', 'Laws by year', 'Federal Indian policy'], detail: 'Laws, treaties, cases and opinions by year', link: '/nations/timeline' },
	{ kind: 'page', title: 'Find the law', also: ['Laws', 'Codes', 'Constitutions'], detail: 'A nation\'s laws, codes and court rules', link: '/nations/law' },
	{ kind: 'page', title: 'Find recourse', also: ['Recourse', 'Remedies', 'Dispute resolution', 'Peacemaking'], detail: 'Where a dispute can be heard, by nation and method', link: '/nations/recourse' },
	{ kind: 'page', title: 'Federal offices', also: ['Bureau of Indian Affairs', 'BIA', 'Indian Health Service', 'IHS', 'Agencies'], detail: 'Bureau of Indian Affairs regions and Indian Health Service areas', link: '/nations/federal-offices' },
	{ kind: 'page', title: 'Self-governance and federal programs', also: ['Self-governance', 'Self-determination', '638 contracts', 'Compacts', 'ISDEAA', '477 plans', 'Indian Housing Block Grants'], detail: 'Federal programs that nations run themselves, and who takes part', link: '/nations/federal-programs' },
	{ kind: 'page', title: 'Data and charts', also: ['Data', 'Charts', 'Statistics'], link: '/nations/data' },
	{ kind: 'page', title: 'Build a table', also: ['Table builder', 'Compare nations', 'Export'], link: '/nations/data/build' },
	{ kind: 'page', title: 'Stories', also: ['Traditional stories', 'Peacemaking stories', 'Treaty stories', 'Accounts', 'Teachings'], detail: 'Stories about law, justice and governance, in the words of the nations and people who tell them', link: '/stories' },
	{ kind: 'page', title: 'Glossary', also: ['Terms', 'Definitions'], detail: 'Defined terms, and how to use them', link: '/glossary' },
	{ kind: 'page', title: 'Federal law', also: ['Federal Indian law', 'Treaties', 'Statutes', 'Regulations', 'Executive orders'], detail: 'Treaties, statutes, the U.S. Code, executive orders, regulations and agency records', link: '/laws' },
	{ kind: 'page', title: 'Courts and cases', also: ['Cases', 'Court opinions', 'Case law'], detail: 'Supreme Court cases, tribal, state and other courts\' opinions, and the courts', link: '/cases' },
	{ kind: 'page', title: 'Title 25. Indians', also: ['U.S. Code, Title 25', 'United States Code', '25 U.S.C.', 'Federal Indian law statutes'], detail: 'Title 25 of the United States Code, by chapter, subchapter and section', link: '/laws/usc-25' },
	{ kind: 'page', title: 'Library', also: ['Sources', 'Research'], link: '/library' },
	{ kind: 'page', title: 'Writing', also: ['Essays', 'Foundations', 'Model code', 'Peacemaking code'], detail: 'Foundations, essays, methods and stories, and the codes being written', link: '/writing' },
	{ kind: 'page', title: 'Source documents', also: ['Copies', 'Documents', 'Primary sources'], link: '/copies' },
	{ kind: 'page', title: 'Supreme Court', also: ['U.S. Supreme Court', 'Supreme Court cases', 'Justices', 'Courts'], link: '/supreme-court' },
	{ kind: 'page', title: 'Supreme Court timeline', also: ['Timeline of cases', 'All Supreme Court cases', 'How the Justices voted', 'Votes'], detail: 'Every Supreme Court case on this site, oldest first, with how each Justice voted', link: '/supreme-court/timeline' },
	{ kind: 'page', title: 'Courts', also: ['Tribal courts', 'Court directory'], link: '/courts' },
	{ kind: 'page', title: 'People', also: ['Justices', 'Presidents', 'Biographies'], link: '/people' },
	{ kind: 'page', title: 'Biographies', also: ['Native leaders', 'Signers', 'People'], link: '/biographies' },
	{ kind: 'page', title: 'Forms', also: ['Templates', 'Fill-in forms', 'Self-help'], link: '/forms' },
	{ kind: 'page', title: 'Statistics', also: ['Stats', 'Counts', 'How many'], detail: 'How many of each kind of material the site holds', link: '/stats' },
	{ kind: 'page', title: 'Foundations', link: '/foundations' },
	{ kind: 'page', title: 'Essays', also: ['Legal history', 'Chapters'], link: '/essays' },
	{ kind: 'page', title: 'Back matter', also: ['Cases by topic'], link: '/back-matter' },
	{ kind: 'page', title: 'Contributors', also: ['Authors', 'Credits'], link: '/contributors' },
	{ kind: 'page', title: 'Data sets', also: ['Downloads', 'Book', 'PDF', 'EPUB', 'Data'], detail: 'The book and the data behind this site', link: '/downloads' },
	{ kind: 'page', title: 'Order a printed copy', also: ['Book', 'Print', 'Buy'], link: '/book' },
	{ kind: 'page', title: 'Store', also: ['Shop', 'Buy'], link: '/store' },
	{ kind: 'page', title: 'Verify a file', also: ['Checksum', 'SHA-256', 'Hash', 'Check a download'], detail: 'Check that a file you downloaded is the one published here', link: '/verify' },
	{ kind: 'page', title: 'Events', also: ['Calendar', 'Talks', 'Workshops', 'Register', 'Continuing legal education'], detail: 'Talks, panels, workshops and gatherings, and how to register', link: '/events' },
	{ kind: 'page', title: 'About', also: ['About this work'], link: '/about' },
	{ kind: 'page', title: 'Sponsorship', also: ['Sponsor', 'Funding', 'Support', 'Donate'], detail: 'How organizations can help fund this work', link: '/sponsor' },
	{ kind: 'page', title: 'Sponsorship levels', also: ['Sponsor levels', 'Monthly gift', 'Yearly gift'], link: '/sponsor/levels' },
	{ kind: 'page', title: 'Using AI with Tribal Law', also: ['AI', 'Artificial intelligence', 'ChatGPT', 'Chatbot'], detail: 'How to use AI tools safely when learning about a nation\'s law', link: '/using-ai' },
	{ kind: 'page', title: 'Timeline to public review', also: ['Public review', 'Roadmap', 'Drafting committee', 'Where things stand'], detail: 'Where the model code stands and the steps to public review', link: '/about/timeline' },
	{ kind: 'page', title: 'Source Watch', also: ['Source watch', 'New documents', 'Federal Register'], detail: 'How new and changed public legal documents are found, and how to ask it to stop', link: '/about/watch' },
	{ kind: 'page', title: 'Acknowledgments', also: ['Credits', 'Land acknowledgment', 'Southern Paiute', 'Nuwuvi'], detail: 'Credits, and the land where this work was written', link: '/acknowledgments' },
	{ kind: 'page', title: 'Changelog', also: ['Versions', 'What changed'], detail: 'What changed in each version', link: '/changelog' },
	{ kind: 'page', title: 'Recent changes', also: ['Changes', 'Edits', 'Page history'], link: '/changes' },
	{ kind: 'page', title: 'Make a request', also: ['Correct', 'Remove', 'Request a Change', 'Add a nation', 'Contribute'], detail: 'Correct, restrict, remove, add or contribute', link: '/requests' },
	{ kind: 'page', title: 'Help with this work', also: ['Join', 'Volunteer'], link: '/join' },
	{ kind: 'page', title: 'Project charter', also: ['Charter', 'CARE principles', 'Commitments'], detail: 'How knowledge is gathered, credited, published and protected here', link: '/charter' },
	{ kind: 'page', title: 'Licenses by material', also: ['License', 'Licenses', 'Copyright', 'CC0', 'CC BY'], detail: 'Which license covers each part of the site, the code and the book', link: '/licenses' },
	{ kind: 'page', title: 'Starred', also: ['Saved', 'Favorites', 'Bookmarks', 'Notes', 'Star', 'Shared collection'], detail: 'Pages you starred, with your own notes, kept on this device', link: '/starred' },
	{ kind: 'page', title: 'Following', also: ['Follow', 'Updates', 'Email updates'], link: '/following' },
	{ kind: 'page', title: 'Read offline', also: ['Offline', 'Install'], detail: 'Save pages to read without a connection', link: '/offline' }
];

/** A nation and every name its record gives: the federal list's, its own names, other current names and former ones. */
function nationEntries(): SearchEntry[] {
	const records = new Map(nations().map((record) => [record.id, record]));
	return nationIndexRows().map((row) => {
		const record = records.get(row.id);
		const names = record?.names;
		const also = [
			...(row.listedName !== row.name ? [row.listedName] : []),
			...(names && names.official !== row.name && names.official !== row.listedName ? [names.official] : []),
			...(names?.self_designation ?? []).flatMap((name) => [name.name, ...(name.romanized ? [name.romanized] : [])]),
			...(names?.alternate ?? []).map((name) => name.name),
			...(names?.former ?? []).map((name) => name.name)
		];
		const group = row.entityType === 'native-nation' ? undefined : entityTypeLabels[row.entityType];
		// The seal or logo, only where the nation's page may show it (docs/official-images.md).
		const showsImage = (record?.official_images ?? []).some((image) => image.private_copy && imageMayBeShown(image));
		const badges = recognitionBadges(record?.recognition ?? []);
		const unique = [...new Set(also)].filter((name) => name !== row.name);
		return {
			kind: 'nation',
			title: row.name,
			...(unique.length > 0 ? { also: unique } : {}),
			detail: [group, row.statesText].filter(Boolean).join(' · '),
			...(badges.length > 0 ? { badges } : {}),
			...(showsImage ? { image: imagePath(row.id) } : {}),
			link: `/nations/${row.id}`
		};
	});
}

function termEntries(): SearchEntry[] {
	const aliases = new Map(publishedGlossary().map((record) => [record.id, record.aliases ?? []]));
	return glossaryTermSummaries().map((term) => {
		const also = [...(term.expansion ? [term.expansion] : []), ...(aliases.get(term.id) ?? [])];
		return { kind: 'term', title: term.term, ...(also.length > 0 ? { also } : {}), detail: term.summary, link: term.page };
	});
}

/** A story is found by its title or its nations' names; its detail line is its kind and nations, never a summary (decision record 0019). */
function storyEntries(): SearchEntry[] {
	const stories: SearchEntry[] = storySummaries().map((story) => ({
		kind: 'story',
		title: story.title,
		detail: [story.kind, ...story.nations.map((nation) => nation.name)].join(' · '),
		link: `/stories/${story.id}`
	}));
	const tags: SearchEntry[] = (['methods', 'topics'] as const).flatMap((kind) =>
		storyTags(kind).map((tag) => ({ kind: 'story' as const, title: tag.name, detail: kind === 'methods' ? 'Method' : 'Topic', link: `/stories/${kind}/${tag.id}` }))
	);
	const events = [...new Set(publishedStories().flatMap((record) => (record.affected_by ?? []).map((entry) => entry.event).filter((event): event is string => Boolean(event))))];
	const eventEntries: SearchEntry[] = events
		.filter((event) => eventLabels[event])
		.map((event) => ({ kind: 'story', title: eventLabels[event], detail: 'Event', link: `/stories/events/${event}` }));
	return [...stories, ...tags, ...eventEntries];
}

/** Where a collection's item is found: its record's own page when it has one, else the item's link. */
export function itemLink(item: CollectionItem): string | undefined {
	return recordPageLink(item.key) ?? item.href;
}

/**
 * One entry per item of every collection searched straight from the index
 * (src/lib/server/collections.ts), and every link search reaches through
 * them: each entry's own, and the copy a law or case page shows, which the
 * page's entry finds.
 */
export function collectionSearch(): { entries: SearchEntry[]; reached: Set<string> } {
	const entries: SearchEntry[] = [];
	// Later collections repeat earlier ones (every copy is a source document), so an item is listed once, under the first that has it.
	// Nations' laws known from source records are listed with the other laws and governing documents (search-records.ts).
	const seen = new Set(collections.filter((collection) => collection.search.group === 'document' && collection.sourceKinds).flatMap((collection) => collection.items().map((item) => item.href ?? '')));
	for (const collection of collections) {
		const group = collection.search.group;
		if (group === 'nation' || group === 'document' || group === 'story' || group === 'term') continue;
		for (const item of collection.items()) {
			const link = itemLink(item);
			// A copy known only by its file's name has nothing a reader would type.
			if (!link || seen.has(link) || item.title === item.href?.replace(/^\/copies\/view\//, '')) continue;
			seen.add(link);
			// The copy a law or case page shows is found through that page.
			if (item.href) seen.add(item.href);
			const copy = item.key ? savedCopyFor(sources().get(item.key)) : undefined;
			if (copy) seen.add(copyPagePath(copy));
			// A law by the name it is known by, such as "General Allotment Act (1887)", and also by its full title.
			const title = item.key && link !== item.href ? recordName(item.key).name : item.title;
			const detail = [collection.search.label, item.detail ?? item.year].filter(Boolean).join(' · ');
			entries.push({ kind: group as SearchKind, title, ...(title !== item.title ? { also: [item.title] } : {}), ...(detail ? { detail } : {}), link });
		}
	}
	return { entries, reached: seen };
}

/** Pages about one thing that no collection lists: federal offices, data topics, and each collection's list. */
function otherPages(): SearchEntry[] {
	return [
		...bureauRegions.map((office) => ({
			kind: 'reference' as const,
			title: `Bureau of Indian Affairs, ${office.name} Region`,
			// The agency's own short name (bia.gov).
			also: [`BIA ${office.name} Region`],
			detail: 'Federal office',
			link: `/nations/federal-offices/bureau-of-indian-affairs/${office.key}`
		})),
		...healthAreas.map((office) => ({
			kind: 'reference' as const,
			title: `Indian Health Service, ${office.name} Area`,
			// The agency's own short name (ihs.gov).
			also: [`IHS ${office.name} Area`],
			detail: 'Federal office',
			link: `/nations/federal-offices/indian-health-service/${office.key}`
		})),
		...dataTopicList.map((topic) => ({ kind: 'reference' as const, title: topic.title, detail: 'Data and charts', link: dataTopicLink(topic.identifier) })),
		...listedCollections().map((collection) => ({ kind: 'reference' as const, title: collection.title, detail: 'Statistics', link: collectionPath(collection.identifier) }))
	];
}

// ----- Other names and sets (content/search/names.yaml) -----

interface NameBasis {
	source?: string;
	citation: string;
	link: string;
	words: string;
}

export interface SearchNamesFile {
	checked: string;
	names: { names: string[]; item: string; basis: NameBasis }[];
	groups: { names: string[]; items: string[]; basis: NameBasis }[];
}

export function searchNamesFile(): SearchNamesFile {
	return parse(readFileSync(path.join(repositoryRoot, 'content/search/names.yaml'), 'utf8')) as SearchNamesFile;
}

/** Where a name's item is on this site: a source record's page, or the path given. */
export function namedItemLink(item: string): string | undefined {
	return item.startsWith('/') ? item : recordPageLink(item);
}

/** The entries with the other names and sets they belong to added; a name for something the index has no entry for is left out. */
export function withSearchNames(entries: SearchEntry[], file: SearchNamesFile = searchNamesFile()): SearchEntry[] {
	const also = new Map<string, string[]>();
	const groups = new Map<string, string[][]>();
	for (const name of file.names) {
		const link = namedItemLink(name.item);
		if (link) also.set(link, [...(also.get(link) ?? []), ...name.names]);
	}
	for (const group of file.groups) {
		for (const item of group.items) {
			const link = namedItemLink(item);
			if (link) groups.set(link, [...(groups.get(link) ?? []), group.names]);
		}
	}
	return entries.map((entry) => {
		const names = also.get(entry.link);
		const sets = groups.get(entry.link);
		if (!names && !sets) return entry;
		return {
			...entry,
			...(names ? { also: [...new Set([...(entry.also ?? []), ...names])] } : {}),
			...(sets ? { groups: sets } : {})
		};
	});
}

/** The whole index, in the order results are listed within each kind. */
export function searchIndex(): SearchEntry[] {
	return withSearchNames([...sitePages, ...nationEntries(), ...storyEntries(), ...termEntries(), ...collectionSearch().entries, ...otherPages()]);
}
