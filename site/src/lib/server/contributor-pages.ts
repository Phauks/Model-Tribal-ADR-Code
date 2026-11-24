/**
 * Public contributor pages, /contributors/<slug> (docs/contributor-profiles.md,
 * "Contributor pages"). A page exists only for someone welcomed whose last
 * confirmed answers tick a name for the website. It shows only what is ticked
 * for the website: the names, nations, organization, pronouns, languages,
 * specialties, biography and picture (never a picture for someone under 18),
 * and the published work they helped with. Everything else in the profile
 * stays private.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	answersFromSnapshot,
	creditIn,
	pageNameOf,
	placementOf,
	pronounLabels,
	specialtiesShown,
	specialties,
	type CreditSection,
	type ProfileAnswers,
	type Specialty
} from '#lib/contributors.ts';
import { languageOf } from '#lib/languages.ts';
import { listEssays, essayPath } from './essays.ts';

export interface ContributorPageData {
	slug: string;
	name: string;
	section: CreditSection;
	/** Nations the person ticked for the website. */
	nations: { name: string; identifier: string | null }[];
	organization: string | null;
	pronouns: string | null;
	/** Languages ticked for the website, each with what the person does in it, such as "Navajo (speaks, reads)". */
	languages: string[];
	biography: string | null;
	/** Specialties the person chose to show, in their words for "Other". */
	specialties: string[];
	boardMember: boolean;
	boardOffice: string | null;
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
	board_member: number;
	board_office: string | null;
	picture_key: string | null;
	picture_updated_at: string | null;
	decided_at: string | null;
	snapshot: string;
}

async function pageRow(database: D1Database, slug: string): Promise<{ row: PageRow; answers: ProfileAnswers } | undefined> {
	const row = await database
		.prepare(
			`SELECT profiles.identifier, profiles.person_identifier, profiles.credit_section, profiles.age_group,
			        profiles.board_member, profiles.board_office, profiles.picture_key, profiles.picture_updated_at, profiles.decided_at, versions.snapshot
			 FROM contributor_profiles AS profiles
			 JOIN contributor_profile_versions AS versions
			   ON versions.profile_identifier = profiles.identifier AND versions.version = profiles.confirmed_version
			 WHERE profiles.public_slug = ? AND profiles.status = 'welcomed' AND profiles.credit_section IS NOT NULL`
		)
		.bind(slug)
		.first<PageRow>();
	if (!row) return undefined;
	const answers = answersFromSnapshot(row.snapshot);
	if (!pageNameOf(answers)) return undefined;
	return { row, answers };
}

/** Whether the picture may be shown: only when ticked for the website, and never for someone under 18, by the confirmed answers or the current ones. */
function pictureAllowed(row: PageRow, answers: ProfileAnswers): boolean {
	return Boolean(row.picture_key) && placementOf(answers, 'picture').website && row.age_group !== '13-to-17';
}

/** Specialties ticked for the website, in the person's words for their own. */
function specialtiesOnWebsite(answers: ProfileAnswers): string[] {
	return placementOf(answers, 'specialties').website ? specialtiesShown(answers) : [];
}

export async function contributorPage(database: D1Database, slug: string): Promise<ContributorPageData | undefined> {
	const found = await pageRow(database, slug);
	if (!found) return undefined;
	const { row, answers } = found;
	const credit = creditIn(answers, 'website');
	const nations = answers.nations.filter((nation) => nation.website).map((nation) => ({ name: nation.nationName, identifier: nation.nationIdentifier }));
	const pronouns = placementOf(answers, 'pronouns').website
		? answers.pronouns
				.filter((choice) => choice !== 'not-saying')
				.map((choice) => (choice === 'other' ? answers.pronounOther : pronounLabels[choice]))
				.filter(Boolean)
				.join(', ')
		: '';
	const languages = answers.languages
		.filter((language) => language.website)
		.map((language) => {
			const name = (language.code ? languageOf(language.code)?.name : null) ?? language.otherName ?? '';
			const skills = [language.speaks ? 'speaks' : '', language.reads ? 'reads' : '', language.writes ? 'writes' : ''].filter(Boolean).join(', ');
			return skills ? `${name} (${skills})` : name;
		})
		.filter(Boolean);

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
		organization: placementOf(answers, 'organization').website ? answers.organization : null,
		pronouns: pronouns || null,
		languages,
		biography: credit?.biography ?? null,
		specialties: specialtiesOnWebsite(answers),
		boardMember: Boolean(row.board_member),
		boardOffice: row.board_office,
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

export interface DirectoryEntry {
	slug: string;
	name: string;
	section: CreditSection;
	boardMember: boolean;
	boardOffice: string | null;
	specialties: Specialty[];
	/** Specialties in the person's own words. */
	specialtyOthers: string[];
	pictureVersion: string | null;
	/** Published essays the person helped write. */
	essayCount: number;
	/** Content the person reviewed, once each; published essays only, other kinds for the page to check. */
	reviewed: { kind: string; identifier: string }[];
}

/**
 * Everyone with a public contributor page, for the People page
 * (docs/contributor-profiles.md, "The People page"), each from their last
 * confirmed version, as on their own page.
 */
export async function peopleDirectory(database: D1Database): Promise<DirectoryEntry[]> {
	const rows = await database
		.prepare(
			`SELECT profiles.identifier, profiles.person_identifier, profiles.credit_section, profiles.age_group,
			        profiles.board_member, profiles.board_office, profiles.picture_key, profiles.picture_updated_at,
			        profiles.decided_at, profiles.public_slug AS slug, versions.snapshot
			 FROM contributor_profiles AS profiles
			 JOIN contributor_profile_versions AS versions
			   ON versions.profile_identifier = profiles.identifier AND versions.version = profiles.confirmed_version
			 WHERE profiles.public_slug IS NOT NULL AND profiles.status = 'welcomed' AND profiles.credit_section IS NOT NULL`
		)
		.all<PageRow & { slug: string }>();
	const [written, reviews, published] = await Promise.all([
		database
			.prepare(
				`SELECT versions.person_identifier AS person, COUNT(DISTINCT versions.essay_identifier) AS count
				 FROM essay_versions AS versions
				 JOIN essay_publications AS publications
				   ON publications.essay_identifier = versions.essay_identifier
				  AND publications.listed = 1
				  AND versions.number <= publications.version_number
				 WHERE versions.person_identifier IS NOT NULL
				 GROUP BY versions.person_identifier`
			)
			.all<{ person: string; count: number }>(),
		database
			.prepare('SELECT DISTINCT person_identifier AS person, subject_kind AS kind, subject_identifier AS identifier FROM reviews')
			.all<{ person: string; kind: string; identifier: string }>(),
		database.prepare('SELECT DISTINCT essay_identifier AS identifier FROM essay_publications WHERE listed = 1').all<{ identifier: string }>()
	]);
	const essayCounts = new Map(written.results.map((row) => [row.person, row.count]));
	const publishedEssays = new Set(published.results.map((row) => row.identifier));
	const entries: (DirectoryEntry & { sortKey: string })[] = [];
	for (const row of rows.results) {
		const answers = answersFromSnapshot(row.snapshot);
		const name = pageNameOf(answers);
		const showSpecialties = placementOf(answers, 'specialties').website;
		if (!name) continue;
		const person = row.person_identifier;
		entries.push({
			sortKey: creditIn(answers, 'website')?.sortKey ?? name.toLocaleLowerCase('en-US'),
			slug: row.slug,
			name,
			section: row.credit_section!,
			boardMember: Boolean(row.board_member),
			boardOffice: row.board_office,
			specialties: showSpecialties ? answers.specialties.filter((value) => (specialties as readonly string[]).includes(value)) : [],
			specialtyOthers: showSpecialties ? answers.specialtyOthers : [],
			pictureVersion: pictureAllowed(row, answers) ? (row.picture_updated_at ?? 'picture') : null,
			essayCount: person ? (essayCounts.get(person) ?? 0) : 0,
			reviewed: person
				? reviews.results
						.filter((review) => review.person === person && (review.kind !== 'essay' || publishedEssays.has(review.identifier)))
						.map(({ kind, identifier }) => ({ kind, identifier }))
				: []
		});
	}
	// Sorted as the credits are, by family name when there is one.
	return entries
		.sort((first, second) => first.sortKey.localeCompare(second.sortKey, 'en-US'))
		.map(({ sortKey: _sortKey, ...entry }) => entry);
}
