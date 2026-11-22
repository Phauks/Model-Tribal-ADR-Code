import { describe, expect, it } from 'vitest';
import { changesSince, parseGitLog } from '#lib/recent-changes.ts';

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
});
