import { afterEach, describe, expect, it, vi } from 'vitest';
import { notThroughProblem, sendJson } from '#lib/send-json.ts';

afterEach(() => {
	vi.unstubAllGlobals();
});

function answering(response: Response | Error) {
	const fetch = vi.fn(async () => {
		if (response instanceof Error) throw response;
		return response;
	});
	vi.stubGlobal('fetch', fetch);
	return fetch;
}

describe('sendJson', () => {
	it('sends the payload as JSON and gives back the answer', async () => {
		const fetch = answering(Response.json({ comments: [] }));
		const sent = await sendJson<{ comments: unknown[] }>('/workspace/essays/a/comments', 'PATCH', { body: 'x' }, { complete: (answer) => !!answer.comments });
		expect(sent).toEqual({ ok: true, answer: { comments: [] } });
		expect(fetch).toHaveBeenCalledWith('/workspace/essays/a/comments', {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: '{"body":"x"}'
		});
	});

	it('adds the headers asked for', async () => {
		const fetch = answering(Response.json({ link: '/essays/a' }));
		await sendJson('/workspace/essays/new', 'POST', {}, { headers: { accept: 'application/json' } });
		expect(fetch).toHaveBeenCalledWith('/workspace/essays/new', expect.objectContaining({ headers: { 'content-type': 'application/json', accept: 'application/json' } }));
	});

	it("gives the server's own message when the change was refused", async () => {
		answering(Response.json({ message: 'Only editors can share.' }, { status: 403 }));
		expect(await sendJson('/x', 'PUT', {})).toEqual({ ok: false, problem: 'Only editors can share.' });
	});

	it('gives the usual problem when the network fails, the answer is not JSON, or it lacks what was asked for', async () => {
		answering(new TypeError('Failed to fetch'));
		expect(await sendJson('/x', 'POST', {})).toEqual({ ok: false, problem: notThroughProblem });
		answering(new Response('<html>', { status: 200 }));
		expect(await sendJson('/x', 'POST', {})).toEqual({ ok: false, problem: notThroughProblem });
		answering(Response.json({ other: true }));
		expect(await sendJson<{ link: string }>('/x', 'POST', {}, { complete: (answer) => !!answer.link })).toEqual({ ok: false, problem: notThroughProblem });
		expect(notThroughProblem).toBe('That did not go through. Try again.');
	});
});
