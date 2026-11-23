import { json } from '@sveltejs/kit';
import { entityTypeLabels } from '#lib/nation-labels.ts';
import { imageMayBeShown, imagePath } from '#lib/official-images.ts';
import { nations } from '#lib/server/content.ts';
import { glossaryTermSummaries, publishedGlossary } from '#lib/server/glossary-entries.ts';
import { nationIndexRows } from '#lib/server/nation-index.ts';
import { recognitionBadges } from '#lib/recognition-badges.ts';
import { storySummaries } from '#lib/server/stories.ts';
import type { SearchEntry } from '#lib/site-search.ts';
import type { RequestHandler } from './$types';

// The site search's index (src/lib/site-search.ts), built with the site.
export const prerender = true;

/** The site's own pages a reader may look for by name. */
const pages: SearchEntry[] = [
	{ kind: 'page', title: 'Native nations', also: ['Nations', 'Tribes', 'Directory'], detail: 'Every nation and community, by first letter and by state', link: '/nations' },
	{ kind: 'page', title: 'Map of Native Nations', also: ['Map', 'Bureau of Indian Affairs Regions', 'Land Areas'], detail: 'Nations by State, Bureau of Indian Affairs Regions and Land Areas', link: '/nations/map' },
	{ kind: 'page', title: 'Stories', also: ['Traditional stories', 'Peacemaking stories', 'Accounts', 'Teachings'], detail: 'Stories about making peace, in the words of the nations and people who tell them', link: '/stories' },
	{ kind: 'page', title: 'Glossary', also: ['Terms', 'Definitions'], detail: 'Defined terms, and how to use them', link: '/glossary' },
	{ kind: 'page', title: 'Downloads', also: ['Book', 'PDF', 'EPUB', 'Data'], detail: 'The book and the data behind this site', link: '/downloads' },
	{ kind: 'page', title: 'Verify a file', also: ['Checksum', 'SHA-256', 'Hash', 'Check a download'], detail: 'Check that a file you downloaded is the one published here, on the Downloads page', link: '/downloads#checking' },
	{ kind: 'page', title: 'Events', also: ['Calendar', 'Talks', 'Workshops', 'Register', 'Continuing legal education'], detail: 'Talks, panels, workshops and gatherings, and how to register', link: '/events' },
	{ kind: 'page', title: 'About', also: ['About this work'], link: '/about' },
	{ kind: 'page', title: 'Sponsorship', also: ['Sponsor', 'Funding', 'Support', 'Donate'], detail: 'How organizations can help fund this work', link: '/sponsor' },
	{ kind: 'page', title: 'Timeline to public review', also: ['Timeline', 'Public review', 'Roadmap', 'Drafting committee', 'Where things stand'], detail: 'Where the model code stands and the steps to public review', link: '/about/timeline' },
	{ kind: 'page', title: 'Acknowledgments', also: ['Credits', 'Land acknowledgment', 'Southern Paiute', 'Nuwuvi'], detail: 'Credits, and the land where this work was written', link: '/acknowledgments' },
	{ kind: 'page', title: 'Changelog', also: ['Versions', 'What changed'], detail: 'What changed in each version', link: '/changelog' },
	{ kind: 'page', title: 'Make a request', also: ['Correct', 'Remove', 'Report a problem', 'Add a nation', 'Contribute'], detail: 'Correct, restrict, remove, add or contribute', link: '/requests' },
	{ kind: 'page', title: 'Help with this work', also: ['Join', 'Volunteer'], link: '/join' },
	{ kind: 'page', title: 'Project charter', also: ['Charter', 'CARE principles', 'Commitments'], detail: 'How knowledge is gathered, credited, published and protected here', link: '/charter' },
	{ kind: 'page', title: 'Licenses by material', also: ['License', 'Licenses', 'Copyright', 'CC0', 'CC BY'], detail: 'Which license covers each part of the site, the code and the book', link: '/licenses' },
	{ kind: 'page', title: 'Starred', also: ['Saved', 'Favorites', 'Bookmarks', 'Notes', 'Star', 'Shared collection'], detail: 'Pages you starred, with your own notes, kept on this device', link: '/starred' },
	{ kind: 'page', title: 'Read offline', also: ['Offline', 'Install'], detail: 'Save pages to read without a connection', link: '/offline' }
];

export const GET: RequestHandler = () => {
	const records = new Map(nations().map((record) => [record.id, record]));
	const nationEntries: SearchEntry[] = nationIndexRows().map((row) => {
		const record = records.get(row.id);
		const also = [
			...(row.listedName !== row.name ? [row.listedName] : []),
			...(record?.names.self_designation ?? []).map((name) => name.name),
			...(record?.names.former ?? []).map((name) => name.name)
		];
		const group = row.entityType === 'native-nation' ? undefined : entityTypeLabels[row.entityType];
		// The seal or logo, only where the nation's page may show it (docs/official-images.md).
		const showsImage = (record?.official_images ?? []).some(
			(image) => image.private_copy && imageMayBeShown(image)
		);
		const badges = recognitionBadges(record?.recognition ?? []);
		return {
			kind: 'nation',
			title: row.name,
			...(also.length > 0 ? { also } : {}),
			detail: [group, row.statesText].filter(Boolean).join(' · '),
			...(badges.length > 0 ? { badges } : {}),
			...(showsImage ? { image: imagePath(row.id) } : {}),
			link: `/nations/${row.id}`
		};
	});
	const aliases = new Map(publishedGlossary().map((record) => [record.id, record.aliases ?? []]));
	const termEntries: SearchEntry[] = glossaryTermSummaries().map((term) => {
		const also = [...(term.expansion ? [term.expansion] : []), ...(aliases.get(term.id) ?? [])];
		return {
			kind: 'term',
			title: term.term,
			...(also.length > 0 ? { also } : {}),
			detail: term.summary,
			link: term.page
		};
	});
	// A story is found by its title or its nations' names; its detail line is its kind and nations, never a summary (decision record 0019).
	const storyEntries: SearchEntry[] = storySummaries().map((story) => ({
		kind: 'story',
		title: story.title,
		detail: [story.kind, ...story.nations.map((nation) => nation.name)].join(' · '),
		link: `/stories/${story.id}`
	}));
	return json([...pages, ...nationEntries, ...storyEntries, ...termEntries]);
};
