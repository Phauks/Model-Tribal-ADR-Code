import { beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types/index.ts';
import {
	copyItemId,
	copyRestriction,
	itemLevel,
	pageRestrictions,
	readPageRestrictions,
	readSettings,
	restrictionProblem,
	savingLines,
	settingsChanges,
	tidySettings,
	versionItemIdentifier,
	type RestrictableItem,
	type RestrictionSettings
} from '#lib/nation-restrictions.ts';
import { pageOverlay, restrictionsSlot } from '#lib/server/nation-page-overlay.ts';
import { copyLevels, currentSettings, nationPageRestrictions, saveSettings, savesOf, unreadSaves } from '#lib/server/nation-restrictions.ts';
import { matchSignIn, type SignedInPerson } from '#lib/server/people.ts';
import { withNationPageChanges } from '../tools/nation-page-changes-worker.js';
import { testDatabase } from './database.ts';

const cherokee = 'cherokee-nation';
const items: RestrictableItem[] = [
	{ id: 'copy:constitutions/cherokee-nation/1999.pdf', kind: 'laws', title: '1999 constitution', original: 'https://example.org/1999.pdf', bytes: 100, offline: true },
	{ id: 'copy:constitutions/cherokee-nation/1975.pdf', kind: 'laws', title: '1975 proposed constitution', original: 'https://example.org/1975.pdf', bytes: 50, offline: true },
	{ id: 'version:compact/2005', kind: 'agreements', title: 'Gaming compact with Oklahoma: 2005 compact', original: 'https://bia.example/compact.pdf' },
	{ id: 'copy:caselaw-access-project/am-tribal-law/1/0001-01.html', kind: 'opinions', title: 'Takeda v. Smith', citation: '1 Am. Tribal Law 1 (Cherokee 1999)', original: 'https://static.case.law/1.html', bytes: 10, offline: true },
	{ id: 'copy:caselaw-access-project/am-tribal-law/1/0002-01.html', kind: 'opinions', title: 'In re A. B.', citation: '1 Am. Tribal Law 2 (Cherokee 2000)', original: 'https://static.case.law/2.html', bytes: 20, offline: true }
];

describe('what a nation can choose', () => {
	it('keeps agreements from being hidden and reads only known kinds, levels and ids', () => {
		const settings = readSettings({
			kinds: { opinions: 'cite', agreements: 'hide', treaties: 'hide', laws: 'gone' },
			items: { 'copy:a/b.pdf': 'hide', 'not an id': 'hide', 'version:x/y': 'loud' }
		});
		expect(settings).toEqual({ kinds: { opinions: 'cite', agreements: 'cite' }, items: { 'copy:a/b.pdf': 'hide' } });
		expect(itemLevel(settings, { id: 'version:compact/2005', kind: 'agreements' })).toBe('cite');
	});

	it('lets items follow their kind unless set apart, and drops exceptions that match the kind', () => {
		const settings: RestrictionSettings = { kinds: { opinions: 'cite' }, items: { [items[3].id]: 'show', [items[4].id]: 'cite' } };
		expect(itemLevel(settings, items[3])).toBe('show');
		expect(itemLevel(settings, items[4])).toBe('cite');
		expect(tidySettings(settings, items).items).toEqual({ [items[3].id]: 'show' });
	});

	it('says what saving will do, by kind with counts, then by item', () => {
		const before: RestrictionSettings = { kinds: {}, items: {} };
		const after: RestrictionSettings = { kinds: { opinions: 'cite' }, items: { [items[3].id]: 'show', [items[1].id]: 'hide' } };
		const changes = settingsChanges(before, after, items);
		expect(changes.map((change) => [change.target, change.from, change.to, change.count])).toEqual([
			['kind:opinions', 'show', 'cite', 1],
			[items[1].id, 'show', 'hide', undefined],
			[items[3].id, 'show', 'show', undefined]
		]);
		expect(savingLines(changes, items).map((line) => `${line.before}${line.name ?? ''}${line.after}`)).toEqual([
			'list 1 court opinion by citation, each linked to the Caselaw Access Project',
			'stop listing the 1975 proposed constitution',
			'keep Takeda v. Smith in full'
		]);
	});

	it('lets the lead author and whole-page editors and stewards choose', () => {
		expect(restrictionProblem({ isAdministrator: true })).toBeUndefined();
		expect(restrictionProblem({ isAdministrator: false, level: 'steward', parts: null })).toBeUndefined();
		expect(restrictionProblem({ isAdministrator: false, level: 'editor', parts: ['contacts'] })).toMatch(/whole page/);
		expect(restrictionProblem({ isAdministrator: false, level: 'drafter', parts: null })).toMatch(/editor or steward/);
	});
});

describe('which items a copy and a page follow', () => {
	it('names copies and versions the same way the page, the copy and the downloads do', () => {
		expect(copyItemId('/copies/view/caselaw-access-project/am-tribal-law/1/0001-01.html')).toBe(items[3].id);
		expect(copyItemId('/copies/a/b%20c.pdf')).toBe('copy:a/b c.pdf');
		expect(versionItemIdentifier('/copies/view/constitutions/cherokee-nation/1999.pdf', 'constitution', '1999')).toBe(items[0].id);
		expect(versionItemIdentifier('https://bia.example/compact.pdf', 'compact', '2005')).toBe('version:compact/2005');
	});

	it('lets nations restrict only their own laws and courts’ opinions', () => {
		expect(copyRestriction({ key: 'constitutions/cherokee-nation/1999.pdf', topic: 'constitutions', nations: [] })).toEqual({ kind: 'laws', nations: [cherokee] });
		expect(copyRestriction({ key: 'caselaw-access-project/x.html', topic: 'caselaw-access-project', nations: [cherokee, 'navajo-nation'] })).toEqual({
			kind: 'opinions',
			nations: [cherokee, 'navajo-nation']
		});
		expect(copyRestriction({ key: 'govinfo/statute.pdf', topic: 'govinfo', nations: [cherokee] })).toBeUndefined();
	});

	it('works out what the page shows: levels, originals, counts and the downloads’ size', () => {
		const settings: RestrictionSettings = { kinds: { opinions: 'cite' }, items: { [items[3].id]: 'show', [items[1].id]: 'hide' } };
		const result = pageRestrictions(items, (item) => itemLevel(settings, item), 'cite');
		expect(result.levels).toEqual({ [items[1].id]: 'hide', [items[4].id]: 'cite' });
		expect(result.originals).toEqual({ [items[4].id]: 'https://static.case.law/2.html' });
		expect(result.opinions).toEqual({ kind: 'cite', total: 2, cited: 1, hidden: 0 });
		expect(result.lawsWithheld).toBe(true);
		expect(result.withheldCopies).toEqual({ count: 2, bytes: 70 });
		expect(readPageRestrictions(JSON.stringify(result))).toEqual(result);
		expect(readPageRestrictions('not json').levels).toEqual({});
	});
});

describe('what the page is sent', () => {
	it('names only cited items, and nothing in an id can end the style or the script', () => {
		const html = restrictionsSlot({
			levels: { 'copy:a/hidden.pdf': 'hide', 'copy:b/"</style><script>x</script>.html': 'cite' },
			originals: {},
			opinions: { kind: 'show', total: 0, cited: 0, hidden: 0 },
			lawsWithheld: true,
			withheldCopies: { count: 2, bytes: 3 }
		});
		expect(html).not.toContain('hidden.pdf');
		expect(html).toContain('[data-restrict-item="copy:b/\\22 \\3c /style\\3e \\3c script\\3e x\\3c /script\\3e .html"] [data-restrict-text]');
		expect(html.match(/<\/style>/g)).toHaveLength(1);
		expect(html.match(/<\/script>/g)).toHaveLength(1);
	});

	it('sends an overlay for an unclaimed page only when something is restricted, and never names hidden copies', () => {
		const none = pageRestrictions(items, () => 'show', 'show');
		expect(pageOverlay(cherokee, {}, undefined, undefined, none)).toBeUndefined();
		const some = pageRestrictions(items, (item) => (item.kind === 'laws' ? 'hide' : 'show'), 'show');
		const overlay = pageOverlay(cherokee, {}, undefined, undefined, some);
		expect(overlay?.slots.restrict).toContain('data-nation-restrictions');
		expect(JSON.stringify(overlay)).not.toContain('1975.pdf');
		expect(JSON.stringify(overlay)).toContain('lawsWithheld');
	});
});

describe('saving a nation’s choices', () => {
	let database: D1Database;
	let lead: SignedInPerson;

	beforeEach(async () => {
		database = testDatabase();
		const result = await matchSignIn(database, { subject: 'account-lead', email: 'lead@example.org', emailVerified: true, name: 'Lead' }, 'lead@example.org');
		if (result.outcome !== 'signed-in') throw new Error('No lead author');
		lead = result.person;
	});

	it('puts the newest choice in force at once and queues it for the project', async () => {
		expect(await currentSettings(database, cherokee)).toEqual({ kinds: {}, items: {} });
		const first: RestrictionSettings = { kinds: { opinions: 'cite' }, items: {} };
		await saveSettings(database, cherokee, first, settingsChanges({ kinds: {}, items: {} }, first, items), 'Council resolution 12-26', lead, '2026-11-24T10:00:00.000Z');
		const second: RestrictionSettings = { kinds: { opinions: 'hide' }, items: {} };
		await saveSettings(database, cherokee, second, settingsChanges(first, second, items), null, lead, '2026-11-24T11:00:00.000Z');
		expect(await currentSettings(database, cherokee)).toEqual(second);
		expect((await savesOf(database, cherokee)).map((save) => save.note)).toEqual([null, 'Council resolution 12-26']);
		expect(await unreadSaves(database)).toHaveLength(2);
	});

	it('follows the strictest choice of the nations a copy belongs to', async () => {
		await saveSettings(database, 'navajo-nation', { kinds: { opinions: 'hide' }, items: {} }, [], null, lead);
		await saveSettings(database, cherokee, { kinds: { opinions: 'cite' }, items: {} }, [], null, lead);
		const shared = { key: 'caselaw-access-project/shared.html', restrict: { kind: 'opinions' as const, nations: [cherokee, 'navajo-nation'] } };
		const own = { key: 'caselaw-access-project/own.html', restrict: { kind: 'opinions' as const, nations: [cherokee] } };
		const federal = { key: 'govinfo/statute.pdf' };
		const levels = await copyLevels(database, [shared, own, federal]);
		expect(Object.fromEntries(levels)).toEqual({ [shared.key]: 'hide', [own.key]: 'cite' });

		const page = await nationPageRestrictions(
			database,
			cherokee,
			async () => ({ nation: cherokee, items: [{ id: `copy:${shared.key}`, kind: 'opinions', title: 'Shared' }, { id: `copy:${own.key}`, kind: 'opinions', title: 'Own' }] }),
			async () => new Map([shared, own].map((copy) => [copy.key, copy]))
		);
		expect(page.levels).toEqual({ [`copy:${shared.key}`]: 'hide', [`copy:${own.key}`]: 'cite' });
	});

	it('does not read the list of items while no nation has chosen anything', async () => {
		let read = false;
		const page = await nationPageRestrictions(database, cherokee, async () => ((read = true), { nation: cherokee, items }), async () => new Map());
		expect(read).toBe(false);
		expect(page.levels).toEqual({});
	});
});

describe('what the Worker sends to the site first', () => {
	const seen: string[] = [];
	const worker = {
		async fetch(request: Request) {
			const url = new URL(request.url);
			seen.push(`${url.pathname}${url.search}`);
			if (url.pathname.endsWith('/changes.json')) return new Response('Not found', { status: 404 });
			return new Response('built', { headers: { 'content-type': 'text/html' } });
		}
	};
	const wrapped = withNationPageChanges(worker);
	const ask = async (path: string) => {
		seen.length = 0;
		const response = await wrapped.fetch(new Request(`https://site.example${path}`), {}, {});
		return { response, seen: [...seen] };
	};

	it('sends built files that name laws and opinions to be filtered', async () => {
		for (const path of ['/search/records.json', '/search/index.json', '/copies/list.csv', '/copies/details/0f.json', '/copies/offline/nations/cherokee-nation.json', '/nations/cherokee-nation/timeline.csv', '/nations/timeline/entries.json', '/nations/law/cherokee-nation.json', '/nations/data/build/opinions.json', '/zip/data.zip']) {
			expect((await ask(path)).seen).toEqual([`/restricted-files${path}`]);
		}
	});

	it('sends pages and their data to be drawn again, keeping the query', async () => {
		expect((await ask('/nations/cherokee-nation/__data.json?x-sveltekit-invalidated=01')).seen).toEqual(['/restricted-pages/nations/cherokee-nation/__data.json?x-sveltekit-invalidated=01']);
		expect((await ask('/nations/cherokee-nation')).seen).toEqual(['/nations/cherokee-nation/changes.json', '/restricted-pages/nations/cherokee-nation']);
		for (const path of ['/nations/timeline', '/copies/list/c', '/nations/data/tribal-opinions-by-decade/2010s']) {
			expect((await ask(path)).seen).toEqual([`/restricted-pages${path}`]);
		}
	});

	it('leaves other pages alone and never serves the list of restrictable items', async () => {
		for (const path of ['/nations/map', '/nations/data/gaming', '/nations/data/tribal-opinions-by-decade/sources', '/copies/view/a.pdf', '/about']) {
			expect((await ask(path)).seen).toEqual([path]);
		}
		const list = await ask('/nations/cherokee-nation/restrictable.json');
		expect(list.response.status).toBe(404);
		expect(list.seen).toEqual([]);
	});

	it('never serves the Worker’s private data files, such as the list of every copy', async () => {
		for (const path of ['/page-data/private/copies/17.json', '/page-data/private/essay-case-names.json']) {
			const answer = await ask(path);
			expect(answer.response.status).toBe(404);
			expect(answer.seen).toEqual([]);
		}
	});
});
