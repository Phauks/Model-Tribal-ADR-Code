import type { D1Database, R2Bucket } from '@cloudflare/workers-types/index.ts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
	byPage,
	changeIdentifier,
	defaultFilters,
	filterQuery,
	followedPageAddress,
	pageAddressOfFile,
	pageChangesLink,
	pageOfChangesView,
	parseChangeIdentifier,
	readFilters,
	sizeChangeText,
	wordingIsShown,
	type HistoryBuild,
	type HistoryPage
} from '#lib/page-history.ts';
import { essayPath, publishVersion, saveVersion, setPublicationListed } from '#lib/server/essays.ts';
import {
	attachCommits,
	htmlText,
	keyLabel,
	parseNamedLog,
	partHashes,
	plainMarkup,
	recordText
} from '#lib/server/page-history-build.ts';
import {
	changeDetail,
	changeForHiding,
	changedParts,
	compareVersions,
	directoryOf,
	hideChange,
	listChanges,
	pageHistorySummary,
	pageRecordedSince,
	recordBuildChanges,
	showChange,
	summaryOf,
	versionText
} from '#lib/server/page-history.ts';
import { testDatabase } from './database.ts';

function memoryBucket(): R2Bucket & { files: Map<string, string> } {
	const files = new Map<string, string>();
	return {
		files,
		async put(key: string, value: string, options?: { onlyIf?: Headers }) {
			if (options?.onlyIf?.get('If-None-Match') === '*' && files.has(key)) return null;
			files.set(key, value);
			return { key };
		},
		async get(key: string) {
			const value = files.get(key);
			return value === undefined ? null : { text: async () => value };
		}
	} as unknown as R2Bucket & { files: Map<string, string> };
}

function glossaryPage(id: string, text: string, commits: number[] = []): HistoryPage {
	return {
		address: `/glossary/${id}`,
		kind: 'glossary',
		title: id,
		fingerprint: `f-${text.length}-${text.charCodeAt(text.length - 1)}`,
		text,
		bytes: new TextEncoder().encode(text).length,
		commits
	};
}

function nationPage(id: string, parts: Record<string, string>, commits: number[] = []): HistoryPage {
	return {
		address: `/nations/${id}`,
		kind: 'nation',
		title: id.replace(/-/g, ' '),
		fingerprint: Object.values(parts).join(''),
		parts,
		commits
	};
}

function build(builtAt: string, pages: HistoryPage[], commits: HistoryBuild['commits'] = []): HistoryBuild {
	return {
		builtAt,
		buildHash: pages.map((page) => `${page.address}=${page.fingerprint}`).join(';'),
		fingerprintVersion: 1,
		commits,
		pages
	};
}

const all = { ...defaultFilters, days: 0, showBulk: true };

let database: D1Database;
let bucket: ReturnType<typeof memoryBucket>;

beforeEach(async () => {
	database = testDatabase();
	bucket = memoryBucket();
	await database
		.prepare(
			`INSERT INTO people (identifier, email, display_name, role, status, added_at) VALUES ('lead', 'l@example.org', 'Trevor Goldsmith', 'lead-author', 'active', '2026-11-22T00:00:00Z')`
		)
		.run();
});

describe('shared rules', () => {
	it('names changes and reads the names back, including essays whose names end in a number', () => {
		expect(changeIdentifier({ source: 'page', identifier: 12 })).toBe('page-12');
		expect(parseChangeIdentifier('page-12')).toEqual({ source: 'page', identifier: 12 });
		expect(parseChangeIdentifier('essay-i-legal-history-timeline-14')).toEqual({ source: 'essay', essay: 'i-legal-history-timeline', number: 14 });
		expect(parseChangeIdentifier('essay-part-2-3')).toEqual({ source: 'essay', essay: 'part-2', number: 3 });
		for (const bad of ['page-0', 'page-x', 'essay--1', "page-1' OR 1=1", '', null]) expect(parseChangeIdentifier(bad)).toBeUndefined();
	});

	it('never shows earlier wording of nation pages or stories', () => {
		expect(wordingIsShown('nation')).toBe(false);
		expect(wordingIsShown('story')).toBe(false);
		expect(wordingIsShown('glossary')).toBe(true);
		expect(wordingIsShown('essays')).toBe(true);
	});

	it('reads filters from the address and writes only what differs from the defaults', () => {
		const filters = readFilters(new URLSearchParams('kind=nation&kind=bogus&who=site&days=7&size=500&change=edit&bulk=1&group=0&limit=250'));
		expect(filters).toMatchObject({ kinds: ['nation'], who: 'site', days: 7, size: 500, changes: ['edit'], showBulk: true, group: false, limit: 250 });
		expect(filterQuery(filters)).toBe('?kind=nation&who=site&days=7&size=500&change=edit&bulk=1&group=0&limit=250');
		expect(filterQuery(readFilters(new URLSearchParams('')))).toBe('');
		// The form sends group=0 from a hidden field and group=1 when the box is ticked.
		expect(readFilters(new URLSearchParams('group=0&group=1')).group).toBe(true);
		expect(readFilters(new URLSearchParams('days=13&size=-5&limit=9999')).days).toBe(30);
	});

	it('reads the Page, Hidden changes and Only pages I follow filters, and the Hide bulk updates switch', () => {
		const filters = readFilters(new URLSearchParams('title=%20Navajo%20%20Nation%20&hidden=1&follow=1'));
		expect(filters).toMatchObject({ title: 'Navajo Nation', hidden: true, following: true });
		expect(filterQuery(filters)).toBe('?title=Navajo+Nation&hidden=1&follow=1');
		// The switch sends bulk=0 after a hidden bulk=1 when on; off, only bulk=1 arrives.
		expect(readFilters(new URLSearchParams('bulk=1&bulk=0')).showBulk).toBe(false);
		expect(readFilters(new URLSearchParams('bulk=1')).showBulk).toBe(true);
		// One page's history has no title or following filter.
		expect(readFilters(new URLSearchParams('page=/glossary/adr&title=x&follow=1'))).toMatchObject({ title: undefined, following: false });
	});

	it('takes only addresses on this site as a page filter', () => {
		expect(readFilters(new URLSearchParams('page=/nations/navajo-nation')).page).toBe('/nations/navajo-nation');
		for (const bad of ['https://example.org/x', '//evil.example', '/nations/<script>', 'nations/x']) {
			expect(readFilters(new URLSearchParams({ page: bad })).page).toBeUndefined();
		}
		// A page's history reaches back to its first change.
		expect(readFilters(new URLSearchParams('page=/glossary/adr')).days).toBe(0);
	});

	it('offers "Changes to this page" only on pages whose changes are recorded', () => {
		expect(followedPageAddress('/nations/navajo-nation')).toBe('/nations/navajo-nation');
		expect(followedPageAddress('/glossary/mediation/')).toBe('/glossary/mediation');
		expect(followedPageAddress('/essays/peacemaking')).toBe('/essays/peacemaking');
		expect(followedPageAddress('/charter')).toBe('/charter');
		expect(followedPageAddress('/about')).toBe('/about');
		for (const listing of ['/nations', '/nations/map', '/nations/recourse', '/nations/letter/a', '/changes', '/workspace/changes', '/', '/search']) {
			expect(followedPageAddress(listing)).toBeUndefined();
		}
	});

	it('lists a page’s changes in the page’s own place, keeping its side column', () => {
		expect(pageChangesLink('/nations/karuk-tribe')).toBe('/nations/karuk-tribe/changes');
		expect(pageChangesLink('/glossary/mediation')).toBe('/glossary/mediation/changes');
		expect(pageChangesLink('/licenses')).toBe('/licenses/changes');
		// Anything else, such as an address the site does not follow, stays on Recent changes.
		expect(pageChangesLink('/code/section-1')).toBe('/changes?page=%2Fcode%2Fsection-1');
		expect(pageOfChangesView('/nations/karuk-tribe/changes')).toBe('/nations/karuk-tribe');
		expect(pageOfChangesView('/about/changes/')).toBe('/about');
		for (const path of ['/changes', '/nations/changes', '/nations/map/changes', '/nations/karuk-tribe', '/workspace/changes', '/a/b/c/changes']) {
			expect(pageOfChangesView(path)).toBeUndefined();
		}
	});

	it('shows sizes the way a wiki does', () => {
		expect(sizeChangeText(1204)).toBe('+1,204');
		expect(sizeChangeText(-88)).toBe('−88');
		expect(sizeChangeText(0)).toBe('0');
	});

	it('gathers a day’s changes by page', () => {
		const groups = byPage([{ address: '/a' }, { address: '/b' }, { address: '/a' }]);
		expect(groups.map((group) => [group.address, group.items.length])).toEqual([
			['/a', 2],
			['/b', 1]
		]);
	});

	it('finds the page a content file is built into', () => {
		expect(pageAddressOfFile('content/tribes/n/navajo-nation.yaml')).toBe('/nations/navajo-nation');
		expect(pageAddressOfFile('content/stories/c/cherokee-nation-reunification-1839.yaml')).toBe('/stories/cherokee-nation-reunification-1839');
		expect(pageAddressOfFile('content/glossary/adr.yaml')).toBe('/glossary/adr');
		expect(pageAddressOfFile('content/sources/a/x.yaml')).toBeUndefined();
	});
});

describe('what the build lists', () => {
	it('turns a record into readable paragraphs without the site’s markup', () => {
		const text = plainMarkup(recordText('ADR', { kind: 'acronym', definition: 'Not [[peacemaking]] [@narf].', see_also: ['peacemaking'], usage_note: 'Write it out.' }));
		expect(text).toBe('# ADR\n\nKind: acronym\n\nDefinition: Not peacemaking.\n\nSee also: peacemaking\n\nUsage note: Write it out.');
		expect(keyLabel('fullText')).toBe('Full text');
	});

	it('reads a rendered page as paragraphs, without citation marks', () => {
		expect(htmlText('<h2>Thanks</h2><p>To the <a href="/x">Moapa</a> Band&nbsp;<sup class="citation">1</sup>.</p><ul><li>One</li></ul>')).toBe(
			'## Thanks\n\nTo the Moapa Band .\n\n- One'
		);
	});

	it('hashes parts of a page by the names readers know, merging keys shown together', () => {
		const parts = partHashes({ entity_type: 'a', recognition: 'b', contacts: 'c' }, { entity_type: 'Recognition', recognition: 'Recognition', contacts: 'Contacts' });
		expect(Object.keys(parts)).toEqual(['Recognition', 'Contacts']);
	});

	it('matches merged changes to the pages they touched, and marks big ones as bulk', () => {
		const log = '\x1e2026-11-23T01:00:00+00:00\tfeat(content): add a term (#5)\n\ncontent/glossary/adr.yaml\ncontent/documents/n/navajo-nation-constitution.yaml\n\x1e2026-11-22T01:00:00+00:00\tchore: not a pull request\n\ncontent/glossary/adr.yaml\n';
		const commits = parseNamedLog(log);
		expect(commits).toEqual([
			{ merged: '2026-11-23T01:00:00+00:00', title: 'Add a term', files: ['content/glossary/adr.yaml', 'content/documents/n/navajo-nation-constitution.yaml'] }
		]);
		const pages = [glossaryPage('adr', 'x'), nationPage('navajo-nation', { Contacts: 'a' })];
		const listed = attachCommits(pages, commits, new Map([['content/documents/n/navajo-nation-constitution.yaml', ['/nations/navajo-nation']]]));
		expect(listed).toEqual([{ title: 'Add a term', merged: '2026-11-23T01:00:00+00:00', bulk: false }]);
		expect(pages.map((page) => page.commits)).toEqual([[0], [0]]);
	});
});

describe('recording the changes a build brings', () => {
	const directory = directoryOf(build('2026-11-23T00:00:00Z', [nationPage('navajo-nation', { Contacts: 'a' })]));

	it('names the parts that changed, and summarizes merged changes', () => {
		expect(changedParts({ Contacts: 'a', Courts: 'b', Gaming: 'c' }, { Contacts: 'a', Courts: 'x', Languages: 'y' })).toEqual(['Courts', 'Languages', 'Gaming']);
		expect(summaryOf([])).toBeNull();
		expect(summaryOf(['A', 'B', 'A', 'C', 'D'].map((title) => ({ title, merged: '', bulk: false })))).toBe('A; B; C; and 1 more');
	});

	it('only records the pages the first time, then records new, changed and removed pages', async () => {
		const first = build('2026-11-23T00:00:00Z', [glossaryPage('adr', 'One.'), nationPage('navajo-nation', { Contacts: 'a', Courts: 'b' })]);
		expect(await recordBuildChanges(database, bucket, first)).toEqual({ compared: true, recorded: 0 });
		expect((await listChanges(database, all, directory)).changes).toEqual([]);
		// The first version's text is kept, so the first change can be compared with it.
		expect([...bucket.files.keys()]).toEqual(['page-versions/glossary/adr/f-4-46.txt']);

		const commits = [{ title: 'Update the courts', merged: '2026-11-23T05:00:00Z', bulk: false }];
		const second = build(
			'2026-11-23T06:00:00Z',
			[glossaryPage('adr', 'One. Two.', [0]), glossaryPage('arbitration', 'New.'), nationPage('navajo-nation', { Contacts: 'a', Courts: 'c' }, [0])],
			commits
		);
		expect(await recordBuildChanges(database, bucket, second, '2026-11-23T06:01:00Z')).toEqual({ compared: true, recorded: 3 });
		// The same build again, or an older one, records nothing.
		expect((await recordBuildChanges(database, bucket, second)).compared).toBe(false);
		expect((await recordBuildChanges(database, bucket, first)).compared).toBe(false);

		const list = await listChanges(database, all, directoryOf(second));
		const byAddress = Object.fromEntries(list.changes.map((change) => [change.address, change]));
		expect(byAddress['/glossary/adr']).toMatchObject({ change: 'edit', sizeChange: 5, size: 9, summary: 'Update the courts', who: 'Site release', comparable: true, madeAt: '2026-11-23T05:00:00Z' });
		expect(byAddress['/glossary/arbitration']).toMatchObject({ change: 'new', title: 'arbitration', madeAt: '2026-11-23T06:00:00Z' });
		expect(byAddress['/nations/navajo-nation']).toMatchObject({ change: 'edit', parts: ['Courts'], sizeChange: undefined, comparable: false, title: 'navajo nation' });

		const third = build('2026-11-23T08:00:00Z', [glossaryPage('adr', 'One. Two.', [0]), glossaryPage('arbitration', 'New.')], commits);
		await recordBuildChanges(database, bucket, third);
		const removed = (await listChanges(database, { ...all, changes: ['removed'] }, directoryOf(third))).changes;
		// The Page filter finds pages by words in their title, and a page that is gone by the title its change kept.
		const titled = await listChanges(database, { ...all, title: 'ARBITR' }, directoryOf(third));
		expect(titled.changes.map((change) => change.address)).toEqual(['/glossary/arbitration']);
		expect(titled.total).toBe(1);
		// Only pages I follow: none for a reader who is not signed in.
		expect((await listChanges(database, { ...all, following: true }, directoryOf(third))).changes).toEqual([]);
		// A nation page that is gone keeps no title of its own.
		expect(removed).toMatchObject([{ address: '/nations/navajo-nation', change: 'removed', title: undefined, parts: [] }]);
	});

	it('knows when the history of a page with no changes began, so its history is never empty', async () => {
		const first = build('2026-11-23T00:00:00Z', [nationPage('hopi-tribe', { Contacts: 'a' })]);
		await recordBuildChanges(database, bucket, first, '2026-11-23T03:49:00Z');
		expect((await listChanges(database, { ...all, page: '/nations/hopi-tribe' }, directoryOf(first))).changes).toEqual([]);
		expect(await pageRecordedSince(database, '/nations/hopi-tribe')).toBe('2026-11-23T03:49:00Z');
		// A page the history does not follow has no start.
		expect(await pageRecordedSince(database, '/about')).toBeUndefined();
	});

	it('sums up a page’s history for its badge: how many changes and the newest', async () => {
		const first = build('2026-11-23T00:00:00Z', [nationPage('navajo-nation', { Contacts: 'a', Courts: 'b' })]);
		await recordBuildChanges(database, bucket, first, '2026-11-23T03:49:00Z');
		expect(await pageHistorySummary(database, '/nations/navajo-nation')).toEqual({ count: 0, latest: undefined, recordedSince: '2026-11-23T03:49:00Z' });

		const commits = [{ title: 'Update the courts', merged: '2026-11-23T05:00:00Z', bulk: false }];
		const second = build('2026-11-23T06:00:00Z', [nationPage('navajo-nation', { Contacts: 'a', Courts: 'c' }, [0])], commits);
		await recordBuildChanges(database, bucket, second, '2026-11-23T06:01:00Z');
		const summary = await pageHistorySummary(database, '/nations/navajo-nation');
		expect(summary).toMatchObject({ count: 1, recordedSince: undefined, latest: { change: 'edit', parts: ['Courts'], who: 'Site release' } });
	});

	it('compares two versions of a page, and refuses to show hidden text', async () => {
		await recordBuildChanges(database, bucket, build('2026-11-23T00:00:00Z', [glossaryPage('adr', 'One.')]));
		await recordBuildChanges(database, bucket, build('2026-11-23T01:00:00Z', [glossaryPage('adr', 'One.\n\nTwo.')]));
		await recordBuildChanges(database, bucket, build('2026-11-23T02:00:00Z', [glossaryPage('adr', 'One.\n\nThree.')]));
		const pageDirectory = directoryOf(build('2026-11-23T02:00:00Z', [glossaryPage('adr', 'One.\n\nThree.')]));
		const [newest, older] = (await listChanges(database, all, pageDirectory)).changes;

		const detail = await changeDetail(database, bucket, newest.id, pageDirectory);
		expect(detail?.comparison).toMatchObject({ kind: 'compared', beforeId: older.id });
		expect(detail?.older).toBe(older.id);
		expect((await compareVersions(database, bucket, newest.id, older.id, pageDirectory))?.from.id).toBe(older.id);

		expect(await hideChange(database, 'lead', older.id, { text: true, summary: true, person: false, reason: 'nation-request' }, 'Request 42')).toBe(true);
		const [shownNewest, shownOlder] = (await listChanges(database, all, pageDirectory)).changes;
		expect(shownOlder).toMatchObject({ textHidden: true, summaryHidden: true, summary: undefined, sizeChange: undefined, comparable: false, hiddenReason: 'Hidden at a nation’s request' });
		expect(shownNewest.textHidden).toBe(false);
		// The hidden text is the "before" of the next change, so that cannot be compared either.
		expect((await changeDetail(database, bucket, newest.id, pageDirectory))?.comparison.kind).toBe('earlier-hidden');
		expect((await changeDetail(database, bucket, older.id, pageDirectory))?.comparison.kind).toBe('hidden');
		expect((await compareVersions(database, bucket, newest.id, older.id, pageDirectory))?.comparison.kind).toBe('hidden');
		expect((await versionText(database, bucket, older.id, pageDirectory))?.text).toBeUndefined();
		// The size filter does not reveal a hidden change's size.
		expect((await listChanges(database, { ...all, size: 1 }, pageDirectory)).changes.map((change) => change.id)).toEqual([newest.id]);

		// The lead author still sees it, and the activity log records the hiding.
		expect((await changeForHiding(database, older.id, pageDirectory))?.change.textHidden).toBe(false);
		const logged = await database.prepare(`SELECT action, note FROM events WHERE target_identifier = ?`).bind(older.id).all<{ action: string; note: string }>();
		expect(logged.results).toEqual([{ action: 'hid-change', note: 'Hid the text, summary (Hidden at a nation’s request). Request 42' }]);

		await showChange(database, 'lead', older.id, null);
		expect((await changeDetail(database, bucket, newest.id, pageDirectory))?.comparison.kind).toBe('compared');
	});

	it('never shows earlier wording of a nation page, even through compare', async () => {
		await recordBuildChanges(database, bucket, build('2026-11-23T00:00:00Z', [nationPage('hopi-tribe', { Contacts: 'a' })]));
		await recordBuildChanges(database, bucket, build('2026-11-23T01:00:00Z', [nationPage('hopi-tribe', { Contacts: 'b' })]));
		await recordBuildChanges(database, bucket, build('2026-11-23T02:00:00Z', [nationPage('hopi-tribe', { Contacts: 'c' })]));
		const [newest, older] = (await listChanges(database, all, directory)).changes;
		expect((await changeDetail(database, bucket, newest.id, directory))?.comparison.kind).toBe('parts');
		expect((await compareVersions(database, bucket, newest.id, older.id, directory))?.comparison.kind).toBe('parts');
		expect((await versionText(database, bucket, newest.id, directory))?.text).toBeUndefined();
		expect(bucket.files.size).toBe(0);
	});
});

describe('essays in Recent changes', () => {
	const essay = (title: string, words: string) => `---\ntitle: "${title}"\npart: i\n---\n\n# ${title}\n\n${words}\n`;

	it('lists each publication at the essay’s address, held-back ones struck through', async () => {
		await saveVersion(database, bucket, { identifier: 'i-legal-history-timeline', text: essay('Timeline', 'One.'), basedOn: null, personIdentifier: 'lead', origin: 'editor', note: 'First' });
		await publishVersion(database, 'i-legal-history-timeline', 1, 'lead');
		await saveVersion(database, bucket, { identifier: 'i-legal-history-timeline', text: essay('Timeline', 'One. Two.'), basedOn: 1, personIdentifier: 'lead', origin: 'editor', note: 'Added two' });
		await publishVersion(database, 'i-legal-history-timeline', 2, 'lead');

		const directory = directoryOf(build('2026-11-23T00:00:00Z', []));
		let list = await listChanges(database, all, directory);
		expect(list.changes.map((change) => [change.id, change.address, change.change, change.summary, change.who])).toEqual([
			['essay-i-legal-history-timeline-2', essayPath('i-legal-history-timeline', 'foundations'), 'published', 'Added two', 'Trevor Goldsmith'],
			['essay-i-legal-history-timeline-1', '/foundations/legal-history-timeline', 'new', 'First', 'Trevor Goldsmith']
		]);
		expect(list.changes[0].sizeChange).toBe(5);
		expect(list.people).toEqual([
			{ key: 'site', name: 'Site release' },
			{ key: 'lead', name: 'Trevor Goldsmith' }
		]);
		const detail = await changeDetail(database, bucket, 'essay-i-legal-history-timeline-2', directory);
		expect(detail?.comparison.kind).toBe('compared');

		await setPublicationListed(database, 'i-legal-history-timeline', 1, false, 'lead', 'At a nation’s request');
		list = await listChanges(database, all, directory);
		expect(list.changes[1]).toMatchObject({ textHidden: true, summary: undefined, hiddenReason: 'Withdrawn from readers' });
		expect((await changeDetail(database, bucket, 'essay-i-legal-history-timeline-1', directory))?.comparison.kind).toBe('hidden');
		// Publication 2 now has no earlier listed publication, so it compares with nothing before it.
		expect(list.changes[0].change).toBe('new');
	});
});

describe('pages about the site in Recent changes', () => {
	it('lists a publication of the About page at its own address', async () => {
		const text = '---\ntitle: "About"\npart: about\n---\n\n# About\n\nWho we are.\n';
		await saveVersion(database, bucket, { identifier: 'about', text, basedOn: null, personIdentifier: 'lead', origin: 'editor', note: 'First' });
		await publishVersion(database, 'about', 1, 'lead');
		const list = await listChanges(database, all, directoryOf(build('2026-11-23T00:00:00Z', [])));
		expect(list.changes.map((change) => [change.address, change.kind, change.change])).toEqual([[essayPath('about', 'about'), 'about', 'new']]);
		expect(list.changes[0].address).toBe('/about');
	});
});
