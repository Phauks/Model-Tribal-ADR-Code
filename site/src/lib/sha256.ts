/**
 * SHA-256 of a file a reader chooses, worked out in the browser so the file never leaves their
 * device (the "Verify a file" page, site/DESIGN.md, section 10). Trevor asked on Nov. 23, 2026 for
 * every download and document copy to come with a way to check it.
 *
 * The browser's own crypto.subtle.digest is fast but needs the whole file in memory at once, so it
 * is used for files up to wholeFileLimit. Larger files, such as the ZIP of United States documents,
 * are read in pieces through Sha256, a plain implementation of FIPS 180-4.
 */

const roundConstants = new Uint32Array([
	0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
	0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
	0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
	0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
	0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
	0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
	0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

/** SHA-256 fed a piece at a time. */
export class Sha256 {
	private readonly state = new Uint32Array([
		0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
	]);
	private readonly words = new Uint32Array(64);
	private readonly block = new Uint8Array(64);
	private filled = 0;
	private length = 0;
	private finished = false;

	update(bytes: Uint8Array): this {
		if (this.finished) throw new Error('The hash is already finished.');
		this.length += bytes.length;
		let offset = 0;
		if (this.filled > 0) {
			const taken = Math.min(64 - this.filled, bytes.length);
			this.block.set(bytes.subarray(0, taken), this.filled);
			this.filled += taken;
			offset = taken;
			if (this.filled < 64) return this;
			this.compress(this.block, 0);
			this.filled = 0;
		}
		for (; offset + 64 <= bytes.length; offset += 64) this.compress(bytes, offset);
		if (offset < bytes.length) {
			this.block.set(bytes.subarray(offset), 0);
			this.filled = bytes.length - offset;
		}
		return this;
	}

	/** The hash as 64 lowercase hexadecimal digits. */
	digest(): string {
		if (!this.finished) {
			const bits = this.length * 8;
			const tail = new Uint8Array(this.filled < 56 ? 64 - this.filled : 128 - this.filled);
			tail[0] = 0x80;
			const view = new DataView(tail.buffer);
			view.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
			view.setUint32(tail.length - 4, bits >>> 0);
			this.update(tail);
			this.finished = true;
		}
		return Array.from(this.state, (word) => word.toString(16).padStart(8, '0')).join('');
	}

	private compress(bytes: Uint8Array, offset: number): void {
		const w = this.words;
		for (let index = 0; index < 16; index += 1) {
			const at = offset + index * 4;
			w[index] = (bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3];
		}
		for (let index = 16; index < 64; index += 1) {
			const a = w[index - 15];
			const b = w[index - 2];
			const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
			const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
			w[index] = (w[index - 16] + s0 + w[index - 7] + s1) | 0;
		}
		const s = this.state;
		let a = s[0];
		let b = s[1];
		let c = s[2];
		let d = s[3];
		let e = s[4];
		let f = s[5];
		let g = s[6];
		let h = s[7];
		for (let index = 0; index < 64; index += 1) {
			const sum1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
			const choice = (e & f) ^ (~e & g);
			const first = (h + sum1 + choice + roundConstants[index] + w[index]) | 0;
			const sum0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
			const majority = (a & b) ^ (a & c) ^ (b & c);
			const second = (sum0 + majority) | 0;
			h = g;
			g = f;
			f = e;
			e = (d + first) | 0;
			d = c;
			c = b;
			b = a;
			a = (first + second) | 0;
		}
		s[0] += a;
		s[1] += b;
		s[2] += c;
		s[3] += d;
		s[4] += e;
		s[5] += f;
		s[6] += g;
		s[7] += h;
	}
}

/** Files up to this size are hashed by the browser in one go. */
export const wholeFileLimit = 256 * 1024 * 1024;

function hex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The SHA-256 of a file, reporting how many bytes have been read so far. */
export async function hashFile(file: Blob, onProgress?: (done: number, total: number) => void): Promise<string> {
	const subtle = globalThis.crypto?.subtle;
	if (subtle && file.size <= wholeFileLimit) {
		const digest = hex(await subtle.digest('SHA-256', await file.arrayBuffer()));
		onProgress?.(file.size, file.size);
		return digest;
	}
	const hash = new Sha256();
	const reader = file.stream().getReader();
	let done = 0;
	for (;;) {
		const piece = await reader.read();
		if (piece.done) break;
		hash.update(piece.value);
		done += piece.value.length;
		onProgress?.(done, file.size);
	}
	return hash.digest();
}

/** Whether a string is a SHA-256 written as 64 hexadecimal digits. */
export function isSha256(value: unknown): value is string {
	return typeof value === 'string' && /^[0-9a-f]{64}$/i.test(value.trim());
}
