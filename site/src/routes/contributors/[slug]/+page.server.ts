import { error } from '@sveltejs/kit';
import { reviewSubjects } from 'virtual:review-subjects';
import { printedSectionHeadings } from '#lib/credits-export.ts';
import { contributorPage } from '#lib/server/contributor-pages.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { PageServerLoad } from './$types';

// Read from the database on each visit, so the page follows the person's latest confirmed credit.
export const prerender = false;

const kindLabels: Record<string, string> = {
	nation: 'Native nations',
	'glossary-term': 'Glossary terms',
	provision: 'Provisions'
};

/**
 * A contributor's public page (docs/contributor-profiles.md, "Contributor
 * pages"). Reviewed content is named only when readers can see it: a nation
 * record held back until the nation approves it is left out.
 */
export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const database = workerEnvironment().database;
	const page = database ? await contributorPage(database, params.slug) : undefined;
	if (!page) error(404, 'There is no contributor page at this address.');
	const subjects = new Map(reviewSubjects.map((subject) => [`${subject.kind}:${subject.identifier}`, subject]));
	const nationPages = new Map(
		reviewSubjects.filter((subject) => subject.kind === 'nation').map((subject) => [subject.identifier, subject.page])
	);
	const reviewedGroups = Object.entries(kindLabels)
		.map(([kind, heading]) => ({
			heading,
			items: page.reviewed
				.filter((review) => review.kind === kind)
				.map((review) => subjects.get(`${review.kind}:${review.identifier}`))
				.filter((subject) => subject?.page)
				.map((subject) => ({ title: subject!.title, path: subject!.page! }))
				.sort((first, second) => first.title.localeCompare(second.title, 'en-US'))
		}))
		.filter((group) => group.items.length > 0);
	if (page.reviewedEssays.length > 0) reviewedGroups.unshift({ heading: 'Essays', items: page.reviewedEssays });
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return {
		name: page.name,
		sectionHeading: printedSectionHeadings[page.section],
		nations: page.nations.map((nation) => ({
			name: nation.name,
			path: nation.identifier ? (nationPages.get(nation.identifier) ?? null) : null
		})),
		biography: page.biography,
		picture: page.pictureVersion ? `/contributors/${page.slug}/picture?v=${encodeURIComponent(page.pictureVersion)}` : null,
		since: page.since,
		essays: page.essays,
		reviewedGroups
	};
};
