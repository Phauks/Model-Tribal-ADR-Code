/**
 * Reads a form sent to the Worker without holding more than a set number of
 * bytes. A form read with request.formData() is read whole before anything
 * can check its size, so a public form could be sent a body as large as
 * Cloudflare allows (100 MB or more, by plan) and the Worker would hold all
 * of it. This refuses a body that says it is too large before reading it,
 * and stops reading one that turns out larger than it said.
 */

/** Thrown when a body is larger than the limit. */
export class BodyTooLarge extends Error {
	constructor(readonly limit: number) {
		super(`The body is larger than ${limit} bytes.`);
		this.name = 'BodyTooLarge';
	}
}

/** The request's body as form data, or BodyTooLarge if it is over `maximumBytes`. */
export async function formWithin(request: Request, maximumBytes: number): Promise<FormData> {
	const declared = Number(request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maximumBytes) throw new BodyTooLarge(maximumBytes);
	const bytes = await bytesWithin(request.body, maximumBytes);
	return new Response(bytes, { headers: { 'content-type': request.headers.get('content-type') ?? '' } }).formData();
}

async function bytesWithin(body: ReadableStream<Uint8Array> | null, maximumBytes: number): Promise<Uint8Array<ArrayBuffer>> {
	if (!body) return new Uint8Array();
	const reader = body.getReader();
	const pieces: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maximumBytes) {
			await reader.cancel().catch(() => /* expected: the body is only being let go */ undefined);
			throw new BodyTooLarge(maximumBytes);
		}
		pieces.push(value);
	}
	const whole = new Uint8Array(total);
	let offset = 0;
	for (const piece of pieces) {
		whole.set(piece, offset);
		offset += piece.byteLength;
	}
	return whole;
}
