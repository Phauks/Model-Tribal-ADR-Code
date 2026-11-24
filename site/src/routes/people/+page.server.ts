import { reviewSubjects } from 'virtual:review-subjects';
import { specialties, specialtyLabels, type CreditSection } from '#lib/contributors.ts';
import { peopleDirectory, type DirectoryEntry } from '#lib/server/contributor-pages.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { PageServerLoad } from './$types';

// Read from the database on each visit, so a person appears once their page is public.
export const prerender = false;

const contributionGroups: { section: CreditSection; heading: string; description: string }[] = [
	{ section: 'contributors', heading: 'Helped write', description: 'People who wrote or edited the code, the commentary or the essays.' },
	{ section: 'reviewers', heading: 'Reviewed', description: 'People who checked nation records, glossary terms, essays and provisions.' },
	{ section: 'acknowledgments', heading: 'Thanks', description: 'People who found sources, shared stories or helped in other ways.' }
];

/** Reviewed content readers can see: a nation record held back until the nation approves it does not count. */
const publicSubjects = new Set(reviewSubjects.filter((subject) => subject.page).map((subject) => `${subject.kind}:${subject.identifier}`));

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** What the person did, in a few words, such as "Helped write 2 essays · Reviewed 14 records". */
function workLine(entry: DirectoryEntry): string {
	const reviewed = entry.reviewed.filter((review) => review.kind === 'essay' || publicSubjects.has(`${review.kind}:${review.identifier}`)).length;
	return [
		entry.essayCount > 0 ? `Helped write ${plural(entry.essayCount, 'essay', 'essays')}` : '',
		reviewed > 0 ? `Reviewed ${plural(reviewed, 'page', 'pages')}` : ''
	]
		.filter(Boolean)
		.join(' · ');
}

/** Up to two letters for a person without a picture. */
function initialsOf(name: string): string {
	const words = name.split(/\s+/).filter(Boolean);
	const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
	return letters.map((word) => Array.from(word)[0] ?? '').join('').toLocaleUpperCase('en-US');
}

/**
 * The People page (docs/contributor-profiles.md, "The People page"): the
 * nonprofit's board first, then everyone else with a public contributor page,
 * grouped by contribution or by specialty.
 */
export const load: PageServerLoad = async ({ url, setHeaders }) => {
	const database = workerEnvironment().database;
	const entries = database ? await peopleDirectory(database) : [];
	const groupBy = url.searchParams.get('group') === 'specialty' ? 'specialty' : 'contribution';
	const card = (entry: DirectoryEntry) => ({
		name: entry.name,
		path: `/contributors/${entry.slug}`,
		initials: initialsOf(entry.name),
		picture: entry.pictureVersion ? `/contributors/${entry.slug}/picture?v=${encodeURIComponent(entry.pictureVersion)}` : null,
		work: workLine(entry),
		specialties: [...specialties.filter((value) => entry.specialties.includes(value)).map((value) => specialtyLabels[value]), ...entry.specialtyOthers]
	});
	const board = entries.filter((entry) => entry.boardMember).map((entry) => ({ ...card(entry), office: entry.boardOffice }));
	const others = entries.filter((entry) => !entry.boardMember);
	const groups =
		groupBy === 'contribution'
			? contributionGroups.map((group) => ({
					heading: group.heading,
					description: group.description,
					people: others.filter((entry) => entry.section === group.section).map(card)
				}))
			: [
					...specialties.map((specialty) => ({
						heading: specialtyLabels[specialty],
						description: '',
						people: others.filter((entry) => entry.specialties.includes(specialty)).map(card)
					})),
					{
						heading: 'Other specialties',
						description: 'In each person’s own words.',
						people: others.filter((entry) => entry.specialtyOthers.length > 0).map((entry) => ({ ...card(entry), work: entry.specialtyOthers.join(', ') }))
					},
					{
						heading: 'No specialty given',
						description: '',
						people: others.filter((entry) => entry.specialties.length === 0 && entry.specialtyOthers.length === 0).map(card)
					}
				];
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return {
		groupBy,
		board,
		count: others.length,
		groups: groups.filter((group) => group.people.length > 0)
	};
};
