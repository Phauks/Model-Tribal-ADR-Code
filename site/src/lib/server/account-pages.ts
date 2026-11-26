/**
 * What the Account pages read and change (site/DESIGN.md, section 6,
 * "Settings and Account"; decision record 0045): where the person is signed
 * in, the copy of their settings kept for every device, and the download of
 * what the project keeps about them.
 *
 * Account holds who someone is to the project and what it keeps about them,
 * on the server. How the site looks on one screen is in Settings, on the
 * device; the only part of that kept here is the optional copy in
 * account_settings.
 */
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import { parseSettings, parseTheme, serializeSettings, type ReadingSettings, type Theme } from '#lib/reading-settings.ts';
import type { SignedInAccount } from './contributor-profiles.ts';
import { profileBySubject } from './contributor-profiles.ts';
import { now } from './identifiers.ts';

/* Where you are signed in ------------------------------------------------ */

export interface SignedInDevice {
	/** A short handle for the session, made from its stored hash. The token itself is never shown. */
	handle: string;
	device: string;
	createdAt: string;
	lastSeenAt: string;
	method: string;
	current: boolean;
}

const handleLength = 16;

/** The account's sessions that have not expired, the current one first, then the most recently used. */
export async function signedInDevices(
	database: D1Database,
	accountIdentifier: string,
	currentTokenHash: string | undefined
): Promise<SignedInDevice[]> {
	const { results } = await database
		.prepare(
			`SELECT token_hash, device, created_at, last_seen_at, method FROM sessions
			 WHERE account_identifier = ? AND expires_at > ?
			 ORDER BY last_seen_at DESC`
		)
		.bind(accountIdentifier, now())
		.all<{ token_hash: string; device: string | null; created_at: string; last_seen_at: string; method: string }>();
	const devices = results.map((row) => ({
		handle: row.token_hash.slice(0, handleLength),
		device: row.device ?? 'A browser',
		createdAt: row.created_at,
		lastSeenAt: row.last_seen_at,
		method: row.method,
		current: row.token_hash === currentTokenHash
	}));
	return [...devices.filter((item) => item.current), ...devices.filter((item) => !item.current)];
}

/** Signs out one other session of this account. The current session cannot be ended here; Sign out does that. */
export async function endOtherSession(
	database: D1Database,
	accountIdentifier: string,
	handle: string,
	currentTokenHash: string
): Promise<boolean> {
	if (!/^[0-9a-f]+$/.test(handle) || handle.length !== handleLength) return false;
	const result = await database
		.prepare('DELETE FROM sessions WHERE account_identifier = ? AND substr(token_hash, 1, ?) = ? AND token_hash != ?')
		.bind(accountIdentifier, handleLength, handle, currentTokenHash)
		.run();
	return (result.meta?.changes ?? 0) > 0;
}

/** Signs out every session of this account except the current one. */
export async function endOtherSessions(database: D1Database, accountIdentifier: string, currentTokenHash: string): Promise<void> {
	await database
		.prepare('DELETE FROM sessions WHERE account_identifier = ? AND token_hash != ?')
		.bind(accountIdentifier, currentTokenHash)
		.run();
}

/* Settings on every device ----------------------------------------------- */

export interface AccountSettingsCopy {
	settings: ReadingSettings;
	theme: Theme;
	updatedAt: string;
}

/** The copy of the person's settings, or undefined when "Use these settings on every device" is off. */
export async function accountSettingsCopy(
	database: D1Database,
	accountIdentifier: string
): Promise<AccountSettingsCopy | undefined> {
	const row = await database
		.prepare('SELECT reading_settings, theme, updated_at FROM account_settings WHERE account_identifier = ?')
		.bind(accountIdentifier)
		.first<{ reading_settings: string; theme: string; updated_at: string }>();
	if (!row) return undefined;
	return { settings: parseSettings(row.reading_settings), theme: parseTheme(row.theme), updatedAt: row.updated_at };
}

/** Keeps a copy of these settings with the account. Unknown values are dropped, as on the device. */
export async function saveAccountSettingsCopy(
	database: D1Database,
	accountIdentifier: string,
	settings: unknown,
	theme: unknown
): Promise<AccountSettingsCopy> {
	const cleaned = parseSettings(typeof settings === 'object' && settings !== null ? JSON.stringify(settings) : null);
	const cleanedTheme = parseTheme(typeof theme === 'string' ? theme : null);
	const updatedAt = now();
	await database
		.prepare(
			`INSERT INTO account_settings (account_identifier, reading_settings, theme, updated_at) VALUES (?1, ?2, ?3, ?4)
			 ON CONFLICT (account_identifier) DO UPDATE SET
			   reading_settings = excluded.reading_settings, theme = excluded.theme, updated_at = excluded.updated_at`
		)
		.bind(accountIdentifier, serializeSettings(cleaned) ?? '{}', cleanedTheme, updatedAt)
		.run();
	return { settings: cleaned, theme: cleanedTheme, updatedAt };
}

/** Turns "Use these settings on every device" off: the copy is deleted; each device keeps its own. */
export async function deleteAccountSettingsCopy(database: D1Database, accountIdentifier: string): Promise<void> {
	await database.prepare('DELETE FROM account_settings WHERE account_identifier = ?').bind(accountIdentifier).run();
}

/* Download my data ------------------------------------------------------- */

/**
 * Everything the project keeps with this account, as one JSON file. Requests
 * sent through the request form are not tied to an account, so they are not
 * in it; the request reference finds them. Settings, starred pages and pages
 * saved for offline are on the device and can be exported from Settings,
 * under This device.
 */
export async function accountDataExport(database: D1Database, account: SignedInAccount): Promise<Record<string, unknown>> {
	const [accountRow, person, profile, versions, follows, followSettings, settingsCopy, sessions, uploads, eventRegistrations, sponsorships, videoRooms, bookOrders] = await Promise.all([
		database
			.prepare(
				'SELECT email, email_verified_at, password_changed_at, created_at, last_signed_in_at, password_hash IS NOT NULL AS has_password FROM accounts WHERE identifier = ?'
			)
			.bind(account.subject)
			.first<Record<string, unknown>>(),
		database
			.prepare('SELECT display_name, email, role, nation_identifier, status, added_at, last_signed_in_at FROM people WHERE sign_in_subject = ?')
			.bind(account.subject)
			.first<Record<string, unknown>>(),
		profileBySubject(database, account.subject),
		database
			.prepare(
				`SELECT version, snapshot, credit_line, confirmed_at FROM contributor_profile_versions
				 WHERE profile_identifier = (SELECT identifier FROM contributor_profiles WHERE sign_in_subject = ?)
				 ORDER BY version`
			)
			.bind(account.subject)
			.all<{ version: number; snapshot: string; credit_line: string | null; confirmed_at: string }>(),
		database
			.prepare('SELECT address, followed_at FROM follows WHERE account_identifier = ? ORDER BY followed_at')
			.bind(account.subject)
			.all<{ address: string; followed_at: string }>(),
		database
			.prepare('SELECT email, last_emailed_at FROM follow_settings WHERE account_identifier = ?')
			.bind(account.subject)
			.first<Record<string, unknown>>(),
		accountSettingsCopy(database, account.subject),
		signedInDevices(database, account.subject, undefined),
		// Files and links sent to the project (docs/uploads.md); the files themselves are on the Your uploads page.
		database
			.prepare(
				`SELECT reference, kind, status, file_name, media_type, size_bytes, youtube_identifier, title, description, origin, received_at
				 FROM uploads WHERE account_identifier = ? ORDER BY received_at`
			)
			.bind(account.subject)
			.all<Record<string, unknown>>(),
		// Events registered for (migrations/20261123T0450_add_event_calendar.sql), with the access needs given.
		database
			.prepare(
				`SELECT e.title AS event, e.starts_at, t.name AS seat, r.name, r.status, r.access_needs, r.wants_reminders, r.registered_at, r.cancelled_at
				 FROM calendar_registrations r
				 JOIN calendar_events e ON e.identifier = r.event_identifier
				 JOIN calendar_ticket_types t ON t.identifier = r.ticket_identifier
				 WHERE r.account_identifier = ? ORDER BY r.registered_at`
			)
			.bind(account.subject)
			.all<Record<string, unknown>>(),
		// Sponsorships the person manages (docs/sponsorship.md). The organization's own details are on its Sponsorship page.
		database
			.prepare(
				`SELECT sponsors.name, sponsor_managers.added_at FROM sponsor_managers
				 JOIN sponsors ON sponsors.identifier = sponsor_managers.sponsor_identifier
				 WHERE sponsor_managers.account_identifier = ? ORDER BY sponsor_managers.added_at`
			)
			.bind(account.subject)
			.all<{ name: string; added_at: string }>(),
		// Video rooms joined, and what was said about recording (migrations/20261123T1750_add_standalone_video_rooms.sql).
		database
			.prepare(
				`SELECT r.title AS room, p.name, p.role, p.told_recording, p.told_at, p.last_joined_at
				 FROM video_room_people p
				 JOIN video_rooms r ON r.identifier = p.room_identifier
				 WHERE p.account_identifier = ? ORDER BY p.told_at`
			)
			.bind(account.subject)
			.all<Record<string, unknown>>(),
		// Printed copies ordered while signed in, and problems reported about them (docs/book-orders.md, "Your orders and problems").
		database
			.prepare(
				`SELECT o.identifier, o.mode, o.status, o.title, o.page_count, o.shipping_level, o.price_cents, o.refunded_cents, o.refunded_at,
				   o.recipient_name, o.shipping_address, o.email, o.tracking_link, o.created_at,
				   (SELECT json_group_array(json_object('kind', p.kind, 'details', p.details, 'status', p.status, 'answer', p.answer, 'reportedAt', p.created_at))
				    FROM book_order_problems p WHERE p.order_identifier = o.identifier) AS problems
				 FROM book_orders o WHERE o.account_identifier = ? ORDER BY o.created_at`
			)
			.bind(account.subject)
			.all<Record<string, unknown> & { shipping_address: string | null; problems: string }>()
	]);
	return {
		about:
			'Everything the Tribal Law Project keeps with your account, as of the time below. Settings, starred pages and pages saved for offline are kept on each device instead; export them from Settings, under This device.',
		madeAt: now(),
		account: accountRow ? { ...accountRow, has_password: Boolean(accountRow.has_password) } : null,
		workspace: person ?? null,
		profile: profile
			? {
					status: profile.status,
					answers: profile.answers,
					creditSection: profile.creditSection,
					createdAt: profile.createdAt,
					updatedAt: profile.updatedAt,
					confirmedVersion: profile.confirmedVersion,
					publicPage: profile.publicSlug ? `/contributors/${profile.publicSlug}` : null,
					hasPicture: Boolean(profile.pictureKey),
					curriculumVitae: profile.curriculumVitaeName
				}
			: null,
		confirmedProfileVersions: versions.results.map((row) => ({
			version: row.version,
			confirmedAt: row.confirmed_at,
			creditLine: row.credit_line,
			answers: JSON.parse(row.snapshot) as unknown
		})),
		uploads: uploads.results,
		eventRegistrations: eventRegistrations.results,
		sponsorshipsYouManage: sponsorships.results.map((row) => ({ name: row.name, managerSince: row.added_at })),
		videoRooms: videoRooms.results,
		bookOrders: bookOrders.results.map((row) => ({
			...row,
			shipping_address: row.shipping_address ? (JSON.parse(row.shipping_address) as unknown) : null,
			problems: JSON.parse(row.problems) as unknown
		})),
		followedPages: follows.results,
		emailAboutFollowedPages: followSettings ?? { email: 'daily' },
		settingsOnEveryDevice: settingsCopy ?? null,
		signedIn: sessions.map(({ device, createdAt, lastSeenAt, method }) => ({ device, createdAt, lastSeenAt, method }))
	};
}
