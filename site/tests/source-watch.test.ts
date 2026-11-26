/**
 * The source watch's parts (docs/source-watch.md): robots.txt, schedules, the
 * host desk, matching against known records, the rules, the markup readers,
 * the page driver, reading a model's answer, and one whole run against a test
 * database.
 */
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import { describe, expect, it } from 'vitest';
import { mainText, readFeed, readSitemap, shortDifference } from '../src/lib/server/watch/drivers/markup.ts';
import { checkPage, type PageTexts } from '../src/lib/server/watch/drivers/page.ts';
import { newDeskState, reportAnswer, takeTicket } from '../src/lib/server/watch/host-desk.ts';
import { emptyKnownIdentifiers, lookupFor, matchKnown, nationsNamedIn, normalizeFederalRegisterNumber, normalizeLink, shortHash, type KnownIdentifiers } from '../src/lib/server/watch/known.ts';
import { costMicrodollars, dollars } from '../src/lib/server/watch/model-prices.ts';
import { outcomeOf } from '../src/lib/server/watch/model-triage.ts';
import { ComeBackLater, NotAllowed, politeFetch, type Desks } from '../src/lib/server/watch/polite-fetch.ts';
import { watchState, type WatchProgress } from '../src/lib/server/watch/progress.ts';
import { crawlDelaySeconds, mayFetch, modelMayRead, readRobots, robotsFromAnswer } from '../src/lib/server/watch/robots.ts';
import { applyRules } from '../src/lib/server/watch/rules.ts';
import { runWatcher } from '../src/lib/server/watch/run.ts';
import { isDue, nextDue, readSchedule } from '../src/lib/server/watch/schedule.ts';
import { candidateCounts, candidatesWithStatus, latestRuns, readCursor, type StoredCandidate } from '../src/lib/server/watch/store.ts';
import { chooseTriageProvider, readAnswer, type TriageAnswer } from '../src/lib/server/watch/triage.ts';
import { defineWatcher, watcherIsOn, type CheckContext, type FoundItem, type WatcherDefinition } from '../src/lib/server/watch/watcher.ts';
import ecfr, { itemFor as ecfrItem } from '../watch/watchers/ecfr.ts';
import federalRegister, { feedsFor, itemFor as federalRegisterItem } from '../watch/watchers/federal-register.ts';

import { testDatabase } from './database.ts';

describe('robots.txt', () => {
	const robots = readRobots(`# example
User-agent: *
Disallow: /search
Allow: /search/help$
Crawl-delay: 4

User-agent: ClaudeBot
Disallow: /

Content-Signal: search=yes, ai-train=no
`);

	it('follows the longest matching rule, with Allow winning a tie', () => {
		expect(mayFetch(robots, '/documents/1')).toBe(true);
		expect(mayFetch(robots, '/search?q=tribe')).toBe(false);
		expect(mayFetch(robots, '/search/help')).toBe(true);
		expect(mayFetch(robots, '/search/help/more')).toBe(false);
		expect(mayFetch(readRobots('User-agent: *\nDisallow: /a\nAllow: /a'), '/a')).toBe(true);
	});

	it('reads the crawl delay for the group that applies to us', () => {
		expect(crawlDelaySeconds(robots)).toBe(4);
	});

	it('keeps models away from hosts that signal against AI use or bar ClaudeBot', () => {
		expect(modelMayRead(robots, '/documents/1')).toBe(false);
		expect(modelMayRead(readRobots('User-agent: *\nDisallow:'), '/documents/1')).toBe(true);
		expect(modelMayRead(readRobots('User-agent: ClaudeBot\nDisallow: /codes/'), '/codes/1')).toBe(false);
	});

	it('treats an unreadable robots.txt as off-limits and a missing one as open (RFC 9309)', () => {
		expect(mayFetch(robotsFromAnswer(404, ''), '/anything')).toBe(true);
		expect(mayFetch(robotsFromAnswer(503, ''), '/anything')).toBe(false);
		expect(mayFetch(robotsFromAnswer(429, ''), '/anything')).toBe(false);
		expect(mayFetch(robotsFromAnswer(null, ''), '/anything')).toBe(false);
	});
});

describe('schedules', () => {
	it('reads five-field cron expressions in UTC', () => {
		expect(readSchedule('7 * * * 1-5')).not.toHaveProperty('problem');
		expect(readSchedule('61 * * * *')).toHaveProperty('problem');
		expect(readSchedule('* * *')).toHaveProperty('problem');
	});

	it('knows when a watcher is due', () => {
		expect(isDue('7 * * * 1-5', new Date('2026-11-26T15:07:00Z'))).toBe(true);
		expect(isDue('7 * * * 1-5', new Date('2026-11-28T15:07:00Z'))).toBe(false);
		expect(isDue('*/10 * * * *', new Date('2026-11-26T15:20:00Z'))).toBe(true);
		expect(nextDue('23 14 * * *', new Date('2026-11-26T15:00:00Z'))?.toISOString()).toBe('2026-11-27T14:23:00.000Z');
	});
});

describe('the host desk', () => {
	it('spaces requests to one host and holds the slot', () => {
		const state = newDeskState('www.federalregister.gov');
		const first = takeTicket(state, { path: '/api/v1/documents.json', longestWaitMilliseconds: 45_000 }, 1_000_000);
		const second = takeTicket(state, { path: '/api/v1/documents.json', longestWaitMilliseconds: 45_000 }, 1_000_000);
		expect(first).toMatchObject({ go: true, waitMilliseconds: 0 });
		expect(second).toMatchObject({ go: true, waitMilliseconds: 5_000 });
	});

	it('waits longer for a host that is not a government host', () => {
		const state = newDeskState('nation.example.org');
		takeTicket(state, { path: '/', longestWaitMilliseconds: 45_000 }, 0);
		expect(takeTicket(state, { path: '/', longestWaitMilliseconds: 45_000 }, 0)).toMatchObject({ go: true, waitMilliseconds: 30_000 });
		expect(takeTicket(state, { path: '/', longestWaitMilliseconds: 45_000 }, 0)).toMatchObject({ go: false });
	});

	it('refuses what robots.txt bars', () => {
		const state = newDeskState('example.gov');
		state.robots = readRobots('User-agent: *\nDisallow: /private');
		expect(takeTicket(state, { path: '/private/1', longestWaitMilliseconds: 45_000 }, 0)).toHaveProperty('refused');
	});

	it('backs off on 429, following Retry-After', () => {
		const state = newDeskState('example.gov');
		reportAnswer(state, 429, '120', 0);
		const ticket = takeTicket(state, { path: '/', longestWaitMilliseconds: 45_000 }, 0);
		expect(ticket).toMatchObject({ go: false, retryAt: 120_000 });
	});

	it('turns a desk that says wait into ComeBackLater, and one that says no into NotAllowed', async () => {
		const waiting: Desks = { ticket: async () => ({ go: false, retryAt: 5, reason: 'busy' }), report: async () => undefined };
		const refusing: Desks = { ticket: async () => ({ go: false, refused: 'barred' }), report: async () => undefined };
		await expect(politeFetch(waiting, 'https://example.gov/')).rejects.toBeInstanceOf(ComeBackLater);
		await expect(politeFetch(refusing, 'https://example.gov/')).rejects.toBeInstanceOf(NotAllowed);
	});

	it('names itself and sends the conditional headers', async () => {
		let heard: Headers | null = null;
		const desks: Desks = { ticket: async () => ({ go: true, waitMilliseconds: 0, modelMayRead: true }), report: async () => undefined };
		await politeFetch(desks, 'https://example.gov/page', { conditional: { entityTag: '"abc"', lastModified: 'Wed, 25 Nov 2026 10:00:00 GMT' } }, async (_address, init) => {
			heard = new Headers(init?.headers);
			return new Response('ok');
		});
		expect(heard!.get('user-agent')).toMatch(/^TribalLawProjectWatch\//);
		expect(heard!.get('if-none-match')).toBe('"abc"');
		expect(heard!.get('if-modified-since')).toBe('Wed, 25 Nov 2026 10:00:00 GMT');
	});
});

const index: KnownIdentifiers = {
	...emptyKnownIdentifiers,
	buildHash: 'test',
	sources: [
		{ key: 'pechanga-compact-2020', kind: 'intergovernmental-agreement', title: 'Tribal-State Compact Between the State of California and the Pechanga Band of Indians', link: 'https://www.example.gov/compacts/pechanga.pdf', checksum: shortHash('a'.repeat(64)) },
		{ key: 'recognized-2025', kind: 'federal-register-notice', title: 'Indian Entities Recognized by and Eligible To Receive Services', federalRegisterNumber: '2025-00001' }
	],
	nations: [
		{ identifier: 'pechanga', names: ['Pechanga Band of Indians'] },
		{ identifier: 'picayune', names: ['Picayune Rancheria of the Chukchansi Indians', 'Chukchansi'] }
	]
};

describe('matching against known records', () => {
	const lookup = lookupFor(index);

	it('normalizes links and Federal Register numbers', () => {
		expect(normalizeLink('http://WWW.Example.gov/a/#part')).toBe('https://example.gov/a');
		expect(normalizeFederalRegisterNumber('FR Doc. 2025-00001 Filed')).toBe('2025-00001');
		expect(normalizeLink('mailto:someone@example.org')).toBeUndefined();
	});

	it('closes what we already hold, and proposes a new version for a changed file at a known link', () => {
		expect(matchKnown(lookup, { title: 'x', federalRegisterNumber: '2025-00001' })).toMatchObject({ kind: 'same', record: 'recognized-2025' });
		expect(matchKnown(lookup, { title: 'x', sha256: 'A'.repeat(64) })).toMatchObject({ kind: 'same', record: 'pechanga-compact-2020' });
		expect(matchKnown(lookup, { title: 'x', link: 'https://example.gov/compacts/pechanga.pdf', sha256: 'b'.repeat(64) })).toMatchObject({ kind: 'new-version', record: 'pechanga-compact-2020' });
		expect(matchKnown(lookup, { title: 'Tribal-State Compact between the State of California and the Pechanga Band of Indians' })).toMatchObject({ kind: 'possible-duplicate' });
		expect(matchKnown(lookup, { title: 'Something new entirely' }).kind).toBe('none');
	});

	it('finds nations by name, preferring the longer name', () => {
		expect(nationsNamedIn(lookup, 'Indian Gaming; Extension of Tribal-State Class III Gaming Compact (Picayune Rancheria of the Chukchansi Indians)')).toEqual(['picayune']);
		expect(nationsNamedIn(lookup, 'Pechanga Band of Indians liquor ordinance')).toEqual(['pechanga']);
	});
});

function item(overrides: Partial<FoundItem> = {}): FoundItem {
	return { sourceIdentifier: 'one', kind: 'notice', title: 'Something', ...overrides };
}

function rulesFor(watcher: WatcherDefinition, found: FoundItem, options: { match?: ReturnType<typeof matchKnown>; nations?: string[]; restricted?: string[]; modelAvailable?: boolean } = {}) {
	return applyRules({
		watcher,
		item: found,
		match: options.match ?? { kind: 'none', record: null, reason: '' },
		nations: options.nations ?? [],
		restrictedNations: new Set(options.restricted ?? []),
		modelAvailable: options.modelAvailable ?? false,
		now: new Date('2026-11-26T12:00:00Z')
	});
}

describe('the rules', () => {
	it('sends a compact extension to review as a new version', () => {
		const outcome = rulesFor(federalRegister, item({ title: 'Indian Gaming; Extension of Tribal-State Class III Gaming Compact (Pechanga Band of Indians)' }));
		expect(outcome).toMatchObject({ status: 'to-review', proposed: 'new-version' });
		expect(outcome.feeds).toContain('intergovernmental-agreements');
	});

	it('closes routine notices', () => {
		expect(rulesFor(federalRegister, item({ title: 'Agency Information Collection Activities; Tribal Self-Governance' })).status).toBe('closed-by-rules');
	});

	it('closes what we already hold', () => {
		expect(rulesFor(federalRegister, item(), { match: { kind: 'same', record: 'x', reason: 'held' } }).status).toBe('closed-by-rules');
	});

	it('holds child and family matters, and items naming a nation that restricts its pages', () => {
		expect(rulesFor(federalRegister, item({ title: 'Indian Child Welfare Act Designated Tribal Agents for Service of Notice' })).status).toBe('held');
		expect(rulesFor(federalRegister, item({ title: 'A notice' }), { nations: ['pechanga'], restricted: ['pechanga'] }).sensitivity).toContain('nation-restriction');
	});

	it('leaves the middle band for a model only when one is available', () => {
		expect(rulesFor(federalRegister, item({ title: 'A notice about water' })).status).toBe('to-review');
		expect(rulesFor(federalRegister, item({ title: 'A notice about water' }), { modelAvailable: true }).status).toBe('waiting-for-model');
		expect(rulesFor(federalRegister, item({ title: 'A notice about water', noModelText: true }), { modelAvailable: true }).status).toBe('to-review');
	});

	it('closes editorial eCFR changes and reviews substantive ones', () => {
		const version = { date: '2026-10-08', amendment_date: '2026-10-08', issue_date: '2026-10-10', identifier: '136.14', name: '§ 136.14   Eligibility.', part: '136', substantive: true, removed: false, title: '42', type: 'section' };
		expect(ecfrItem(version)).toMatchObject({ title: '42 C.F.R. § 136.14 Eligibility.', link: 'https://www.ecfr.gov/current/title-42/section-136.14' });
		expect(rulesFor(ecfr, ecfrItem(version)).status).toBe('to-review');
		expect(rulesFor(ecfr, ecfrItem({ ...version, substantive: false })).status).toBe('closed-by-rules');
	});

	it('sorts Federal Register documents into collections by type', () => {
		expect(feedsFor({ document_number: '1', title: '', type: 'Presidential Document', subtype: 'Executive Order', publication_date: '2026-11-26' })).toEqual(['executive-orders']);
		expect(feedsFor({ document_number: '1', title: '', type: 'Rule', publication_date: '2026-11-26' })).toContain('federal-regulations');
		const found = federalRegisterItem({ document_number: '2026-12345', title: 'Rule', type: 'Rule', publication_date: '2026-11-26', pdf_url: 'https://www.govinfo.gov/x.pdf', cfr_references: [{ title: 25, part: '83' }] });
		expect(found.facts?.cfrParts).toEqual(['25 C.F.R. part 83']);
		expect(rulesFor(federalRegister, found).proposed).toBe('add');
	});
});

describe('markup', () => {
	it('reads RSS and Atom feeds', () => {
		const entries = readFeed('<rss><channel><item><title>A &amp; B</title><link>https://example.gov/a</link><pubDate>Wed, 25 Nov 2026 10:00:00 GMT</pubDate></item></channel></rss>');
		expect(entries[0]).toMatchObject({ title: 'A & B', link: 'https://example.gov/a' });
		const atom = readFeed('<feed><entry><title>C</title><link href="https://example.gov/c"/><updated>2026-11-25T10:00:00Z</updated></entry></feed>');
		expect(atom[0]).toMatchObject({ title: 'C', link: 'https://example.gov/c' });
	});

	it('reads sitemaps and sitemap indexes', () => {
		expect(readSitemap('<urlset><url><loc>https://example.gov/a</loc><lastmod>2026-11-25</lastmod></url></urlset>')).toMatchObject({ index: false, entries: [{ address: 'https://example.gov/a', lastModified: '2026-11-25' }] });
		expect(readSitemap('<sitemapindex><sitemap><loc>https://example.gov/s1.xml</loc></sitemap></sitemapindex>').index).toBe(true);
	});

	it('takes the main text of a page without menus, scripts or per-visit text', () => {
		const text = mainText('<html><head><script>var token = 1;</script></head><body><nav>Home</nav><main><h1>Code</h1><p>Section 1. Peace.</p></main><footer>Printed today</footer></body></html>');
		expect(text).toContain('Section 1. Peace.');
		expect(text).not.toContain('Home');
		expect(text).not.toContain('token');
		expect(text).not.toContain('Printed today');
	});

	it('shows a short difference', () => {
		const difference = shortDifference('Section 1. Peace.\nSection 2. Courts.', 'Section 1. Peace.\nSection 2. Peacemaking courts.');
		expect(difference).toContain('Peacemaking');
	});
});

function memoryBucket(): R2Bucket & { objects: Map<string, ArrayBuffer | string> } {
	const objects = new Map<string, ArrayBuffer | string>();
	const bucket = {
		objects,
		head: async (key: string) => (objects.has(key) ? { key, customMetadata: {} } : null),
		get: async (key: string) => {
			const value = objects.get(key);
			if (value === undefined) return null;
			return { text: async () => (typeof value === 'string' ? value : new TextDecoder().decode(value)), json: async () => JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value)) };
		},
		put: async (key: string, value: ArrayBuffer | string) => {
			objects.set(key, value);
			return { key };
		}
	};
	return bucket as unknown as R2Bucket & { objects: Map<string, ArrayBuffer | string> };
}

const openDesks: Desks = { ticket: async () => ({ go: true, waitMilliseconds: 0, modelMayRead: true }), report: async () => undefined };

describe('the page driver', () => {
	it('notes a page on the first visit, then reports a change with its difference', async () => {
		const database = testDatabase();
		const bucket = memoryBucket();
		const texts: Map<string, string> = new Map();
		const pageTexts: PageTexts = { read: async (key) => texts.get(key) ?? null, write: async (key, text) => void texts.set(key, text) };
		let body = '<main><p>Section 1. Peace.</p></main>';
		const { pageMemory } = await import('../src/lib/server/watch/store.ts');
		const { storeCapture } = await import('../src/lib/server/watch/capture.ts');
		const context = (): CheckContext => ({
			cursor: null,
			now: new Date('2026-11-26T12:00:00Z'),
			fetch: (address, options) => politeFetch(openDesks, address, options, async () => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })),
			known: async () => index,
			keep: (sourceIdentifier, file) => storeCapture(bucket, database, 'test', sourceIdentifier, file, new Date('2026-11-26T12:00:00Z')),
			pages: pageMemory(database, 'test'),
			pageTexts,
			note: () => undefined
		});
		expect((await checkPage(context(), 'test', { address: 'https://nation.example.org/code', title: 'Code' })).outcome).toBe('first-visit');
		expect((await checkPage(context(), 'test', { address: 'https://nation.example.org/code', title: 'Code' })).outcome).toBe('unchanged');
		body = '<main><p>Section 1. Peace and peacemaking.</p></main>';
		const changed = await checkPage(context(), 'test', { address: 'https://nation.example.org/code', title: 'Code' });
		expect(changed.outcome).toBe('changed');
		if (changed.outcome !== 'changed') return;
		expect(changed.item.change?.difference).toContain('peacemaking');
		expect(changed.item.capture?.key).toMatch(/^watch\/captures\/test\//);
		expect(bucket.objects.has(changed.item.capture?.key ?? '')).toBe(true);
	});
});

describe('triage by model', () => {
	it('reads the classify tool and prices the call', () => {
		const { answer, use } = readAnswer({
			content: [{ type: 'tool_use', name: 'classify', input: { relevant: true, collection: 'tribal-codes', nations: ['Pechanga Band of Indians'], proposed: 'add', hard: false, sensitivity: ['made-up'], confidence: 1.4, reason: 'A liquor ordinance.' } }],
			usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 2000, cache_creation_input_tokens: 0 }
		});
		expect(answer).toMatchObject({ relevant: true, collection: 'tribal-codes', proposed: 'add', sensitivity: [], confidence: 1 });
		// 1,000 × $0.10 + 2,000 × $0.01 + 100 × $0.50 per million = $0.00017.
		expect(costMicrodollars('anthropic/claude-haiku-5.5', use)).toBe(170);
		expect(dollars(170)).toBe('$0.0002');
		expect(() => readAnswer({ content: [{ type: 'text' }] })).toThrow();
	});

	it('stays off until a provider is named and bound', () => {
		expect(chooseTriageProvider({}).ready).not.toBe(true);
		expect(chooseTriageProvider({ WATCH_TRIAGE_PROVIDER: 'ai-gateway' }).ready).not.toBe(true);
		expect(chooseTriageProvider({ WATCH_TRIAGE_PROVIDER: 'ai-gateway', modelGateway: { run: async () => ({}) } }).ready).toBe(true);
	});

	it('holds an item the model flags, and closes one it is sure is not relevant', () => {
		const current = { nations: [], feeds: [], sensitivity: [] } as unknown as StoredCandidate;
		const answer: TriageAnswer = { relevant: false, collection: 'none', nations: [], proposed: 'not-relevant', hard: false, sensitivity: [], confidence: 0.95, reason: '' };
		expect(outcomeOf(answer, null, current).status).toBe('closed-by-rules');
		expect(outcomeOf({ ...answer, confidence: 0.6 }, null, current).status).toBe('to-review');
		expect(outcomeOf({ ...answer, sensitivity: ['protection-order'] }, null, current).status).toBe('held');
	});
});

describe('a whole run', () => {
	const watcher = defineWatcher({
		identifier: 'test-watcher',
		title: 'Test',
		tier: 1,
		feeds: ['federal-register-notices'],
		driver: 'api',
		schedule: '* * * * *',
		hosts: ['example.gov'],
		hosting: 'serve',
		documentation: ['https://example.gov/'],
		async check(context) {
			return {
				cursor: '2026-11-26',
				items: [
					{ sourceIdentifier: '2026-1', kind: 'notice', title: 'Indian Gaming; Extension of Tribal-State Class III Gaming Compact (Pechanga Band of Indians)', fileAddress: 'https://example.gov/2026-1.pdf', facts: { documentNumber: '2026-1' } },
					{ sourceIdentifier: '2026-2', kind: 'notice', title: 'Agency Information Collection Activities; Something', fileAddress: 'https://example.gov/2026-2.pdf' },
					{ sourceIdentifier: '2026-3', kind: 'notice', title: 'Indian Entities Recognized', facts: { documentNumber: '2025-00001' } }
				].map((found) => ({ ...found, feeds: ['federal-register-notices'] })) as FoundItem[],
				more: context.cursor === 'never'
			};
		}
	});

	it('writes candidates, keeps and scans the file only for items the rules did not close, and moves the cursor', async () => {
		const database = testDatabase();
		const bucket = memoryBucket();
		const fetched: string[] = [];
		const report = await runWatcher(watcher, 'test-watcher-1', {
			database,
			bucket,
			desks: openDesks,
			known: async () => index,
			modelAvailable: false,
			fetcher: async (address) => {
				fetched.push(String(address));
				return new Response(new Uint8Array([37, 80, 68, 70]), { headers: { 'content-type': 'application/pdf' } });
			},
			now: () => new Date('2026-11-26T12:00:00Z')
		});
		expect(report).toMatchObject({ outcome: 'finished', found: 3, newItems: 3, closedByRules: 2, toReview: 1 });
		expect(fetched).toEqual(['https://example.gov/2026-1.pdf']);
		const [candidate] = await candidatesWithStatus(database, ['to-review']);
		expect(candidate).toMatchObject({ sourceIdentifier: '2026-1', proposed: 'new-version', nations: ['pechanga'] });
		expect(candidate.captureKey).toMatch(/^watch\/captures\/test-watcher\/2026\//);
		const scan = await database.prepare('SELECT purpose, status FROM file_scans WHERE object_key = ?').bind(candidate.captureKey).first();
		expect(scan).toEqual({ purpose: 'watch-capture', status: 'waiting' });
		expect(await readCursor(database, 'test-watcher')).toBe('2026-11-26');
		expect((await candidateCounts(database))['closed-by-rules']).toBe(2);
		expect((await latestRuns(database))[0]).toMatchObject({ watcher: 'test-watcher', outcome: 'finished' });

		// Finding the same items again adds nothing.
		const again = await runWatcher(watcher, 'test-watcher-2', { database, bucket, desks: openDesks, known: async () => index, modelAvailable: false, fetcher: async () => new Response('') });
		expect(again.newItems).toBe(0);
	});

	it('leaves the cursor where it was when a host asks us to wait', async () => {
		const database = testDatabase();
		const waiting: Desks = { ticket: async () => ({ go: false, retryAt: 0, reason: 'example.gov asked us to wait' }), report: async () => undefined };
		const failing = defineWatcher({ ...watcher, check: async (context) => (await context.fetch('https://example.gov/api'), { items: [], cursor: 'moved' }) });
		const report = await runWatcher(failing, 'test-watcher-3', { database, bucket: memoryBucket(), desks: waiting, known: async () => index, modelAvailable: false });
		expect(report.outcome).toBe('come-back-later');
		expect(await readCursor(database, 'test-watcher')).toBeNull();
	});
});

describe('the watch Worker', () => {
	it('turns watchers on and off by setting', () => {
		const search = { ...federalRegister, identifier: 'federal-register-search', enabled: { off: 'Off until model triage runs.' } } as WatcherDefinition;
		expect(watcherIsOn(search, {}).on).toBe(false);
		expect(watcherIsOn(search, { WATCH_TURN_ON: 'ecfr, federal-register-search' }).on).toBe(true);
		expect(watcherIsOn(federalRegister, { WATCH_TURN_OFF: 'federal-register' }).on).toBe(false);
	});

	it('says when the Worker stopped running', () => {
		const progress = { lastTick: '2026-11-26T12:00:00Z', watchers: { a: { enabled: true } }, models: { provider: 'none', ready: false } } as unknown as WatchProgress;
		expect(watchState(progress, new Date('2026-11-26T12:02:00Z')).state).toBe('running');
		expect(watchState(progress, new Date('2026-11-26T12:20:00Z')).state).toBe('not-running');
		expect(watchState(null, new Date()).state).toBe('not-running');
	});
});
