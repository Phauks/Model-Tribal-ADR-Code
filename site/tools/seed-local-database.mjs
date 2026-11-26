#!/usr/bin/env node
/**
 * Fills the LOCAL copy of the database, the one `npm run preview` and
 * `wrangler dev` use, with a few made-up people and records, so the
 * workspace, account, events, uploads and requests pages have something to
 * show on this computer (README.md, "First run"). Run from site/:
 *
 *   npm run database:seed:local            apply the migrations, then add the fixtures
 *   npm run database:seed:local -- --code  print the fixture accounts' two-step code now
 *
 * It only ever passes --local to Wrangler, so it cannot reach the live
 * database. Every address is at example.org and every name says "Fixture".
 * Running it again changes nothing that is already there, except that the
 * fixture accounts get the fixture password and authenticator back and the
 * fixture event moves back to two weeks from now.
 *
 * The fixture accounts share one password and one authenticator secret,
 * below. Both are for this local copy only and protect nothing.
 * tools/check-accessibility-live.mjs signs in as these accounts.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { authenticatorCode, authenticatorLink, sealSecret, stepAt } from '#lib/server/two-step.ts';
import { passwordHash, passwordIterations } from '#lib/server/sign-in-secrets.ts';

/** The binding and bucket names in wrangler.jsonc. */
const databaseBinding = 'database';
const bucketName = 'tribal-law-project-files';

export const fixturePassword = 'local fixture password';
// Base32, 160 bits, as the site makes them (src/lib/server/two-step.ts).
export const fixtureAuthenticatorSecret = 'FIXTUREFIXTUREFIXTUREFIXTURE2345';
export const fixtureNation = 'hannahville-indian-community';
export const fixtureEssay = 'fixture-draft-essay';
export const fixtureEvent = 'fixture-online-talk';
export const fixtureRequestReference = '20261124-F1XTRE';
export const fixtureUploadReferences = ['U-20261124-F1XTRE', 'U-20261124-F1XTR2'];

/**
 * The fixture accounts. Roles that need two-step sign-in (src/lib/permissions.ts,
 * rolesNeedingTwoStep) have the shared authenticator secret already set up.
 */
export const fixtureAccounts = {
	leadAuthor: { email: 'lead-author@example.org', name: 'Fixture Lead Author', role: 'lead-author', twoStep: true },
	editor: { email: 'editor@example.org', name: 'Fixture Editor', role: 'editor', twoStep: true },
	coAuthor: { email: 'co-author@example.org', name: 'Fixture Co-Author', role: 'co-author', twoStep: false },
	nationReviewer: { email: 'nation-reviewer@example.org', name: 'Fixture Nation Reviewer', role: 'nation-reviewer', twoStep: true },
	contributor: { email: 'contributor@example.org', name: 'Fixture Contributor', role: 'contributor', twoStep: false },
	// Signed up on the site, with no workspace access: a reader.
	reader: { email: 'reader@example.org', name: 'Fixture Reader', role: null, twoStep: false }
};

/** @typedef {keyof typeof fixtureAccounts} FixtureAccount */

/** @param {FixtureAccount} key */
const accountIdentifier = (key) => `fixture-account-${key}`;
/** @param {FixtureAccount} key */
const personIdentifier = (key) => `fixture-person-${key}`;

/**
 * A value written into SQL: text in single quotes, with quotes doubled.
 * @param {string | number | null | undefined} value
 */
function literal(value) {
	if (value === null || value === undefined) return 'NULL';
	if (typeof value === 'number') return String(value);
	return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * @param {string} table
 * @param {Record<string, string | number | null | undefined>} row
 */
function insert(table, row, conflict = 'ON CONFLICT DO NOTHING') {
	const columns = Object.keys(row);
	return `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((column) => literal(row[column])).join(', ')}) ${conflict};`;
}

/**
 * Runs Wrangler on the local copy. --local is always given; there is no way to ask for --remote here.
 * @param {string[]} argumentsList
 */
function wrangler(argumentsList, { quiet = false } = {}) {
	return execFileSync('npx', ['wrangler', ...argumentsList, '--local'], {
		encoding: 'utf8',
		stdio: ['ignore', quiet ? 'pipe' : 'inherit', 'inherit'],
		env: { ...process.env, CI: process.env.CI ?? '1' }
	});
}

/**
 * Runs SQL statements on the local copy of the database.
 * @param {string[]} statements
 */
export function executeLocally(statements) {
	const folder = mkdtempSync(path.join(tmpdir(), 'seed-local-database-'));
	try {
		const file = path.join(folder, 'statements.sql');
		writeFileSync(file, statements.join('\n'));
		wrangler(['d1', 'execute', databaseBinding, '--file', file], { quiet: true });
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

/** Applies the migrations to the local copy, as `npm run database:migrate:local` does. */
export function migrateLocally() {
	wrangler(['d1', 'migrations', 'apply', databaseBinding], { quiet: true });
}

/**
 * Puts a file in the local copy of the private bucket.
 * @param {string} key
 * @param {string} text
 * @param {string} contentType
 */
function putLocally(key, text, contentType) {
	const folder = mkdtempSync(path.join(tmpdir(), 'seed-local-bucket-'));
	try {
		const file = path.join(folder, 'object');
		writeFileSync(file, text);
		wrangler(['r2', 'object', 'put', `${bucketName}/${key}`, '--file', file, '--content-type', contentType], { quiet: true });
	} finally {
		rmSync(folder, { recursive: true, force: true });
	}
}

/** @param {string} text */
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/**
 * Statements that start a signed-in session for each named fixture account,
 * with the second step done, and the tokens to put in the session cookie
 * (__Host-session, src/lib/server/accounts.ts).
 * @param {FixtureAccount[]} keys
 */
export function fixtureSessions(keys, hours = 2) {
	const started = new Date();
	const expires = new Date(started.getTime() + hours * 60 * 60 * 1000);
	/** @type {Partial<Record<FixtureAccount, string>>} */
	const tokens = {};
	const statements = keys.map((key) => {
		const token = randomBytes(32).toString('base64url');
		tokens[key] = token;
		return insert('sessions', {
			token_hash: sha256(token),
			account_identifier: accountIdentifier(key),
			created_at: started.toISOString(),
			last_seen_at: started.toISOString(),
			expires_at: expires.toISOString(),
			method: 'password',
			device: 'Local check',
			second_step: fixtureAccounts[key].twoStep ? 'done' : 'none',
			lasting: 0
		});
	});
	return { statements, tokens };
}

/** The six-digit code the fixture accounts' authenticator shows now. */
export function currentCode() {
	return authenticatorCode(fixtureAuthenticatorSecret, stepAt(Date.now()));
}

const essayText = `---
title: Fixture Draft Essay
---

# Fixture Draft Essay

This draft exists only in a local copy of the database. It was written by tools/seed-local-database.mjs so the essay pages in the workspace have something to show.

## A section

A second paragraph, with *emphasis* and a [link to the charter](/charter).
`;

export async function fixtureStatements() {
	const time = new Date();
	/** @param {number} days */
	const at = (days) => new Date(time.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
	const added = at(-30);
	const statements = [];
	const lead = personIdentifier('leadAuthor');
	// Kept as the site keeps it while PASSWORD_KEY is not set, as on a local copy.
	const storedSecret = await sealSecret(fixtureAuthenticatorSecret, undefined);

	for (const key of /** @type {FixtureAccount[]} */ (Object.keys(fixtureAccounts))) {
		const account = fixtureAccounts[key];
		const salt = randomBytes(16).toString('base64url');
		statements.push(
			insert('accounts', {
				identifier: accountIdentifier(key),
				email: account.email,
				email_verified_at: added,
				password_hash: await passwordHash(fixturePassword, salt, passwordIterations),
				password_salt: salt,
				password_iterations: passwordIterations,
				password_changed_at: added,
				password_keyed: 0,
				created_at: added,
				authenticator_secret: account.twoStep ? storedSecret : null,
				authenticator_added_at: account.twoStep ? added : null
			},
			// Seeding again puts back the fixture password and authenticator.
			`ON CONFLICT (identifier) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt,
				password_iterations = excluded.password_iterations, password_keyed = 0, authenticator_secret = excluded.authenticator_secret,
				authenticator_new_secret = NULL, authenticator_last_step = NULL`)
		);
		if (account.role) {
			statements.push(
				insert('people', {
					identifier: personIdentifier(key),
					sign_in_subject: accountIdentifier(key),
					email: account.email,
					display_name: account.name,
					role: account.role,
					nation_identifier: account.role === 'nation-reviewer' ? fixtureNation : null,
					status: 'active',
					// The lead author is added first, so every other row can name them.
					added_by: key === 'leadAuthor' ? null : lead,
					added_at: added,
					last_signed_in_at: added
				})
			);
		}
	}

	// The reader started registering as a contributor.
	statements.push(
		insert('contributor_profiles', {
			identifier: 'fixture-profile-reader',
			sign_in_subject: accountIdentifier('reader'),
			email: fixtureAccounts.reader.email,
			status: 'draft',
			given_name: 'Fixture',
			family_name: 'Reader',
			thirteen_or_older: 1,
			created_at: added,
			updated_at: added
		})
	);

	// The nation reviewer is the steward of one nation's team.
	statements.push(
		insert('nation_team_members', {
			identifier: 'fixture-nation-team-place',
			nation_identifier: fixtureNation,
			person_identifier: personIdentifier('nationReviewer'),
			level: 'steward',
			office: 'Fixture office',
			basis: 'Fixture data for a local copy',
			added_by_project: 1,
			expires_at: at(365),
			granted_by: lead,
			granted_at: added
		})
	);

	// A draft essay, which the co-author may edit.
	const essayKey = `essays/${fixtureEssay}/versions/1-${sha256(essayText).slice(0, 12)}.md`;
	statements.push(
		insert('essays', { identifier: fixtureEssay, part: 'essays', created_at: added, created_by: lead }),
		insert('essay_versions', {
			essay_identifier: fixtureEssay,
			number: 1,
			object_key: essayKey,
			sha256: sha256(essayText),
			bytes: Buffer.byteLength(essayText),
			title: 'Fixture Draft Essay',
			note: 'First draft',
			based_on: null,
			origin: 'editor',
			person_identifier: lead,
			created_at: added
		}),
		insert('access_grants', {
			identifier: 'fixture-grant-co-author-essay',
			person_identifier: personIdentifier('coAuthor'),
			subject_kind: 'essay',
			subject_identifier: fixtureEssay,
			level: 'contribute',
			granted_by: lead,
			granted_at: added
		})
	);

	// Two files the reader sent: a YouTube link waiting for review, and a document that needs an answer.
	statements.push(
		insert('uploads', {
			identifier: 'fixture-upload-video',
			reference: fixtureUploadReferences[0],
			group_identifier: 'fixture-upload-group',
			account_identifier: accountIdentifier('reader'),
			way_in: 'send-files',
			kind: 'video',
			source: 'youtube',
			status: 'waiting-for-review',
			youtube_identifier: 'aaaaaaaaaaa',
			title: 'Fixture video link',
			description: 'A made-up link for a local copy.',
			origin: 'own-work',
			permitted_use: 'reference-only',
			described_at: at(-2),
			check_result: 'passed',
			received_at: at(-2),
			finished_at: at(-2),
			checked_at: at(-2)
		}),
		insert('uploads', {
			identifier: 'fixture-upload-document',
			reference: fixtureUploadReferences[1],
			group_identifier: 'fixture-upload-group',
			account_identifier: accountIdentifier('reader'),
			way_in: 'send-files',
			kind: 'document',
			source: 'file',
			status: 'needs-answer',
			file_name: 'fixture-document.pdf',
			media_type: 'application/pdf',
			size_bytes: 1024,
			title: 'Fixture document',
			description: 'A made-up document for a local copy. No file is stored.',
			origin: 'not-sure',
			permitted_use: 'background-only',
			described_at: at(-1),
			check_result: 'passed',
			reviewer_identifier: personIdentifier('editor'),
			received_at: at(-1),
			finished_at: at(-1),
			checked_at: at(-1)
		})
	);

	// A published online talk two weeks from now, which the reader registered for.
	const starts = at(14);
	const ends = new Date(Date.parse(starts) + 60 * 60 * 1000).toISOString();
	statements.push(
		insert(
			'calendar_events',
			{
				identifier: 'fixture-event',
				slug: fixtureEvent,
				title: 'Fixture Online Talk',
				summary: 'A made-up event in a local copy of the database.',
				description: 'Nothing happens at this event. It exists so the events pages have something to show.',
				kind: 'talk',
				starts_at: starts,
				ends_at: ends,
				time_zone: 'America/Los_Angeles',
				online_link: 'https://example.org/fixture-meeting',
				recording: 'not-recorded',
				access_notes: 'Captions are on.',
				status: 'published',
				created_by: lead,
				created_at: added,
				updated_at: added
			},
			'ON CONFLICT (identifier) DO UPDATE SET starts_at = excluded.starts_at, ends_at = excluded.ends_at'
		),
		insert('calendar_ticket_types', {
			identifier: 'fixture-ticket-online',
			event_identifier: 'fixture-event',
			name: 'Online',
			attendance: 'online',
			capacity: 100,
			sort_order: 0
		}),
		insert('calendar_registrations', {
			identifier: 'fixture-registration-reader',
			event_identifier: 'fixture-event',
			ticket_identifier: 'fixture-ticket-online',
			account_identifier: accountIdentifier('reader'),
			name: fixtureAccounts.reader.name,
			wants_reminders: 1,
			status: 'registered',
			registered_at: added,
			updated_at: added
		})
	);

	// A question sent with the request form.
	statements.push(
		insert('requests', {
			identifier: 'fixture-request',
			reference: fixtureRequestReference,
			kind: 'question',
			status: 'received',
			requester_name: 'Fixture Requester',
			contact: 'requester@example.org',
			details: 'A made-up question in a local copy of the database.',
			received_at: at(-3)
		})
	);

	// A test-mode book order of the reader's, already shipped. Test orders never print or charge.
	statements.push(
		insert('book_orders', {
			identifier: 'fixture-book-order-000000000001',
			mode: 'test',
			status: 'shipped',
			file_set: 'fixture',
			title: 'Fixture book order',
			pod_package_identifier: '0600X0900BWSTDPB060UW444MXX',
			page_count: 200,
			choice: JSON.stringify({ size: 'us-trade', binding: 'paperback', ink: 'standardBlackAndWhite', paper: 'whiteUncoated', finish: 'matte' }),
			shipping_level: 'MAIL',
			printer_cost_cents: 1000,
			price_cents: 1500,
			account_identifier: accountIdentifier('reader'),
			email: fixtureAccounts.reader.email,
			created_at: at(-20),
			updated_at: at(-10)
		})
	);

	return { statements, essayKey };
}

/**
 * Makes site/.dev.vars name the fixture lead author when the file does not
 * exist yet; Wrangler reads it for `wrangler dev`, and git ignores it.
 */
function writeDevelopmentVariables() {
	const file = '.dev.vars';
	if (!existsSync(file)) {
		writeFileSync(file, `LEAD_AUTHOR_EMAIL=${fixtureAccounts.leadAuthor.email}\n`);
		return `Wrote ${file} with LEAD_AUTHOR_EMAIL=${fixtureAccounts.leadAuthor.email}.`;
	}
	if (!/^LEAD_AUTHOR_EMAIL=/m.test(readFileSync(file, 'utf8'))) {
		return `${file} has no LEAD_AUTHOR_EMAIL; add LEAD_AUTHOR_EMAIL=${fixtureAccounts.leadAuthor.email} to it.`;
	}
	return undefined;
}

export async function seed() {
	migrateLocally();
	const { statements, essayKey } = await fixtureStatements();
	putLocally(essayKey, essayText, 'text/markdown; charset=utf-8');
	executeLocally(statements);
}

async function main() {
	if (process.argv.includes('--code')) {
		console.log(await currentCode());
		return;
	}
	if (!existsSync('wrangler.jsonc')) {
		console.error('Run this from site/.');
		process.exit(1);
	}
	await seed();
	const note = writeDevelopmentVariables();
	const width = Math.max(...Object.values(fixtureAccounts).map((account) => account.email.length));
	console.log('The local database has the fixtures. Sign in at http://localhost:8787/sign-in (npm run preview) as:');
	for (const account of Object.values(fixtureAccounts)) {
		console.log(`  ${account.email.padEnd(width)}  ${account.role ?? 'reader, no workspace access'}${account.twoStep ? ', two-step' : ''}`);
	}
	console.log(`Password for each: ${fixturePassword}`);
	console.log(`Two-step code now: ${await currentCode()} (npm run database:seed:local -- --code prints it again later)`);
	console.log(`Authenticator app: ${authenticatorLink(fixtureAuthenticatorSecret, fixtureAccounts.leadAuthor.email)}`);
	if (note) console.log(note);
}

if (import.meta.url === `file://${path.resolve(process.argv[1] ?? '')}`) await main();
