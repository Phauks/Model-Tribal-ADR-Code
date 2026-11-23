/**
 * Public contributor pages, /contributors/<slug> (docs/contributor-profiles.md,
 * "Contributor pages"). A page exists only for someone welcomed whose last
 * confirmed credit is shown on the website by their name or a name they
 * chose. It shows only what that credit allows: the name, the nations they
 * chose to show with it, the biography if they chose to print it, the
 * picture (never for someone under 18), and the published work they helped
 * with. Everything else in the profile stays private.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { creditOf, pageNameOf, type CreditSection, type ProfileAnswers } from '#lib/contributors.ts';
import { listEssays, essayPath } from './essays.ts';

export interface ContributorPageData {
	slug: string;
	name: string;
	section: CreditSection;
	/** Nations the person chose to show with their name. */
	nations: { name: string; identifier: string | null }[];
	biography: string | null;
	/** Changes when the picture changes, so the picture's address does too; null when there is none to show. */
	pictureVersion: string | null;
	/** Month and year the person was welcomed. */
	since: string | null;
	/** Published essays with a version the person saved. */
	essays: { title: string; path: string }[];
	/** Published essays the person reviewed. */
	reviewedEssays: { title: string; path: string }[];
	/** Other content the person reviewed (nations, glossary terms, provisions), once each; the page adds titles and links. */
	reviewed: { kind: string; identifier: string }[];
}

interface PageRow {
	identifier: string;
	person_identifier: string | null;
	credit_section: CreditSection | null;
	age_group: string | null;
	picture_key: string | null;
	picture_updated_at: string | null;
	decided_at: string | null;
	snapshot: string;
}

async function pageRow(database: D1Database, slug: string): Promise<{ row: PageRow; answers: ProfileAnswers } | undefined> {
	const row = await database
		.prepare(
			`SELECT profiles.identifier, profiles.person_identifier, profiles.credit_section, profiles.age_group,
			        profiles.picture_key, profiles.picture_updated_at, profiles.decided_at, versions.snapshot
			 FROM contributor_profiles AS profiles
			 JOIN contributor_profile_versions AS versions
			   ON versions.profile_identifier = profiles.identifier AND versions.version = profiles.confirmed_version
			 WHERE profiles.public_slug = ? AND profiles.status = 'welcomed' AND profiles.credit_section IS NOT NULL`
		)
		.bind(slug)
		.first<PageRow>();
	if (!row) return undefined;
	const answers = JSON.parse(row.snapshot) as ProfileAnswers;
	if (!pageNameOf(answers)) return undefined;
	return { row, answers };
}

/** Whether the picture may be shown: never for someone under 18, by the confirmed answers or the current ones. */
function pictureAllowed(row: PageRow, answers: ProfileAnswers): boolean {
	return Boolean(row.picture_key) && answers.ageGroup === '18-or-older' && row.age_group !== '13-to-17';
}

export async function contributorPage(database: D1Database, slug: string): Promise<ContributorPageData | undefined> {
	const found = await pageRow(database, slug);
	if (!found) return undefined;
	const { row, answers } = found;
	const credit = creditOf(answers);
	const nations =
		answers.creditForm === 'name-and-nation'
			? answers.nations
					.filter((nation) => nation.showInCredit)
					.map((nation) => ({ name: nation.nationName, identifier: nation.nationIdentifier }))
			: [];

	let essays: ContributorPageData['essays'] = [];
	let reviewedEssays: ContributorPageData['reviewedEssays'] = [];
	let reviewed: ContributorPageData['reviewed'] = [];
	if (row.person_identifier) {
		// An essay counts when the person saved a version at or before one readers can see.
		const helped = await database
			.prepare(
				`SELECT DISTINCT versions.essay_identifier AS identifier
				 FROM essay_versions AS versions
				 JOIN essay_publications AS publications
				   ON publications.essay_identifier = versions.essay_identifier
				  AND publications.listed = 1
				  AND versions.number <= publications.version_number
				 WHERE versions.person_identifier = ?`
			)
			.bind(row.person_identifier)
			.all<{ identifier: string }>();
		const reviews = await database
			.prepare(
				`SELECT DISTINCT subject_kind AS kind, subject_identifier AS identifier
				 FROM reviews WHERE person_identifier = ? ORDER BY subject_kind, subject_identifier`
			)
			.bind(row.person_identifier)
			.all<{ kind: string; identifier: string }>();
		const wrote = new Set(helped.results.map((essay) => essay.identifier));
		const reviewedEssayIdentifiers = new Set(reviews.results.filter((review) => review.kind === 'essay').map((review) => review.identifier));
		reviewed = reviews.results.filter((review) => review.kind !== 'essay');
		if (wrote.size > 0 || reviewedEssayIdentifiers.size > 0) {
			// Only published essays are named, by the title readers see.
			const published = (await listEssays(database))
				.filter((essay) => essay.published)
				.map((essay) => ({ identifier: essay.identifier, title: essay.published!.title, path: essayPath(essay.identifier, essay.part) }));
			essays = published.filter((essay) => wrote.has(essay.identifier)).map(({ title, path }) => ({ title, path }));
			reviewedEssays = published
				.filter((essay) => reviewedEssayIdentifiers.has(essay.identifier) && !wrote.has(essay.identifier))
				.map(({ title, path }) => ({ title, path }));
		}
	}

	return {
		slug,
		name: pageNameOf(answers)!,
		section: row.credit_section!,
		nations,
		biography: credit?.biography ?? null,
		pictureVersion: pictureAllowed(row, answers) ? (row.picture_updated_at ?? 'picture') : null,
		since: row.decided_at ? new Date(row.decided_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null,
		essays,
		reviewedEssays,
		reviewed
	};
}

/** The key of the picture shown on a contributor's page, or undefined when there is none to show. */
export async function contributorPictureKey(database: D1Database, slug: string): Promise<string | undefined> {
	const found = await pageRow(database, slug);
	if (!found || !pictureAllowed(found.row, found.answers)) return undefined;
	return found.row.picture_key ?? undefined;
}
