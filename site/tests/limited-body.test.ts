import { describe, expect, it } from 'vitest';
import { BodyTooLarge, formWithin } from '#lib/server/limited-body.ts';

function formRequest(form: FormData, headers: Record<string, string> = {}): Request {
	return new Request('https://site.example/requests', { method: 'POST', body: form, headers });
}

describe('reading a form within a limit', () => {
	it('reads a form under the limit', async () => {
		const form = new FormData();
		form.set('message', 'hello');
		form.set('file', new File([new Uint8Array(1000)], 'a.pdf', { type: 'application/pdf' }));
		const read = await formWithin(formRequest(form), 10_000);
		expect(read.get('message')).toBe('hello');
		expect((read.get('file') as File).size).toBe(1000);
	});

	it('refuses a body that says it is too large, before reading it', async () => {
		const request = new Request('https://site.example/requests', {
			method: 'POST',
			body: 'x',
			headers: { 'content-length': '50000', 'content-type': 'text/plain' }
		});
		await expect(formWithin(request, 10_000)).rejects.toBeInstanceOf(BodyTooLarge);
		expect(request.bodyUsed).toBe(false);
	});

	it('stops reading a body that is larger than it said', async () => {
		const form = new FormData();
		form.set('file', new File([new Uint8Array(50_000)], 'a.pdf', { type: 'application/pdf' }));
		const sent = new Request('https://site.example/', { method: 'POST', body: form });
		const stream = sent.body!;
		const request = new Request('https://site.example/requests', {
			method: 'POST',
			body: stream,
			headers: { 'content-type': sent.headers.get('content-type')! },
			// @ts-expect-error Node needs this to send a stream as a body.
			duplex: 'half'
		});
		await expect(formWithin(request, 10_000)).rejects.toBeInstanceOf(BodyTooLarge);
	});
});
