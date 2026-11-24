/**
 * Credits under each section of an essay (src/lib/essays/credits.ts;
 * docs/editing.md, "Credits"): who wrote and edited it from the saved
 * versions, kept in the bucket as each version's word blame, and the
 * credits added by hand (migrations/20261124T0114_add_essay_section_credits.sql).
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { answersFromSnapshot, creditIn, pageNameOf, type ProfileAnswers } from '../contributors.ts';
import { essaySections } from '../essays/sections.ts';
import { creditRoleLabels, standingHandCredits, type CreditRole, type HandCredit, type HistoryCredit, type SectionCredits } from '../essays/credits.ts';
import { parseEssay } from '../essays/document.ts';
import { splitFrontMatter } from '../essays/syntax.ts';
import { carryForward, expandOverlay, freshBlame, overlayKey, sectionHistories, writersAndEditors, type Blame, type OverlayRuns } from '../essays/word-blame.ts';
import { eventStatement } from './events.ts';
import { newIdentifier, now } from './identifiers.ts';
import { readVersionText } from './essays.ts';
import { inGroupsOf, placeholdersFor } from '#lib/server/database-groups.ts';

/** Changes when the way blame is worked out changes, so older files are worked out again. */
const blameFormat = 2;

/** Keep the blame of every this many versions along the way, so a long history is not walked again. */
const keepEvery = 20;

function blameKey(essay: string, number: number): string {
	return `essays/${essay}/blame/${blameFormat}/${number}.json`;
}

interface HistoryRow {
	number: number;
	object_key: string;
	sha256: string;
	person_identifier: string | null;
	created_at: string;
}

/**
 * Who is credited for a version no one is named on, such as text brought in
 * from git: the person who started the essay, or else the lead author.
 */
async function unnamedAuthor(database: D1Database, essay: string): Promise<string | null> {
	const row = await database
		.prepare(
			`SELECT COALESCE(
				(SELECT created_by FROM essays WHERE identifier = ?),
				(SELECT identifier FROM people WHERE role = 'lead-author' AND status != 'removed' ORDER BY added_at LIMIT 1)
			) AS person`
		)
		.bind(essay)
		.first<{ person: string | null }>();
	return row?.person ?? null;
}

/**
 * The word blame of a saved version and its text, worked out from the
 * newest blame kept in the bucket at or before it, or from the first
 * version, and kept for next time.
 */
export async function versionBlame(
	database: D1Database,
	bucket: R2Bucket,
	essay: string,
	number: number
): Promise<{ text: string; blame: Blame; rows: HistoryRow[] } | null> {
	const { results: rows } = await database
		.prepare(
			`SELECT number, object_key, sha256, person_identifier, created_at FROM essay_versions
			 WHERE essay_identifier = ? AND number <= ? ORDER BY number`
		)
		.bind(essay, number)
		.all<HistoryRow>();
	if (rows.length === 0 || rows.at(-1)!.number !== number) return null;
	const kept = new Set<number>();
	let cursor: string | undefined;
	do {
		const listing = await bucket.list({ prefix: `essays/${essay}/blame/${blameFormat}/`, cursor });
		for (const object of listing.objects) kept.add(Number(object.key.split('/').at(-1)!.replace('.json', '')));
		cursor = listing.truncated ? listing.cursor : undefined;
	} while (cursor);
	const fallback = await unnamedAuthor(database, essay);
	let start = rows.length - 1;
	while (start >= 0 && !kept.has(rows[start].number)) start -= 1;
	let current: { text: string; blame: Blame } | null = null;
	if (start >= 0) {
		const object = await bucket.get(blameKey(essay, rows[start].number));
		if (object) current = { text: await readVersionText(bucket, rows[start]), blame: (await object.json()) as Blame };
		else start = -1;
	}
	if (start === rows.length - 1 && current) return { ...current, rows };
	// Versions saved again with the same text, as by Restore, take that text's blame.
	const bySha = new Map<string, Blame>();
	for (let index = start + 1; index < rows.length; index += 1) {
		const row = rows[index];
		const text = await readVersionText(bucket, row);
		const overlayObject = await bucket.get(overlayKey(essay, row.number));
		const overlay = overlayObject ? expandOverlay((await overlayObject.json()) as OverlayRuns) : undefined;
		const label = { person: row.person_identifier ?? fallback, version: row.number };
		const earlier = bySha.get(row.sha256);
		const blame = earlier ?? (current ? carryForward(current, text, label, overlay) : freshBlame(text, label, overlay));
		bySha.set(row.sha256, blame);
		current = { text, blame };
		if (index === rows.length - 1 || row.number % keepEvery === 0) {
			await bucket.put(blameKey(essay, row.number), JSON.stringify(blame), { httpMetadata: { contentType: 'application/json' } }).catch(() => undefined);
		}
	}
	return current ? { ...current, rows } : null;
}

/** What the edit history says about each section of a saved version, with names and dates. */
export async function sectionCredits(database: D1Database, bucket: R2Bucket, essay: string, number: number): Promise<SectionCredits[]> {
	const found = await versionBlame(database, bucket, essay, number);
	if (!found) return [];
	const headings = essaySections(parseEssay(splitFrontMatter(found.text).body)).map(({ slug, title, level }) => ({ slug, title, level }));
	const histories = sectionHistories(found.text, found.blame, headings);
	const people = [...new Set(histories.flatMap((history) => history.parts.map((part) => part.person)))];
	const names = new Map<string, string>();
	for (const batch of inGroupsOf(people, 50)) {
		const { results } = await database
			.prepare(`SELECT identifier, display_name AS name FROM people WHERE identifier IN (${placeholdersFor(batch)})`)
			.bind(...batch)
			.all<{ identifier: string; name: string }>();
		for (const row of results) names.set(row.identifier, row.name);
	}
	const dates = new Map(found.rows.map((row) => [row.number, row.created_at]));
	const date = (version: number): string | null => (version ? (dates.get(version) ?? null) : null);
	return histories.map((history) => {
		const { wrote, edited } = writersAndEditors(history);
		const credit = (role: 'wrote' | 'edited') => (part: (typeof wrote)[number]): HistoryCredit => ({
			person: part.person,
			name: names.get(part.person) ?? 'Someone no longer listed',
			role,
			words: part.words,
			paragraphs: part.paragraphs,
			wordsFrom: date(part.wordsFrom),
			wordsTo: date(part.wordsTo),
			changedFrom: date(part.changedFrom),
			changedTo: date(part.changedTo)
		});
		return {
			slug: history.slug,
			title: history.title,
			level: history.level,
			total: history.total,
			history: [...wrote.map(credit('wrote')), ...edited.map(credit('edited'))]
		};
	});
}

/** The credits added by hand to an essay that stand now, oldest first. */
export async function handCredits(database: D1Database, essay: string): Promise<HandCredit[]> {
	const { results } = await database
		.prepare(
			`SELECT credits.identifier, section_slug AS sectionSlug, person_identifier AS person, person.display_name AS name, credits.role, action,
				changed_by AS addedBy, changer.display_name AS addedByName, credits.created_at AS addedAt
			 FROM essay_section_credits AS credits
			 JOIN people AS person ON person.identifier = credits.person_identifier
			 JOIN people AS changer ON changer.identifier = credits.changed_by
			 WHERE essay_identifier = ? ORDER BY credits.created_at, credits.rowid`
		)
		.bind(essay)
		.all<HandCredit & { action: 'add' | 'remove' }>();
	return standingHandCredits(results).map(({ action: _action, ...credit }) => credit);
}

/** Adds a credit by hand, or takes one away, with a line in the activity log. */
export async function changeHandCredit(
	database: D1Database,
	input: { essay: string; slug: string; title: string; person: string; role: CreditRole; action: 'add' | 'remove'; by: string }
): Promise<void> {
	const named = await database.prepare('SELECT display_name AS name FROM people WHERE identifier = ?').bind(input.person).first<{ name: string }>();
	if (!named) throw new Error('No one on the project has this id.');
	await database.batch([
		database
			.prepare(
				`INSERT INTO essay_section_credits (identifier, essay_identifier, section_slug, section_title, person_identifier, role, action, changed_by, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(newIdentifier(), input.essay, input.slug, input.title, input.person, input.role, input.action, input.by, now()),
		eventStatement(database, {
			personIdentifier: input.by,
			action:
				input.action === 'add'
					? `Credited ${named.name} with "${creditRoleLabels[input.role]}" under "${input.title}"`
					: `Took away the credit "${creditRoleLabels[input.role]}" for ${named.name} under "${input.title}"`,
			targetKind: 'document',
			targetIdentifier: `essay:${input.essay}`
		})
	]);
}

/** How readers see a person: the credit they chose to show on the website, and their contributor page if they have one. */
export interface ReaderName {
	name: string;
	link: string | null;
}

/**
 * The names readers may see, by person: only people whose last confirmed
 * profile asks to be credited on the website (Profile and credit), in the
 * form they chose. Advisors stay unnamed on the public site until the lead
 * author says otherwise.
 */
export async function readerNames(database: D1Database, people: string[]): Promise<Map<string, ReaderName>> {
	const names = new Map<string, ReaderName>();
	for (const batch of inGroupsOf(people, 50)) {
		const { results } = await database
			.prepare(
				`SELECT profiles.person_identifier AS person, profiles.status, profiles.public_slug AS slug, versions.snapshot
				 FROM contributor_profiles AS profiles
				 JOIN contributor_profile_versions AS versions
				   ON versions.profile_identifier = profiles.identifier AND versions.version = profiles.confirmed_version
				 JOIN people ON people.identifier = profiles.person_identifier
				 WHERE people.role != 'advisor' AND profiles.person_identifier IN (${placeholdersFor(batch)})`
			)
			.bind(...batch)
			.all<{ person: string; status: string; slug: string | null; snapshot: string }>();
		for (const row of results) {
			let answers: ProfileAnswers;
			try {
				answers = answersFromSnapshot(row.snapshot);
			} catch {
				continue;
			}
			const credit = creditIn(answers, 'website');
			if (!credit) continue;
			const page = row.status === 'welcomed' && row.slug && pageNameOf(answers) ? `/contributors/${row.slug}` : null;
			names.set(row.person, { name: credit.line, link: page });
		}
	}
	return names;
}
