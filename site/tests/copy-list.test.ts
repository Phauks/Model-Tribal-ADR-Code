import { describe, expect, it, vi } from 'vitest';
import { copyFiles, fileNumber, spreadFilePath, spreadRecords } from '#lib/built-files.ts';
import { staticFiles } from './static-files.ts';

const worker = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock('$app/env', () => ({ version: 'test-build', building: false, dev: false }));
vi.mock('cloudflare:workers', () => ({ env: worker.env, waitUntil: () => {} }));

const { servedCopies, servedCopy } = await import('#lib/server/copy-list.ts');

const stored = {
	'statutes/11/374.pdf': { mediaType: 'application/pdf', sha256: 'a'.repeat(64), bytes: 10, links: ['https://www.govinfo.gov/link/statute/11/374'] },
	'opinions/a-nation/1.pdf': {
		mediaType: 'application/pdf',
		sha256: 'b'.repeat(64),
		bytes: 20,
		links: [],
		restrict: { kind: 'opinions', nations: ['a-nation'] }
	}
};

function filesAsBuilt() {
	return Object.fromEntries(spreadRecords(copyFiles, stored).map((records, number) => [spreadFilePath(copyFiles, number), records]));
}

describe('the list of copies the Worker serves', () => {
	it('spreads the copies over private files by key', () => {
		const number = fileNumber('statutes/11/374.pdf', copyFiles.count);
		expect(spreadFilePath(copyFiles, number)).toBe(`/page-data/private/copies/${number}.json`);
		expect(spreadRecords(copyFiles, stored)[number]['statutes/11/374.pdf']).toEqual(stored['statutes/11/374.pdf']);
	});

	it('finds a copy by its key, reading only its file', async () => {
		const files = staticFiles(filesAsBuilt());
		worker.env.ASSETS = files;
		expect(await servedCopy('statutes/11/374.pdf')).toEqual({ key: 'statutes/11/374.pdf', ...stored['statutes/11/374.pdf'] });
		expect(files.asked).toEqual([spreadFilePath(copyFiles, fileNumber('statutes/11/374.pdf', copyFiles.count))]);
	});

	it('leaves out a key the site does not serve, and keeps a nation’s choices with its copy', async () => {
		worker.env.ASSETS = staticFiles(filesAsBuilt());
		const found = await servedCopies(['opinions/a-nation/1.pdf', 'not/on/the/list.pdf']);
		expect([...found.keys()]).toEqual(['opinions/a-nation/1.pdf']);
		expect(found.get('opinions/a-nation/1.pdf')?.restrict).toEqual({ kind: 'opinions', nations: ['a-nation'] });
	});
});
