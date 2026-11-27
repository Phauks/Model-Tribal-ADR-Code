/**
 * The ZIP downloads of the copies this site holds: the United States documents, or one nation's
 * constitutions, laws and court opinions (site/DESIGN.md, section 10). Trevor asked on Nov. 23, 2026 for both.
 * Each ZIP holds the copies, a list of them with where each was published, and a note on what the
 * files are. Only copies on the build's list are read from the bucket; a copy the bucket lacks is
 * listed with its link instead.
 */
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import { strToU8 } from 'fflate';
import type { DocumentSetList } from '../offline-documents.ts';
import { safeName, zipStream, type ZipEntry } from './zip-stream.ts';
import { csvLine, type CsvOptions } from '#lib/csv.ts';
import { verifierReadme, verifyPowerShell, verifyPowerShellName, verifyShell, verifyShellName } from '#lib/zip-verifiers.ts';

/** documents.csv has always ended its lines with a carriage return and line feed but quoted only fields that hold a line feed, so it keeps those rules. */
const onlyLineFeedsQuoted: CsvOptions = { quoteCarriageReturns: false };

/** The bucket key of a copy from its address on this site, "/copies/a/b%20c.pdf" -> "a/b c.pdf". */
export function keyOfCopyPath(path: string): string {
	return path
		.replace(/^\/copies\//, '')
		.split('/')
		.map((part) => decodeURIComponent(part))
		.join('/');
}

export function documentsReadme(title: string, siteAddress: string, made: string): string {
	return [
		title,
		'',
		`From the Tribal Law Project website, ${siteAddress}, made ${made}.`,
		'',
		'These are the website’s own copies of documents it cites and is allowed to share: works of the United States government, and nations’ constitutions, laws and court opinions. documents.csv lists each file with its title, the address it was published at and its SHA-256.',
		'',
		`To check that a file is the one the website published, unchanged, choose it on Verify File at ${siteAddress}/verify, or compare its SHA-256 with documents.csv. SHA256SUMS.txt lists them in the form sha256sum -c reads (on Windows, Get-FileHash file.pdf; on a Mac, shasum -a 256 file.pdf; on Linux, sha256sum file.pdf).`,
		'',
		verifierReadme(`${siteAddress}/verify`),
		'',
		'This file cannot be changed after you download it. If a nation has asked for a document to be removed, the website no longer offers it: check the website for the current list, and please delete a removed document from your copy.',
		''
	].join('\r\n');
}

export function documentsZip(
	list: DocumentSetList,
	bucket: R2Bucket,
	served: Set<string>,
	readme: string
): ReadableStream<Uint8Array> {
	const used = new Set<string>();
	const sums: string[] = [];
	const rows: string[] = [csvLine(['file', 'title', 'published_at', 'copy_on_website', 'bytes', 'sha256', 'in_this_zip'], onlyLineFeedsQuoted)];
	function nameFor(key: string): string {
		const base = safeName(key.split('/').at(-1) ?? 'file');
		let name = `documents/${base}`;
		for (let number = 2; used.has(name); number += 1) name = `documents/${number}-${base}`;
		used.add(name);
		return name;
	}
	async function* entries(): AsyncGenerator<ZipEntry> {
		yield { name: 'README.txt', open: async () => strToU8(readme) };
		for (const [path, bytes, sha256, title = '', original = ''] of list.files) {
			const key = keyOfCopyPath(path);
			const name = nameFor(key);
			const object = served.has(key) ? await bucket.get(key) : null;
			rows.push(
				csvLine([name.replace(/^documents\//, ''), title, original, path, bytes, sha256, object ? 'yes' : 'no'], onlyLineFeedsQuoted)
			);
			if (!object) continue;
			sums.push(`${sha256}  ${name}`);
			yield { name, open: async () => object.body as unknown as ReadableStream<Uint8Array>, modified: object.uploaded };
		}
		yield { name: 'documents.csv', open: async () => strToU8(`${rows.join('\r\n')}\r\n`) };
		// The form sha256sum -c reads, so the files can be checked in one step.
		yield { name: 'SHA256SUMS.txt', open: async () => strToU8(sums.map((line) => `${line}\n`).join('')) };
		// Scripts that check every file against SHA256SUMS.txt (src/lib/zip-verifiers.ts).
		yield { name: verifyShellName, open: async () => strToU8(verifyShell) };
		yield { name: verifyPowerShellName, open: async () => strToU8(verifyPowerShell) };
	}
	return zipStream(entries());
}
