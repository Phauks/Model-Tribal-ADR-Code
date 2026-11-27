import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	followKindOf,
	hasPublicHistory,
	historyAddress,
	readFollowState,
	signedOutState,
	unreadLabel
} from '#lib/following.ts';
import { verifiedAccount } from '#lib/server/accounts.ts';
import { publishVersion, saveVersion, setPublicationListed } from '#lib/server/essays.ts';
import {
	checkForUpdates,
	dueDigests,
	essayPages,
	follow,
	followedPages,
	isFollowing,
	markNoticesRead,
	noticesFor,
	pageDirectory,
	recordDigestSent,
	setEmailChoice,
	settingsFor,
	turnOffEmailByToken,
	unfollow,
	unreadCount,
	type FollowableBuild,
	type FollowablePage
} from '#lib/server/following.ts';
import { digestMessage, siteAddress, updateEmailDelivery } from '#lib/server/following-email.ts';
import { followableBuild as buildFromContent, shownRecord } from '#lib/server/followable-build.ts';
import { isScheduledRun, scheduledTokenHeader, scheduledTokenKey } from '#lib/server/scheduled-run.ts';
import {
	entrySource,
	scheduledTokenHeader as toolHeader,
	scheduledTokenKey as toolKey
} from '../tools/add-scheduled-run.mjs';
import { testDatabase } from './database.ts';

const navajo = '/nations/navajo-nation';
const hopi = '/nations/hopi-tribe';

function page(address: string, fingerprint: string, title = address.split('/').pop() ?? address): FollowablePage {
	return { address, kind: 'nation', title, fingerprint };
}

function build(builtAt: string, pages: FollowablePage[], fingerprintVersion = 1): FollowableBuild {
	return { builtAt, buildHash: pages.map((entry) => `${entry.address}=${entry.fingerprint}`).join(';'), fingerprintVersion, pages };
}

let database: D1Database;
let reader: string;

beforeEach(async () => {
	database = testDatabase();
	reader = (await verifiedAccount(database, 'reader@example.org')).identifier;
});

describe('which pages can be followed', () => {
	it('takes nation pages, the model code and essays, by lasting address', () => {
		expect(followKindOf(navajo)).toBe('nation');
		expect(followKindOf('/code')).toBe('code');
		expect(followKindOf('/code/2.3')).toBe('code');
		expect(followKindOf('/essays/why-peacemaking')).toBe('essay');
		expect(followKindOf('/foundations/timeline')).toBe('essay');
		expect(followKindOf('/back-matter/cases-by-topic')).toBe('essay');
		expect(followKindOf('/news/welcome')).toBe('essay');
		expect(followKindOf('/news')).toBe('news');
		expect(historyAddress('news', '/news')).toBeUndefined();
		expect(historyAddress('essay', '/news/welcome')).toBe('/news/welcome/history');
	});

	it('refuses lists, maps, histories and anything else', () => {
		for (const address of ['/nations', '/nations/map', '/nations/letter', '/essays/x/history', '/glossary/peacemaking', '/', 'nations/x', null, 7]) {
			expect(followKindOf(address)).toBeUndefined();
		}
	});

	it('links to version history for essays, never for nations', () => {
		expect(hasPublicHistory('nation')).toBe(false);
		expect(historyAddress('nation', navajo)).toBeUndefined();
		expect(historyAddress('essay', '/essays/x')).toBe('/essays/x/history');
	});

	it('reads the state answer safely', () => {
		expect(readFollowState(null)).toEqual(signedOutState);
		expect(readFollowState({ signedIn: 'yes', following: true })).toEqual(signedOutState);
		expect(readFollowState({ signedIn: true, followable: true, following: true, unread: 3 })).toEqual({
			signedIn: true,
			followable: true,
			following: true,
			unread: 3
		});
		expect(readFollowState({ signedIn: true, unread: -2 }).unread).toBe(0);
		expect(unreadLabel(5)).toBe('5');
		expect(unreadLabel(250)).toBe('99+');
	});
});

describe('following and unfollowing', () => {
	const directory = pageDirectory(build('2026-11-23T00:00:00Z', [page(navajo, 'a')]), []);

	it('follows a page that is on the site, once', async () => {
		expect(await follow(database, reader, navajo, directory)).toBe('following');
		expect(await follow(database, reader, navajo, directory)).toBe('following');
		expect(await isFollowing(database, reader, navajo)).toBe(true);
		expect((await followedPages(database, reader, directory)).map((entry) => [entry.address, entry.title, entry.kind])).toEqual([
			[navajo, 'navajo-nation', 'nation']
		]);
	});

	it('refuses pages that are not on the site or cannot be followed', async () => {
		expect(await follow(database, reader, hopi, directory)).toBe('not-followable');
		expect(await follow(database, reader, '/glossary/x', directory)).toBe('not-followable');
	});

	it('stops following', async () => {
		await follow(database, reader, navajo, directory);
		await unfollow(database, reader, navajo);
		expect(await isFollowing(database, reader, navajo)).toBe(false);
	});

	it('forgets what an account follows, and its email setting, when the account is deleted', async () => {
		await follow(database, reader, navajo, directory);
		await setEmailChoice(database, reader, 'weekly');
		await database.prepare('DELETE FROM accounts WHERE identifier = ?').bind(reader).run();
		const left = await database.prepare('SELECT (SELECT COUNT(*) FROM follows) + (SELECT COUNT(*) FROM follow_settings) AS count').first<{ count: number }>();
		expect(left?.count).toBe(0);
	});

	it('shows a followed page that left the site without a title', async () => {
		await follow(database, reader, navajo, directory);
		const pages = await followedPages(database, reader, new Map());
		expect(pages[0].title).toBeUndefined();
		expect(pages[0].kind).toBe('nation');
	});
});

describe('finding updates to built pages', () => {
	it('records the first build without reporting anything', async () => {
		const first = build('2026-11-23T01:00:00Z', [page(navajo, 'a'), page(hopi, 'b')]);
		await follow(database, reader, navajo, pageDirectory(first, []));
		const result = await checkForUpdates(database, first, []);
		expect(result).toEqual({ comparedBuild: true, updates: 0 });
		expect(await noticesFor(database, reader)).toEqual([]);
	});

	it('reports a changed page that someone follows, once, and never an older build', async () => {
		const first = build('2026-11-23T01:00:00Z', [page(navajo, 'a'), page(hopi, 'b')]);
		await checkForUpdates(database, first, []);
		await follow(database, reader, navajo, pageDirectory(first, []));

		const second = build('2026-11-23T02:00:00Z', [page(navajo, 'a2'), page(hopi, 'b2')]);
		expect(await checkForUpdates(database, second, [], '2026-11-23T02:05:00Z')).toEqual({ comparedBuild: true, updates: 1 });
		// The same build again, from another copy of the Worker: nothing new.
		expect(await checkForUpdates(database, second, [])).toEqual({ comparedBuild: false, updates: 0 });
		// The old build, still answering during a deploy: ignored.
		expect(await checkForUpdates(database, first, [])).toEqual({ comparedBuild: false, updates: 0 });

		const notices = await noticesFor(database, reader);
		expect(notices.map((notice) => [notice.address, notice.kind, notice.updatedAt, notice.unread])).toEqual([
			[navajo, 'nation', '2026-11-23T02:05:00Z', true]
		]);
		// Only followed pages get updates.
		const { results } = await database.prepare('SELECT address FROM page_updates').all<{ address: string }>();
		expect(results.map((row) => row.address)).toEqual([navajo]);
	});

	it('stores no text or title with an update', async () => {
		const columns = await database.prepare(`SELECT name FROM pragma_table_info('page_updates')`).all<{ name: string }>();
		expect(columns.results.map((row) => row.name).sort()).toEqual(['address', 'identifier', 'kind', 'updated_at']);
	});

	it('does not report every page when the fingerprints are worked out differently', async () => {
		await checkForUpdates(database, build('2026-11-23T01:00:00Z', [page(navajo, 'a')]), []);
		await follow(database, reader, navajo, pageDirectory(build('x', [page(navajo, 'a')]), []));
		const result = await checkForUpdates(database, build('2026-11-23T02:00:00Z', [page(navajo, 'new-way')], 2), []);
		expect(result.updates).toBe(0);
		expect(await noticesFor(database, reader)).toEqual([]);
	});

	it('does not tell a new follower about updates from before they followed', async () => {
		const first = build('2026-11-23T01:00:00Z', [page(navajo, 'a')]);
		await checkForUpdates(database, first, []);
		const other = (await verifiedAccount(database, 'other@example.org')).identifier;
		await follow(database, other, navajo, pageDirectory(first, []));
		await checkForUpdates(database, build('2026-11-23T02:00:00Z', [page(navajo, 'b')]), []);
		await follow(database, reader, navajo, pageDirectory(first, []));
		expect(await noticesFor(database, reader)).toEqual([]);
		expect(await noticesFor(database, other)).toHaveLength(1);
	});

	it('forgets pages that left the site and starts afresh if they return', async () => {
		await checkForUpdates(database, build('2026-11-23T01:00:00Z', [page(navajo, 'a'), page(hopi, 'b')]), []);
		await checkForUpdates(database, build('2026-11-23T02:00:00Z', [page(navajo, 'a')]), []);
		const { results } = await database.prepare('SELECT address FROM page_fingerprints').all<{ address: string }>();
		expect(results.map((row) => row.address)).toEqual([navajo]);
	});
});

describe('notices', () => {
	it('counts unread notices and marks them read', async () => {
		const first = build('2026-11-23T01:00:00Z', [page(navajo, 'a'), page(hopi, 'b')]);
		await checkForUpdates(database, first, []);
		await follow(database, reader, navajo, pageDirectory(first, []));
		await follow(database, reader, hopi, pageDirectory(first, []));
		await checkForUpdates(database, build('2026-11-23T02:00:00Z', [page(navajo, 'a2'), page(hopi, 'b2')]), []);
		expect(await unreadCount(database, reader)).toBe(2);
		const notices = await noticesFor(database, reader);
		await markNoticesRead(database, reader, notices[0].identifier);
		expect(await unreadCount(database, reader)).toBe(0);
		expect((await noticesFor(database, reader)).every((notice) => !notice.unread)).toBe(true);
		// Marking an older point never brings notices back.
		await markNoticesRead(database, reader, 0);
		expect(await unreadCount(database, reader)).toBe(0);
	});
});

describe('essays', () => {
	function memoryBucket(): R2Bucket {
		const files = new Map<string, string>();
		return {
			async put(key: string, value: string) {
				files.set(key, value);
				return { key };
			},
			async head(key: string) {
				return files.has(key) ? { key } : null;
			},
			async get(key: string) {
				const value = files.get(key);
				return value === undefined ? null : { text: async () => value };
			}
		} as unknown as R2Bucket;
	}

	const essay = (words: string) => `---\ntitle: "Peacemaking today"\n---\n\n# Peacemaking today\n\n${words}\n`;

	it('reports a new publication of an essay someone follows, but not a republished copy of the same text', async () => {
		const bucket = memoryBucket();
		await database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
			.run();
		const empty = build('2026-11-23T01:00:00Z', []);
		await saveVersion(database, bucket, { identifier: 'peacemaking-today', text: essay('One.'), basedOn: null, personIdentifier: 'lead', origin: 'editor' });
		await publishVersion(database, 'peacemaking-today', 1, 'lead');
		await checkForUpdates(database, empty, await essayPages(database));
		const directory = pageDirectory(empty, await essayPages(database));
		expect(directory.get('/essays/peacemaking-today')).toEqual({ kind: 'essay', title: 'Peacemaking today' });
		await follow(database, reader, '/essays/peacemaking-today', directory);

		await publishVersion(database, 'peacemaking-today', 1, 'lead');
		expect((await checkForUpdates(database, empty, await essayPages(database))).updates).toBe(0);

		await saveVersion(database, bucket, { identifier: 'peacemaking-today', text: essay('Two.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor' });
		await publishVersion(database, 'peacemaking-today', 2, 'lead');
		expect((await checkForUpdates(database, empty, await essayPages(database))).updates).toBe(1);
		expect((await checkForUpdates(database, empty, await essayPages(database))).updates).toBe(0);
		expect((await noticesFor(database, reader)).map((notice) => notice.kind)).toEqual(['essay']);

		// Holding the new publication back puts the older text on the page: that is an update too.
		await setPublicationListed(database, 'peacemaking-today', 3, false, 'lead', 'Held back for a check');
		expect((await checkForUpdates(database, empty, await essayPages(database))).updates).toBe(1);
	});

	it('tells people who follow News about a new post, but not about a corrected one', async () => {
		const bucket = memoryBucket();
		await database
			.prepare(`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Lead', 'lead-author', 'active', '2026-11-22T00:00:00Z')`)
			.run();
		const post = (title: string, words: string) => `---\ntitle: "${title}"\npart: news\n---\n\n# ${title}\n\n${words}\n`;
		const empty = build('2026-11-23T01:00:00Z', []);
		await saveVersion(database, bucket, { identifier: 'welcome', text: post('Welcome', 'One.'), basedOn: null, personIdentifier: 'lead', origin: 'editor', part: 'news' });
		await publishVersion(database, 'welcome', 1, 'lead');
		await checkForUpdates(database, empty, await essayPages(database));
		const directory = pageDirectory(empty, await essayPages(database));
		expect(directory.get('/news')).toEqual({ kind: 'news', title: 'News' });
		await follow(database, reader, '/news', directory);

		// A corrected post is an update to the post, not to News.
		await saveVersion(database, bucket, { identifier: 'welcome', text: post('Welcome', 'One, corrected.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor' });
		await publishVersion(database, 'welcome', 2, 'lead');
		await checkForUpdates(database, empty, await essayPages(database));
		expect(await noticesFor(database, reader)).toEqual([]);

		await saveVersion(database, bucket, { identifier: 'second-post', text: post('Second', 'Two.'), basedOn: null, personIdentifier: 'lead', origin: 'editor', part: 'news' });
		await publishVersion(database, 'second-post', 1, 'lead');
		await checkForUpdates(database, empty, await essayPages(database));
		expect((await noticesFor(database, reader)).map((notice) => [notice.address, notice.kind])).toEqual([['/news', 'news']]);
	});
});

describe('summary emails', () => {
	async function oneUpdate(): Promise<ReturnType<typeof pageDirectory>> {
		const first = build('2026-11-23T01:00:00Z', [page(navajo, 'a', 'Navajo Nation')]);
		await checkForUpdates(database, first, []);
		await follow(database, reader, navajo, pageDirectory(first, []));
		const second = build('2026-11-23T02:00:00Z', [page(navajo, 'b', 'Navajo Nation')]);
		await checkForUpdates(database, second, [], '2026-11-23T02:00:00Z');
		return pageDirectory(second, []);
	}

	it('sends a daily summary by default, then waits a day', async () => {
		const directory = await oneUpdate();
		expect((await settingsFor(database, reader)).email).toBe('daily');
		const at = new Date('2026-11-23T03:00:00Z');
		const due = await dueDigests(database, directory, at);
		expect(due).toHaveLength(1);
		expect(due[0]).toMatchObject({ email: 'reader@example.org', choice: 'daily', pages: [{ address: navajo, title: 'Navajo Nation', kind: 'nation' }] });
		expect(due[0].emailOffToken).toMatch(/^[A-Za-z0-9_-]{40,}$/);
		await recordDigestSent(database, due[0], at);
		expect(await dueDigests(database, directory, new Date('2026-11-23T04:00:00Z'))).toEqual([]);
		// The token stays the same for later emails, so older links keep working.
		const again = await dueDigests(database, directory, new Date('2026-11-23T05:00:00Z'));
		expect(again).toEqual([]);
	});

	it('sends nothing to someone who chose no email, and the link in an email turns it off', async () => {
		const directory = await oneUpdate();
		const [digest] = await dueDigests(database, directory);
		expect(await turnOffEmailByToken(database, digest.emailOffToken)).toBe(true);
		expect((await settingsFor(database, reader)).email).toBe('off');
		expect(await dueDigests(database, directory)).toEqual([]);
		expect(await turnOffEmailByToken(database, 'not-a-real-token-at-all-000')).toBe(false);
		expect(await turnOffEmailByToken(database, "' OR 1=1 --")).toBe(false);
		await setEmailChoice(database, reader, 'weekly');
		expect((await settingsFor(database, reader)).email).toBe('weekly');
	});

	it('says only which page changed and when, with links', async () => {
		const directory = await oneUpdate();
		const [digest] = await dueDigests(database, directory);
		const message = digestMessage(digest, 'https://site.example');
		expect(message.subject).toBe('Updated: Navajo Nation');
		expect(message.text).toContain('Navajo Nation (Nation), updated Nov. 23, 2026');
		expect(message.text).toContain('https://site.example/nations/navajo-nation');
		expect(message.text).not.toContain('What changed');
		expect(message.text).toContain(`https://site.example/following/email-off?token=${digest.emailOffToken}`);
	});
});

describe('the email switch', () => {
	const binding = { send: vi.fn(async () => ({ messageId: 'm' })) };

	it('stays off until a sending address is set', () => {
		const environment = { updateEmail: binding, UPDATE_EMAIL_FROM: '', SITE_ADDRESS: 'https://site.example' } as unknown as WorkerEnvironment;
		expect(updateEmailDelivery(environment).kind).toBe('off');
	});

	it('needs an https site address for the links', () => {
		expect(siteAddress({ SITE_ADDRESS: 'https://site.example/' })).toBe('https://site.example');
		expect(siteAddress({ SITE_ADDRESS: 'http://site.example' })).toBeUndefined();
		expect(siteAddress({ SITE_ADDRESS: 'https://site.example/path' })).toBeUndefined();
		expect(siteAddress({ SITE_ADDRESS: '' })).toBeUndefined();
	});

	it('sends from the address once it is set, with a link to stop the emails', async () => {
		const environment = { updateEmail: binding, UPDATE_EMAIL_FROM: 'updates@site.example', SITE_ADDRESS: 'https://site.example' } as unknown as WorkerEnvironment;
		const delivery = updateEmailDelivery(environment);
		expect(delivery.kind).toBe('email');
		if (delivery.kind !== 'email') return;
		await delivery.send({
			accountIdentifier: 'a',
			email: 'reader@example.org',
			choice: 'weekly',
			upTo: 1,
			emailOffToken: 'token-token-token-token',
			pages: [{ address: '/essays/x', title: 'X', kind: 'essay', updatedAt: '2026-11-23T00:00:00Z' }]
		});
		expect(binding.send).toHaveBeenCalledWith(
			expect.objectContaining({
				to: 'reader@example.org',
				from: { email: 'updates@site.example', name: 'Tribal Law Project' },
				headers: { 'List-Unsubscribe': '<https://site.example/following/email-off?token=token-token-token-token>' },
				text: expect.stringContaining('What changed: https://site.example/essays/x/history')
			})
		);
	});
});

describe('the scheduled run', () => {
	it('uses the same token key and header in the tool and the Worker', () => {
		expect(toolKey).toBe(scheduledTokenKey);
		expect(toolHeader).toBe(scheduledTokenHeader);
		expect(entrySource()).toContain(scheduledTokenKey);
	});

	it('refuses requests without the token in memory', () => {
		const globals = globalThis as Record<string, unknown>;
		delete globals[scheduledTokenKey];
		expect(isScheduledRun(new Request('https://x/following/scheduled', { method: 'POST' }))).toBe(false);
		globals[scheduledTokenKey] = 'a'.repeat(64);
		expect(isScheduledRun(new Request('https://x/following/scheduled', { method: 'POST', headers: { [scheduledTokenHeader]: 'b'.repeat(64) } }))).toBe(false);
		expect(isScheduledRun(new Request('https://x/following/scheduled', { method: 'POST', headers: { [scheduledTokenHeader]: 'a'.repeat(64) } }))).toBe(true);
		delete globals[scheduledTokenKey];
	});
});

describe('fingerprints of nation pages', () => {
	it('fingerprints every published nation page, and a withdrawn page by its name and status only', () => {
		const result = buildFromContent(new Date('2026-11-23T00:00:00Z'));
		expect(result.pages.length).toBeGreaterThan(100);
		expect(result.pages.every((entry) => followKindOf(entry.address) === 'nation' && /^[0-9a-f]{32}$/.test(entry.fingerprint))).toBe(true);
		expect(new Set(result.pages.map((entry) => entry.address)).size).toBe(result.pages.length);
		expect(buildFromContent(new Date('2026-11-24T00:00:00Z')).buildHash).toBe(result.buildHash);
		const withdrawn = shownRecord({ id: 'x', names: { official: 'X' }, review: { status: 'withdrawn-at-request' }, extra: 'removed text' } as never);
		expect(JSON.stringify(withdrawn)).not.toContain('removed text');
	});
});
