/**
 * Sponsor accounts (docs/sponsorship.md, decision record 0050): an
 * organization that gives to the project, the accounts that manage it, how
 * it is listed in public, and the gifts Stripe reports.
 *
 * Gifts stay closed until SPONSOR_GIFTS is "test" or "live" and the Stripe
 * settings are in the Cloudflare dashboard. Until then a sponsor can still
 * set up their listing. The amount anyone gives is never shown in public;
 * only the sponsor's own managers and the lead author see it.
 */
import type { D1Database, D1PreparedStatement, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { isEarmark, isListing, slugFor, type Earmark, type Listing } from '#lib/sponsorship.ts';
import { fileScans, forgetScan, mayServe, storeSentFile } from './file-scans.ts';
import { newIdentifier, now } from './identifiers.ts';
import { randomToken, sha256 } from './sign-in-secrets.ts';
import { isTestKey, type StripeSettings } from './stripe.ts';

export type GiftMode = 'test' | 'live';

export interface GiftsOpen {
	open: true;
	mode: GiftMode;
	stripe: StripeSettings;
	/** Who receives the money, as the gift form names them. */
	receiver: string;
}

export interface GiftsClosed {
	open: false;
	/** What sponsors read on their Account page. */
	reason: string;
	/** The mode set, if any, so the lead author's page can say which settings are missing for it. */
	mode: GiftMode | null;
}

export type GiftState = GiftsOpen | GiftsClosed;

const closedForSponsors = 'Gifts are not open yet. The project is still choosing who receives payments. You can set how you would like to be listed now.';

/**
 * Whether sponsors can give, from the Worker's settings. Test mode only
 * works with a Stripe test key and live mode only with a live key, so a test
 * can never move real money. Live mode also needs SPONSOR_GIFTS_RECEIVER,
 * which names who receives the money, because that is still to be decided.
 */
export function giftState(environment: WorkerEnvironment): GiftState {
	const setting = environment.SPONSOR_GIFTS;
	const mode: GiftMode | null = setting === 'test' || setting === 'live' ? setting : null;
	if (!mode) return { open: false, reason: closedForSponsors, mode: null };
	const secretKey = environment.STRIPE_SECRET_KEY;
	const webhookSecret = environment.STRIPE_SPONSOR_WEBHOOK_SECRET;
	if (!secretKey || !webhookSecret) return { open: false, reason: closedForSponsors, mode };
	const stripe = { secretKey, webhookSecret };
	if ((mode === 'test') !== isTestKey(stripe)) return { open: false, reason: closedForSponsors, mode };
	const receiver = environment.SPONSOR_GIFTS_RECEIVER?.trim();
	if (mode === 'live' && !receiver) return { open: false, reason: closedForSponsors, mode };
	return {
		open: true,
		mode,
		stripe,
		receiver: receiver || 'Model Tribal ADR Code (test mode: no real money moves)'
	};
}

export interface SettingCheck {
	/** The setting's name in the Cloudflare dashboard, or a short name for a check that is not one setting. */
	name: string;
	ok: boolean;
	detail: string;
}

/**
 * Each setting gifts need and whether it is right, for the lead author's
 * Sponsors page. It never shows a secret, only whether it is set and which
 * kind of key it is.
 */
export function giftSettingChecks(environment: WorkerEnvironment): SettingCheck[] {
	const setting = environment.SPONSOR_GIFTS;
	const mode = setting === 'test' || setting === 'live' ? setting : null;
	const key = environment.STRIPE_SECRET_KEY;
	const keyKind = !key ? null : isTestKey({ secretKey: key, webhookSecret: '' }) ? 'test' : 'live';
	const receiver = environment.SPONSOR_GIFTS_RECEIVER?.trim();
	return [
		{
			name: 'SPONSOR_GIFTS',
			ok: mode !== null,
			detail: mode
				? `Set to “${mode}”.`
				: setting
					? `Set to “${setting}”, which is neither “test” nor “live”, so gifts are off.`
					: 'Not set, so gifts are off. Set it to “test” to try gifts with Stripe’s test cards.'
		},
		{
			name: 'STRIPE_SECRET_KEY',
			ok: keyKind !== null && (mode === null || keyKind === mode),
			detail: !keyKind
				? 'Not set.'
				: mode && keyKind !== mode
					? `Set, but it is a ${keyKind} key and gifts are set to ${mode}. They must match.`
					: `Set (a ${keyKind} key). The same key is used for printed copies.`
		},
		{
			name: 'STRIPE_SPONSOR_WEBHOOK_SECRET',
			ok: Boolean(environment.STRIPE_SPONSOR_WEBHOOK_SECRET),
			detail: environment.STRIPE_SPONSOR_WEBHOOK_SECRET
				? 'Set.'
				: 'Not set. In Stripe, add a webhook endpoint for /sponsorship/payment-webhook and copy its signing secret here.'
		},
		{
			name: 'SPONSOR_GIFTS_RECEIVER',
			ok: Boolean(receiver) || mode !== 'live',
			detail: receiver
				? `Set: gifts go to “${receiver}”.`
				: mode === 'live'
					? 'Not set. Live gifts stay off until it names who receives the money.'
					: 'Not set. Only needed for live gifts; it names who receives the money.'
		}
	];
}

export interface Sponsor {
	identifier: string;
	slug: string;
	name: string;
	link: string | null;
	oneLine: string | null;
	logoKey: string | null;
	logoType: string | null;
	listing: Listing;
	earmark: Earmark;
	stripeCustomerTest: string | null;
	stripeCustomerLive: string | null;
	hiddenByProject: boolean;
	hiddenNote: string | null;
	createdAt: string;
	updatedAt: string;
}

interface SponsorRow {
	identifier: string;
	slug: string;
	name: string;
	link: string | null;
	one_line: string | null;
	logo_key: string | null;
	logo_type: string | null;
	listing: string;
	earmark: string;
	stripe_customer_test: string | null;
	stripe_customer_live: string | null;
	hidden_by_project: number;
	hidden_note: string | null;
	created_at: string;
	updated_at: string;
}

function sponsorFrom(row: SponsorRow): Sponsor {
	return {
		identifier: row.identifier,
		slug: row.slug,
		name: row.name,
		link: row.link,
		oneLine: row.one_line,
		logoKey: row.logo_key,
		logoType: row.logo_type,
		listing: isListing(row.listing) ? row.listing : 'hidden',
		earmark: isEarmark(row.earmark) ? row.earmark : 'needed-most',
		stripeCustomerTest: row.stripe_customer_test,
		stripeCustomerLive: row.stripe_customer_live,
		hiddenByProject: row.hidden_by_project === 1,
		hiddenNote: row.hidden_note,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

export function stripeCustomerFor(sponsor: Sponsor, mode: GiftMode): string | null {
	return mode === 'live' ? sponsor.stripeCustomerLive : sponsor.stripeCustomerTest;
}

export async function sponsorByIdentifier(database: D1Database, identifier: string): Promise<Sponsor | null> {
	const row = await database.prepare('SELECT * FROM sponsors WHERE identifier = ?').bind(identifier).first<SponsorRow>();
	return row ? sponsorFrom(row) : null;
}

export async function sponsorBySlug(database: D1Database, slug: string): Promise<Sponsor | null> {
	const row = await database.prepare('SELECT * FROM sponsors WHERE slug = ?').bind(slug).first<SponsorRow>();
	return row ? sponsorFrom(row) : null;
}

async function sponsorByCustomer(database: D1Database, mode: GiftMode, customer: string): Promise<Sponsor | null> {
	const column = mode === 'live' ? 'stripe_customer_live' : 'stripe_customer_test';
	const row = await database.prepare(`SELECT * FROM sponsors WHERE ${column} = ?`).bind(customer).first<SponsorRow>();
	return row ? sponsorFrom(row) : null;
}

/** The sponsorships an account manages, by name. */
export async function sponsorsManagedBy(database: D1Database, account: string): Promise<Sponsor[]> {
	const { results } = await database
		.prepare(
			`SELECT sponsors.* FROM sponsors
			 JOIN sponsor_managers ON sponsor_managers.sponsor_identifier = sponsors.identifier
			 WHERE sponsor_managers.account_identifier = ?
			 ORDER BY sponsors.name COLLATE NOCASE`
		)
		.bind(account)
		.all<SponsorRow>();
	return results.map(sponsorFrom);
}

export async function isManager(database: D1Database, sponsor: string, account: string): Promise<boolean> {
	const row = await database
		.prepare('SELECT 1 AS yes FROM sponsor_managers WHERE sponsor_identifier = ? AND account_identifier = ?')
		.bind(sponsor, account)
		.first<{ yes: number }>();
	return Boolean(row);
}

export interface Manager {
	account: string;
	email: string;
	addedAt: string;
}

export async function managersOf(database: D1Database, sponsor: string): Promise<Manager[]> {
	const { results } = await database
		.prepare(
			`SELECT accounts.identifier AS account, accounts.email AS email, sponsor_managers.added_at AS addedAt
			 FROM sponsor_managers JOIN accounts ON accounts.identifier = sponsor_managers.account_identifier
			 WHERE sponsor_managers.sponsor_identifier = ?
			 ORDER BY sponsor_managers.added_at`
		)
		.bind(sponsor)
		.all<Manager>();
	return results;
}

export interface Actor {
	/** The account making the change, or null for Stripe. */
	account: string | null;
	/** How the history names them: their email address, "Stripe" or "The project". */
	name: string;
}

function historyStatement(database: D1Database, sponsor: string, actor: Actor, action: string, note: string | null = null): D1PreparedStatement {
	return database
		.prepare(
			`INSERT INTO sponsor_history (identifier, sponsor_identifier, account_identifier, actor, action, note, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.bind(newIdentifier(), sponsor, actor.account, actor.name, action, note, now());
}

export interface HistoryEntry {
	actor: string;
	action: string;
	note: string | null;
	createdAt: string;
}

export async function historyOf(database: D1Database, sponsor: string, limit = 50): Promise<HistoryEntry[]> {
	const { results } = await database
		.prepare(
			`SELECT actor, action, note, created_at AS createdAt FROM sponsor_history
			 WHERE sponsor_identifier = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`
		)
		.bind(sponsor, limit)
		.all<HistoryEntry>();
	return results;
}

/** A slug not yet taken by another sponsor: the name's own, or the name's with a number after it. */
async function freeSlug(database: D1Database, name: string, except: string | null): Promise<string> {
	const base = slugFor(name);
	for (let number = 1; number < 100; number++) {
		const slug = number === 1 ? base : `${base}-${number}`;
		const taken = await database.prepare('SELECT identifier FROM sponsors WHERE slug = ?').bind(slug).first<{ identifier: string }>();
		if (!taken || taken.identifier === except) return slug;
	}
	return `${base}-${randomToken(4)
		.toLowerCase()
		.replace(/[^a-z0-9]/g, '')}`;
}

/** Starts a sponsorship, with the account that started it as its first manager. */
export async function createSponsor(database: D1Database, account: { subject: string; email: string }, name: string): Promise<Sponsor> {
	const identifier = newIdentifier();
	const time = now();
	const slug = await freeSlug(database, name, null);
	await database.batch([
		database
			.prepare(
				`INSERT INTO sponsors (identifier, slug, name, created_at, created_by, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.bind(identifier, slug, name, time, account.subject, time),
		database
			.prepare('INSERT INTO sponsor_managers (sponsor_identifier, account_identifier, added_at) VALUES (?, ?, ?)')
			.bind(identifier, account.subject, time),
		historyStatement(database, identifier, { account: account.subject, name: account.email }, 'Started the sponsorship', name)
	]);
	return (await sponsorByIdentifier(database, identifier)) as Sponsor;
}

export interface ListingChanges {
	name: string;
	link: string | null;
	oneLine: string | null;
	listing: Listing;
	earmark: Earmark;
}

/** A link a sponsor may show: an https address with a host, or a problem to tell them. */
export function checkedLink(text: string | null): { link: string | null } | { problem: string } {
	if (!text) return { link: null };
	const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
	let parsed: URL;
	try {
		parsed = new URL(withScheme);
	} catch {
		return {
			problem: 'The link is not a web address. Use one like https://example.org.'
		};
	}
	if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.') || parsed.username || parsed.password) {
		return {
			problem: 'The link must be a secure web address that starts with https://.'
		};
	}
	const link = parsed.toString();
	return link.length > 300 ? { problem: 'The link is too long.' } : { link };
}

/** Saves the listing, noting in the history which parts changed. */
export async function saveListing(database: D1Database, sponsor: Sponsor, actor: Actor, changes: ListingChanges): Promise<Sponsor> {
	const changed: string[] = [];
	if (changes.name !== sponsor.name) changed.push('name');
	if (changes.link !== sponsor.link) changed.push('link');
	if (changes.oneLine !== sponsor.oneLine) changed.push('one line');
	if (changes.listing !== sponsor.listing) changed.push('how they are listed');
	if (changes.earmark !== sponsor.earmark) changed.push('where the gift goes');
	if (changed.length === 0) return sponsor;
	const slug = changes.name === sponsor.name ? sponsor.slug : await freeSlug(database, changes.name, sponsor.identifier);
	await database.batch([
		database
			.prepare(
				`UPDATE sponsors SET name = ?, slug = ?, link = ?, one_line = ?, listing = ?, earmark = ?, updated_at = ?
				 WHERE identifier = ?`
			)
			.bind(changes.name, slug, changes.link, changes.oneLine, changes.listing, changes.earmark, now(), sponsor.identifier),
		historyStatement(database, sponsor.identifier, actor, 'Changed the listing', changed.join(', '))
	]);
	return (await sponsorByIdentifier(database, sponsor.identifier)) as Sponsor;
}

/**
 * Sets where the sponsor's gifts go, as chosen on the Sponsorship page or
 * beside the gift form (docs/sponsorship.md). Gifts are recorded with the
 * choice in place when Stripe reports them.
 */
export async function setEarmark(database: D1Database, sponsor: Sponsor, actor: Actor, earmark: Earmark): Promise<Sponsor> {
	if (earmark === sponsor.earmark) return sponsor;
	await database.batch([
		database.prepare('UPDATE sponsors SET earmark = ?, updated_at = ? WHERE identifier = ?').bind(earmark, now(), sponsor.identifier),
		historyStatement(database, sponsor.identifier, actor, 'Changed the listing', 'where the gift goes')
	]);
	return (await sponsorByIdentifier(database, sponsor.identifier)) as Sponsor;
}

/** The largest logo accepted, in bytes. */
export const largestLogo = 512 * 1024;

/** The image type a file really is, from its first bytes, if it is a PNG, JPEG or WebP. SVG is refused because it can carry scripts. */
export function logoType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
	const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
	if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
	if (starts(0xff, 0xd8, 0xff)) return 'image/jpeg';
	if (starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
	return null;
}

export async function setLogo(
	database: D1Database,
	bucket: R2Bucket,
	sponsor: Sponsor,
	actor: Actor,
	bytes: Uint8Array
): Promise<{ done: true } | { problem: string }> {
	if (bytes.byteLength > largestLogo) return { problem: 'The logo is larger than 512 KB. Use a smaller image.' };
	const type = logoType(bytes);
	if (!type) return { problem: 'The logo must be a PNG, JPEG or WebP image.' };
	const key = `sponsors/${sponsor.identifier}/logo-${newIdentifier()}`;
	// Held until the virus check passes (site/SCANNING.md); until then the initials show.
	await storeSentFile(database, bucket, {
		objectKey: key,
		purpose: 'sponsor-logo',
		subject: sponsor.identifier,
		bytes,
		httpMetadata: { contentType: type }
	});
	await database.batch([
		database.prepare('UPDATE sponsors SET logo_key = ?, logo_type = ?, updated_at = ? WHERE identifier = ?').bind(key, type, now(), sponsor.identifier),
		historyStatement(database, sponsor.identifier, actor, 'Changed the logo')
	]);
	if (sponsor.logoKey) await forgetLogo(database, bucket, sponsor.logoKey);
	return { done: true };
}

async function forgetLogo(database: D1Database, bucket: R2Bucket, key: string): Promise<void> {
	await bucket.delete(key);
	await forgetScan(database, key);
}

export async function removeLogo(database: D1Database, bucket: R2Bucket, sponsor: Sponsor, actor: Actor): Promise<void> {
	if (!sponsor.logoKey) return;
	await database.batch([
		database.prepare('UPDATE sponsors SET logo_key = NULL, logo_type = NULL, updated_at = ? WHERE identifier = ?').bind(now(), sponsor.identifier),
		historyStatement(database, sponsor.identifier, actor, 'Removed the logo')
	]);
	await forgetLogo(database, bucket, sponsor.logoKey);
}

/** Which of these sponsors' logos have passed the virus check, so a page shows initials instead of a logo still held. */
export async function logosReady(database: D1Database, sponsors: readonly Sponsor[]): Promise<Set<string>> {
	const keys = sponsors.map((sponsor) => sponsor.logoKey).filter((key): key is string => Boolean(key));
	if (keys.length === 0) return new Set();
	const scans = await fileScans(database, keys);
	return new Set(keys.filter((key) => mayServe(scans.get(key) ?? null)));
}

/** How long an invitation link works. */
export const invitationDays = 14;

export interface Invitation {
	identifier: string;
	label: string;
	createdAt: string;
	expiresAt: string;
}

/** Makes an invitation link's secret; only its hash is kept, so the link is shown once. */
export async function createInvitation(database: D1Database, sponsor: Sponsor, actor: Actor, label: string, at = new Date()): Promise<string> {
	const token = randomToken();
	const expires = new Date(at.getTime() + invitationDays * 24 * 60 * 60 * 1000).toISOString();
	await database.batch([
		database
			.prepare(
				`INSERT INTO sponsor_invitations (identifier, sponsor_identifier, token_hash, label, created_by, created_at, expires_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(newIdentifier(), sponsor.identifier, await sha256(token), label, actor.account, at.toISOString(), expires),
		historyStatement(database, sponsor.identifier, actor, 'Invited someone to manage the sponsorship', label)
	]);
	return token;
}

/** Invitations not yet used and not yet expired. */
export async function openInvitations(database: D1Database, sponsor: string, at = new Date()): Promise<Invitation[]> {
	const { results } = await database
		.prepare(
			`SELECT identifier, label, created_at AS createdAt, expires_at AS expiresAt FROM sponsor_invitations
			 WHERE sponsor_identifier = ? AND accepted_at IS NULL AND expires_at > ?
			 ORDER BY created_at`
		)
		.bind(sponsor, at.toISOString())
		.all<Invitation>();
	return results;
}

export async function withdrawInvitation(database: D1Database, sponsor: Sponsor, actor: Actor, invitation: string): Promise<void> {
	const row = await database
		.prepare('SELECT label FROM sponsor_invitations WHERE identifier = ? AND sponsor_identifier = ? AND accepted_at IS NULL')
		.bind(invitation, sponsor.identifier)
		.first<{ label: string }>();
	if (!row) return;
	await database.batch([
		database.prepare('DELETE FROM sponsor_invitations WHERE identifier = ?').bind(invitation),
		historyStatement(database, sponsor.identifier, actor, 'Withdrew an invitation', row.label)
	]);
}

/** The sponsorship an invitation link is for, if the link still works. */
export async function invitationFor(database: D1Database, token: string, at = new Date()): Promise<{ invitation: string; sponsor: Sponsor } | null> {
	const row = await database
		.prepare(
			`SELECT identifier, sponsor_identifier AS sponsor FROM sponsor_invitations
			 WHERE token_hash = ? AND accepted_at IS NULL AND expires_at > ?`
		)
		.bind(await sha256(token), at.toISOString())
		.first<{ identifier: string; sponsor: string }>();
	if (!row) return null;
	const sponsor = await sponsorByIdentifier(database, row.sponsor);
	return sponsor ? { invitation: row.identifier, sponsor } : null;
}

/** Uses an invitation link: the signed-in account becomes a manager. The link then stops working. */
export async function acceptInvitation(
	database: D1Database,
	token: string,
	account: { subject: string; email: string },
	at = new Date()
): Promise<Sponsor | null> {
	const found = await invitationFor(database, token, at);
	if (!found) return null;
	const time = at.toISOString();
	const statements = [
		database
			.prepare('UPDATE sponsor_invitations SET accepted_at = ?, accepted_by = ? WHERE identifier = ? AND accepted_at IS NULL')
			.bind(time, account.subject, found.invitation)
	];
	if (!(await isManager(database, found.sponsor.identifier, account.subject))) {
		statements.push(
			database
				.prepare('INSERT INTO sponsor_managers (sponsor_identifier, account_identifier, added_at) VALUES (?, ?, ?)')
				.bind(found.sponsor.identifier, account.subject, time),
			historyStatement(
				database,
				found.sponsor.identifier,
				{ account: account.subject, name: account.email },
				'Accepted an invitation and now manages the sponsorship'
			)
		);
	}
	await database.batch(statements);
	return found.sponsor;
}

/** Takes someone off a sponsorship. The last manager cannot be removed, so a sponsorship always has someone to look after it. */
export async function removeManager(
	database: D1Database,
	sponsor: Sponsor,
	actor: Actor,
	account: string
): Promise<'removed' | 'last-manager' | 'not-a-manager'> {
	const managers = await managersOf(database, sponsor.identifier);
	const leaving = managers.find((manager) => manager.account === account);
	if (!leaving) return 'not-a-manager';
	if (managers.length === 1) return 'last-manager';
	await database.batch([
		database.prepare('DELETE FROM sponsor_managers WHERE sponsor_identifier = ? AND account_identifier = ?').bind(sponsor.identifier, account),
		historyStatement(database, sponsor.identifier, actor, account === actor.account ? 'Stopped managing the sponsorship' : 'Removed a manager', leaving.email)
	]);
	return 'removed';
}

/** Keeps the Stripe customer made for a sponsor in one mode. */
export async function saveStripeCustomer(database: D1Database, sponsor: Sponsor, mode: GiftMode, customer: string, actor: Actor): Promise<void> {
	const column = mode === 'live' ? 'stripe_customer_live' : 'stripe_customer_test';
	await database.batch([
		database.prepare(`UPDATE sponsors SET ${column} = ?, updated_at = ? WHERE identifier = ? AND ${column} IS NULL`).bind(customer, now(), sponsor.identifier),
		historyStatement(database, sponsor.identifier, actor, `Connected to Stripe (${mode})`, customer)
	]);
}

export interface Gift {
	kind: 'one-time' | 'monthly';
	amountCents: number;
	currency: string;
	earmark: string;
	receivedAt: string;
	mode: GiftMode;
	stripeObject: string;
}

/**
 * Records a gift Stripe reported, for the sponsor whose Stripe customer paid
 * it. Stripe may report the same gift more than once, so each Checkout page
 * or invoice is kept once. Returns false when the customer is not a sponsor's
 * or the gift was already recorded.
 */
export async function recordGift(
	database: D1Database,
	gift: {
		mode: GiftMode;
		customer: string;
		stripeObject: string;
		kind: 'one-time' | 'monthly';
		amountCents: number;
		currency: string;
	},
	at = now()
): Promise<boolean> {
	if (!(gift.amountCents > 0)) return false;
	const sponsor = await sponsorByCustomer(database, gift.mode, gift.customer);
	if (!sponsor) return false;
	const known = await database.prepare('SELECT 1 AS yes FROM sponsor_gifts WHERE stripe_object = ?').bind(gift.stripeObject).first();
	if (known) return false;
	await database.batch([
		database
			.prepare(
				`INSERT INTO sponsor_gifts (identifier, sponsor_identifier, mode, stripe_object, kind, amount_cents, currency, earmark, received_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
			.bind(newIdentifier(), sponsor.identifier, gift.mode, gift.stripeObject, gift.kind, gift.amountCents, gift.currency, sponsor.earmark, at),
		historyStatement(
			database,
			sponsor.identifier,
			{ account: null, name: 'Stripe' },
			gift.kind === 'monthly' ? 'Monthly gift received' : 'Gift received',
			`${gift.mode === 'test' ? 'Test mode. ' : ''}${gift.stripeObject}`
		)
	]);
	return true;
}

export async function giftsOf(database: D1Database, sponsor: string, mode?: GiftMode): Promise<Gift[]> {
	const { results } = await database
		.prepare(
			`SELECT kind, amount_cents AS amountCents, currency, earmark, received_at AS receivedAt, mode, stripe_object AS stripeObject
			 FROM sponsor_gifts WHERE sponsor_identifier = ? AND (? IS NULL OR mode = ?)
			 ORDER BY received_at DESC`
		)
		.bind(sponsor, mode ?? null, mode ?? null)
		.all<Gift>();
	return results;
}

export interface GiftTotals {
	count: number;
	totalCents: number;
	firstAt: string | null;
	lastAt: string | null;
}

export function totalsOf(gifts: readonly Gift[]): GiftTotals {
	const times = gifts.map((gift) => gift.receivedAt).sort();
	return {
		count: gifts.length,
		totalCents: gifts.reduce((sum, gift) => sum + gift.amountCents, 0),
		firstAt: times[0] ?? null,
		lastAt: times.at(-1) ?? null
	};
}

/**
 * The mode whose gifts make a sponsor show in public: test gifts while gifts
 * are in test mode, so the whole path can be tried; otherwise live gifts only.
 */
export function publicMode(state: GiftState): GiftMode {
	return state.open ? state.mode : state.mode === 'test' ? 'test' : 'live';
}

export interface PublicStatus {
	shown: boolean;
	reason: string;
}

/** Whether a sponsor shows on the public pages, and why, for the sponsor's own page and the lead author's. */
export function publicStatus(sponsor: Sponsor, hasGift: boolean): PublicStatus {
	if (sponsor.hiddenByProject)
		return {
			shown: false,
			reason: 'The project has taken this sponsor off the public pages.'
		};
	if (sponsor.listing === 'hidden') return { shown: false, reason: 'The sponsor chose not to be listed.' };
	if (!hasGift) return { shown: false, reason: 'Shown once the first gift arrives.' };
	return {
		shown: true,
		reason: sponsor.listing === 'anonymous' ? 'Shown as “a sponsor”, without the name.' : 'Shown on the Sponsorship page.'
	};
}

export interface PublicSponsor {
	/** Null for a sponsor listed as "a sponsor", who has no page of their own. */
	slug: string | null;
	name: string | null;
	oneLine: string | null;
	link: string | null;
	hasLogo: boolean;
	earmark: Earmark;
	since: string;
}

/** What the public pages may show about a sponsor: never the amount, and only what their listing allows. */
export function publicView(sponsor: Sponsor, since: string, logoReady = true): PublicSponsor {
	const anonymous = sponsor.listing === 'anonymous';
	const full = sponsor.listing === 'name-logo-link';
	return {
		slug: anonymous ? null : sponsor.slug,
		name: anonymous ? null : sponsor.name,
		oneLine: anonymous ? null : sponsor.oneLine,
		link: full ? sponsor.link : null,
		hasLogo: full && Boolean(sponsor.logoKey) && logoReady,
		earmark: sponsor.earmark,
		since
	};
}

/** Every sponsor shown in public, the longest-standing first. */
export async function publicSponsors(database: D1Database, mode: GiftMode): Promise<PublicSponsor[]> {
	const { results } = await database
		.prepare(
			`SELECT sponsors.*, MIN(sponsor_gifts.received_at) AS since FROM sponsors
			 JOIN sponsor_gifts ON sponsor_gifts.sponsor_identifier = sponsors.identifier AND sponsor_gifts.mode = ?
			 WHERE sponsors.hidden_by_project = 0 AND sponsors.listing != 'hidden'
			 GROUP BY sponsors.identifier
			 ORDER BY since`
		)
		.bind(mode)
		.all<SponsorRow & { since: string }>();
	const sponsors = results.map(sponsorFrom);
	const ready = await logosReady(database, sponsors);
	return sponsors.map((sponsor, index) => publicView(sponsor, results[index].since, Boolean(sponsor.logoKey && ready.has(sponsor.logoKey))));
}

/** One sponsor's public page, if they are shown and listed by name. */
export async function publicSponsor(database: D1Database, slug: string, mode: GiftMode): Promise<{ sponsor: Sponsor; view: PublicSponsor } | null> {
	const sponsor = await sponsorBySlug(database, slug);
	if (!sponsor || sponsor.listing === 'anonymous') return null;
	const gifts = await giftsOf(database, sponsor.identifier, mode);
	const status = publicStatus(sponsor, gifts.length > 0);
	if (!status.shown) return null;
	const ready = await logosReady(database, [sponsor]);
	return { sponsor, view: publicView(sponsor, totalsOf(gifts).firstAt as string, ready.size > 0) };
}

export interface SponsorOverview {
	sponsor: Sponsor;
	managers: number;
	gifts: { test: GiftTotals; live: GiftTotals };
	status: PublicStatus;
}

/** Every sponsor, for the lead author's Sponsors page. */
export async function allSponsors(database: D1Database, mode: GiftMode): Promise<SponsorOverview[]> {
	const [{ results: rows }, { results: managerCounts }, { results: gifts }] = await Promise.all([
		database.prepare('SELECT * FROM sponsors ORDER BY name COLLATE NOCASE').all<SponsorRow>(),
		database
			.prepare('SELECT sponsor_identifier AS sponsor, COUNT(*) AS count FROM sponsor_managers GROUP BY sponsor_identifier')
			.all<{ sponsor: string; count: number }>(),
		database
			.prepare(
				`SELECT sponsor_identifier AS sponsor, kind, amount_cents AS amountCents, currency, earmark, received_at AS receivedAt, mode, stripe_object AS stripeObject
				 FROM sponsor_gifts`
			)
			.all<Gift & { sponsor: string }>()
	]);
	return rows.map((row) => {
		const sponsor = sponsorFrom(row);
		const own = gifts.filter((gift) => gift.sponsor === sponsor.identifier);
		const test = totalsOf(own.filter((gift) => gift.mode === 'test'));
		const live = totalsOf(own.filter((gift) => gift.mode === 'live'));
		return {
			sponsor,
			managers: managerCounts.find((entry) => entry.sponsor === sponsor.identifier)?.count ?? 0,
			gifts: { test, live },
			status: publicStatus(sponsor, (mode === 'live' ? live : test).count > 0)
		};
	});
}

/** Takes a sponsor off the public pages, or puts them back, as the lead author. */
export async function setHiddenByProject(database: D1Database, sponsor: Sponsor, hidden: boolean, note: string | null, actor: Actor): Promise<void> {
	await database.batch([
		database
			.prepare('UPDATE sponsors SET hidden_by_project = ?, hidden_note = ?, updated_at = ? WHERE identifier = ?')
			.bind(hidden ? 1 : 0, hidden ? note : null, now(), sponsor.identifier),
		historyStatement(
			database,
			sponsor.identifier,
			actor,
			hidden ? 'Taken off the public pages by the project' : 'Put back on the public pages by the project',
			note
		)
	]);
}
