/**
 * Makes the source watch's index of known identifiers while the watch
 * Worker is built (./known.ts; docs/source-watch.md, "Dedupe against the
 * records we have"). site/watch/make-known-identifiers.ts writes it to
 * site/watch/known-identifiers.json, which the Worker bundles. It is kept out
 * of the website's own bundle, where it would add about 700 KB compressed.
 *
 * File hashes are cut to their first 20 hexadecimal characters (80 bits),
 * which keeps the index small; two different files sharing
 * them is vanishingly unlikely, and a match only closes an item as "already
 * have it", which the review page's "Closed by rules" view lets a person undo.
 */
import { createHash } from 'node:crypto';
import { captureIndexSha256s, documentHistories, nations, sources } from '../content.ts';
import { normalizeFederalRegisterNumber, normalizeLink, regulationOfCitation, shortHash, type KnownIdentifiers, type KnownSource } from './known.ts';

export function knownIdentifiersBuild(madeAt = new Date()): KnownIdentifiers {
	const known: KnownSource[] = [];
	for (const record of sources().values()) {
		const withFile = record as typeof record & { file?: { checksum?: string } };
		const link = record.original_link ?? record.citation.URL;
		const number = record.citation.number && /federal register|fr doc/i.test(`${record.citation['container-title'] ?? ''} ${record.citation.number}`) ? normalizeFederalRegisterNumber(record.citation.number) : undefined;
		const regulation = regulationOfCitation(record.citation as Parameters<typeof regulationOfCitation>[0]);
		const reporter = record.citation.volume && record.citation.page && record.citation['container-title-short'] ? `${record.citation.volume} ${record.citation['container-title-short']} ${record.citation.page}` : undefined;
		known.push({
			key: record.key,
			kind: record.kind,
			title: record.citation.title ?? record.key,
			...(link && normalizeLink(link) ? { link: normalizeLink(link) } : {}),
			...(withFile.file?.checksum ? { checksum: shortHash(withFile.file.checksum) } : {}),
			...(number ? { federalRegisterNumber: number } : {}),
			...(reporter ? { reporter } : {}),
			...(regulation ? { regulation } : {}),
			...(record.tribes?.length ? { nations: record.tribes } : {})
		});
	}
	const histories = documentHistories().map((history) => ({
		identifier: history.id,
		title: history.title,
		kind: history.kind,
		nations: history.nations ?? [],
		sha256s: history.versions.map((version) => version.capture?.sha256).filter((sha256): sha256 is string => Boolean(sha256)).map(shortHash)
	}));
	const nationList = nations()
		.filter((record) => !(record as { example?: boolean }).example)
		.map((record) => ({
			identifier: record.id,
			names: [record.names.official, ...(record.names.self_designation ?? []).map((entry) => entry.name), ...(record.names.former ?? []).map((entry) => entry.name)].filter(Boolean)
		}));
	const capturedSha256s = [...new Set(captureIndexSha256s().map(shortHash))].sort();
	const withoutHash = { sources: known, histories, nations: nationList, capturedSha256s };
	const buildHash = createHash('sha256').update(JSON.stringify(withoutHash)).digest('hex').slice(0, 16);
	return { buildHash, madeAt: madeAt.toISOString(), ...withoutHash };
}
