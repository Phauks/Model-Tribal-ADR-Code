import { describe, expect, it } from 'vitest';
import { changesByDay, changesSince, mergeChanges, parseGitLog, reachesBack, readChanges } from '#lib/recent-changes.ts';
import { loadLiveChanges } from '#lib/server/recent-changes-build.ts';

const log = [
	'2026-11-22T07:33:33-08:00\tfeat(site): rework Settings controls, add a Data tab (#91)',
	'2026-11-22T07:20:00-08:00\tMerge branch main into topic',
	'2026-11-22T06:10:00-08:00\tfix(content)!: fold forums recorded twice (#82)',
	'2026-11-21T09:00:00-08:00\tdocs: list the work that waits on the domain (#80)',
	''
].join('\n');

describe('recent changes for the update card', () => {
	it('keeps pull request merges and drops their commit types', () => {
		expect(parseGitLog(log)).toEqual([
			{ number: 91, title: 'Rework Settings controls, add a Data tab', merged: '2026-11-22T07:33:33-08:00' },
			{ number: 82, title: 'Fold forums recorded twice', merged: '2026-11-22T06:10:00-08:00' },
			{ number: 80, title: 'List the work that waits on the domain', merged: '2026-11-21T09:00:00-08:00' }
		]);
	});

	it('lists only what was merged after the reader’s build', () => {
		const changes = parseGitLog(log);
		expect(changesSince(changes, new Date('2026-11-22T14:30:00Z')).map((change) => change.number)).toEqual([91]);
		expect(changesSince(changes, undefined)).toEqual([]);
		expect(changesSince(undefined, new Date())).toEqual([]);
	});

	it('carries the live site’s changes forward behind the ones git names', () => {
		const fromGit = parseGitLog(log).slice(0, 1);
		const live = [
			{ number: 91, title: 'Old title', merged: '2026-11-22T07:33:33-08:00' },
			{ number: 82, title: 'Fold forums recorded twice', merged: '2026-11-22T06:10:00-08:00' },
			{ number: 80, title: 'List the work that waits on the domain', merged: '2026-11-21T09:00:00-08:00' }
		];
		const merged = mergeChanges([fromGit, live]);
		expect(merged.map((change) => change.number)).toEqual([91, 82, 80]);
		expect(merged[0].title).toBe('Rework Settings controls, add a Data tab');
		expect(mergeChanges([fromGit, live], 2).map((change) => change.number)).toEqual([91, 82]);
	});

	it('drops malformed entries read from the live site', () => {
		expect(readChanges('nonsense')).toEqual([]);
		expect(
			readChanges([{ number: 5, title: 'Good', merged: '2026-11-20T00:00:00Z' }, { number: 'x' }, null, { number: 6, title: '', merged: '2026-11-20' }])
		).toEqual([{ number: 5, title: 'Good', merged: '2026-11-20T00:00:00Z' }]);
	});

	it('says whether the list reaches back to the reader’s build', () => {
		const changes = parseGitLog(log);
		expect(reachesBack(changes, new Date('2026-11-22T14:30:00Z'))).toBe(true);
		expect(reachesBack(changes, new Date('2026-11-20T00:00:00Z'))).toBe(false);
		expect(reachesBack(undefined, new Date())).toBe(false);
	});

	it('groups changes by the day they were merged in the reader’s time zone', () => {
		const days = changesByDay(parseGitLog(log), 'America/Los_Angeles');
		expect(days.map((day) => [day.day, day.label, day.changes.map((change) => change.number)])).toEqual([
			['2026-11-22', 'Nov. 22', [91, 82]],
			['2026-11-21', 'Nov. 21', [80]]
		]);
		expect(changesByDay(parseGitLog(log), 'Pacific/Kiritimati').map((day) => day.day)).toEqual(['2026-11-23', '2026-11-22']);
	});

	it('reads the live site’s changes only on Cloudflare’s build, and goes on without them', async () => {
		const siteFolder = new URL('..', import.meta.url).pathname;
		const answer = { changes: [{ number: 532, title: 'Published state court opinions', merged: '2026-11-26T21:26:36+00:00' }] };
		const fetcher = (async () => new Response(JSON.stringify(answer))) as unknown as typeof fetch;
		expect(await loadLiveChanges(siteFolder, {}, fetcher)).toEqual([]);
		expect(await loadLiveChanges(siteFolder, { WORKERS_CI: '1' }, fetcher)).toEqual(answer.changes);
		const missing = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
		expect(await loadLiveChanges(siteFolder, { WORKERS_CI: '1' }, missing)).toEqual([]);
	});
});
