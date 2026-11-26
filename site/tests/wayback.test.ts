import { describe, expect, it } from 'vitest';
import type { Fetcher } from '@cloudflare/workers-types/index.ts';
import { readCaptureLink, readWaybackStatus, saveItYourselfLink } from '#lib/server/wayback.ts';

// The workspace's Wayback captures page (site/WAYBACK.md, "Links that fail").
describe('a Wayback link pasted by hand', () => {
	const original = 'https://www.example.gov/laws/code.pdf';

	it('is read into a capture with its date', () => {
		expect(readCaptureLink(' https://web.archive.org/web/20261124174500/https://www.example.gov/laws/code.pdf ', original)).toEqual({
			capture: { service: 'wayback', link: 'https://web.archive.org/web/20261124174500/https://www.example.gov/laws/code.pdf', captured: '2026-11-24' }
		});
	});

	it('drops the Archive’s playback flag from the link', () => {
		const read = readCaptureLink('https://web.archive.org/web/20261124174500id_/https://example.gov/laws/code.pdf', original);
		expect(read).toEqual({ capture: expect.objectContaining({ link: 'https://web.archive.org/web/20261124174500/https://example.gov/laws/code.pdf' }) });
	});

	it('is refused when it is of another site', () => {
		expect(readCaptureLink('https://web.archive.org/web/20261124174500/https://login.example.com/', original)).toHaveProperty('problem');
	});

	it('is refused when it is not a Wayback capture link', () => {
		expect(readCaptureLink('https://example.gov/laws/code.pdf', original)).toHaveProperty('problem');
		expect(readCaptureLink('https://web.archive.org/web/2026/https://example.gov/laws/code.pdf', original)).toHaveProperty('problem');
	});
});

describe('saving a link yourself', () => {
	it('opens Save Page Now for that link', () => {
		expect(saveItYourselfLink('https://example.gov/a?b=1')).toBe('https://web.archive.org/save/https://example.gov/a?b=1');
	});
});

// The site reaches the Worker through the waybackWorker service binding, because a
// Worker's fetch of another Worker's workers.dev address on the same account answers 404.
describe('the Wayback Worker’s progress', () => {
	const worker = (response: Response) => ({ fetch: async () => response }) as unknown as Fetcher;

	it('says so when the binding is missing', async () => {
		expect(await readWaybackStatus(undefined)).toEqual({ problem: 'The waybackWorker binding is missing.' });
	});

	it('says what the Worker answered when it is not a status', async () => {
		expect(await readWaybackStatus(worker(new Response('Not found', { status: 404 })))).toEqual({ problem: 'The Wayback Worker answered 404.' });
	});

	it('reads the status through the binding', async () => {
		const status = { state: 'saving', stateWords: 'Saving', left: 3, savingNow: [{ key: 'a', link: 'https://example.gov/', askedAt: null }] };
		expect(await readWaybackStatus(worker(Response.json(status)))).toEqual({ status });
	});
});
