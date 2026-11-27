/**
 * Writes a ZIP file as a stream, one entry at a time, so a download of hundreds of megabytes never
 * sits in the Worker's memory (the ZIP downloads, site/DESIGN.md, section 10). Entries are stored
 * without compression: the documents are PDFs and saved web pages, which are compressed already
 * or small. fflate works out each entry's checksum as the bytes pass through.
 */
import { Zip, ZipPassThrough } from 'fflate';

export interface ZipEntry {
	/** The path inside the ZIP file, with forward slashes. */
	name: string;
	/** The entry's bytes, or undefined to leave it out. Opened only when its turn comes. */
	open: () => Promise<ReadableStream<Uint8Array> | Uint8Array | undefined>;
	modified?: Date;
}

export function zipStream(entries: AsyncIterable<ZipEntry> | Iterable<ZipEntry>): ReadableStream<Uint8Array> {
	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
	const writer = writable.getWriter();
	void (async () => {
		let failure: unknown;
		const zip = new Zip((error, chunk) => {
			if (error) failure = error;
			else void writer.write(chunk).catch(() => /* expected: a write fails only once the download is cancelled, which ends the loop below */ undefined);
		});
		try {
			for await (const entry of entries) {
				const body = await entry.open();
				if (!body) continue;
				const file = new ZipPassThrough(entry.name);
				if (entry.modified) file.mtime = entry.modified;
				zip.add(file);
				if (body instanceof Uint8Array) {
					file.push(body, true);
				} else {
					const reader = body.getReader();
					for (;;) {
						const { done, value } = await reader.read();
						if (done) break;
						file.push(value);
						// Waits while the reader's connection is slower than the bucket.
						await writer.ready;
					}
					file.push(new Uint8Array(0), true);
				}
				if (failure) throw failure;
			}
			zip.end();
			await writer.close();
		} catch (error) {
			await writer.abort(error).catch(() => /* expected: the stream is already closed or cancelled */ undefined);
		}
	})();
	return readable;
}

/** A name safe inside a ZIP file on every system. */
export function safeName(name: string): string {
	return name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^\.+/, '').slice(0, 150) || 'file';
}
