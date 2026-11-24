/**
 * The things on a nation's page that the nation can restrict
 * (src/lib/nation-restrictions.ts), worked out when the site is built: its
 * courts' opinions, its documents' versions, and the other copies of its
 * laws this site keeps. Federal and state law and cases are not among them:
 * they are always shown (Trevor, Nov. 24, 2026).
 *
 * An item this site keeps a copy of is named by the copy ("copy:<key>"), so
 * the copy, its page, the nation's page and the nation's downloads all
 * follow the same choice. A version with no copy here is named by its
 * document and version.
 */
import { displayName } from '../nation-labels.ts';
import { versionItemId, type RestrictableItem, type RestrictableList, type RestrictionKind } from '../nation-restrictions.ts';
import { keyOfCopyPath } from './document-zips.ts';
import { documentHeading, labelOf, nationDocumentHistories, textLink } from './document-history.ts';
import { offlineSets } from './copy-lists.ts';
import { nations, publicCopies, sources as sourceRecords } from './content.ts';
import { opinionsOf } from './tribal-court-opinions.ts';

/** Compacts and Secretarial Procedures are agreements the United States publishes; everything else is the nation's law. */
export function documentKind(kind: string): RestrictionKind {
	return /compact|secretarial-procedures|agreement/.test(kind) ? 'agreements' : 'laws';
}

export function restrictableItems(nationId: string): RestrictableList {
	const record = nations().find((candidate) => candidate.id === nationId);
	const names = record ? [record.names.official, displayName(record.names.official)] : [];
	const copies = new Map(publicCopies().map((copy) => [copy.key, copy]));
	const offline = new Set((offlineSets().nations.get(nationId)?.files ?? []).map(([path]) => `copy:${keyOfCopyPath(path)}`));
	const items: RestrictableItem[] = [];
	const seen = new Set<string>();
	const add = (item: RestrictableItem) => {
		if (seen.has(item.id)) return;
		seen.add(item.id);
		items.push(offline.has(item.id) ? { ...item, offline: true } : item);
	};

	for (const history of nationDocumentHistories(nationId)) {
		const kind = documentKind(history.kind);
		const heading = documentHeading(history.title, names);
		for (const version of history.versions) {
			const link = textLink(version);
			const id = versionItemId(link, history.id, version.id);
			const label = labelOf(version, version.id);
			const copy = id.startsWith('copy:') ? copies.get(id.slice(5)) : undefined;
			const source = version.source ? sourceRecords().get(version.source) : undefined;
			add({
				id,
				kind,
				title: kind === 'agreements' ? `${heading}: ${label}` : label,
				original: copy?.links.at(-1) ?? source?.original_link ?? (link && !link.startsWith('/') ? link : undefined),
				bytes: copy?.bytes
			});
		}
	}

	// The other copies of the nation's laws this site keeps, which its downloads hold.
	for (const [path, bytes, , title = '', original = ''] of offlineSets().nations.get(nationId)?.files ?? []) {
		const key = keyOfCopyPath(path);
		if (key.startsWith('caselaw-access-project/')) continue;
		add({ id: `copy:${key}`, kind: 'laws', title: title || key.split('/').at(-1) || key, original: original || undefined, bytes });
	}

	for (const opinion of opinionsOf(nationId)) {
		add({
			id: `copy:${opinion.key}`,
			kind: 'opinions',
			title: opinion.name,
			citation: `${opinion.citation} (${opinion.court} ${opinion.year})`,
			original: opinion.original,
			bytes: copies.get(opinion.key)?.bytes
		});
	}
	return { nation: nationId, items };
}

