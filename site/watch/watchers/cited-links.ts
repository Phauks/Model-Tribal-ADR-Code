/**
 * Cited links (docs/source-watch.md, "Reference and the rest of the site"):
 * every source record's original link, re-checked on a rotation of about 60
 * days. A changed file is a candidate new version of that record; a link
 * that stops answering is listed for a person, who can add it to the Wayback
 * queue or find where the document moved.
 *
 * About 9,300 source records have a link (Nov. 26, 2026), so the watcher
 * checks two or three links every ten minutes, spread over the hosts by the
 * hosts' desks. Links the Federal Register and eCFR watchers cover, and
 * archive.org links, are skipped.
 */
import { checkPage } from '../../src/lib/server/watch/drivers/page.ts';
import type { KnownSource } from '../../src/lib/server/watch/known.ts';
import { defineWatcher, type FoundItem } from '../../src/lib/server/watch/watcher.ts';

export const rotationDays = 60;
const runsEachDay = 24 * 6;
const skippedHosts = /(^|\.)(archive\.org|federalregister\.gov|ecfr\.gov)$/i;

/** The links to check, in a fixed order, so the cursor (an offset) walks them all. */
export function linksToCheck(sources: KnownSource[]): KnownSource[] {
	return sources
		.filter((source) => {
			if (!source.link || !URL.canParse(source.link)) return false;
			return !skippedHosts.test(new URL(source.link).hostname);
		})
		.sort((first, second) => first.key.localeCompare(second.key));
}

export function linksEachRun(total: number): number {
	return Math.max(1, Math.ceil(total / (rotationDays * runsEachDay)));
}

export default defineWatcher({
	identifier: 'cited-links',
	title: 'Cited links',
	tier: 1,
	feeds: ['source-copies', 'governing-documents', 'tribal-constitutions', 'tribal-codes', 'intergovernmental-agreements', 'treaties', 'federal-statutes', 'nation:official_images', 'nation:nearby_state_courts', 'nation:treaties', 'nation:governing_documents'],
	driver: 'page',
	schedule: '*/10 * * * *',
	// Any host a source record links to; each still goes through its own host desk.
	hosts: ['*'],
	hosting: 'private',
	documentation: ['https://www.rfc-editor.org/rfc/rfc9309', 'https://contentsignals.org/'],
	async check(context) {
		const links = linksToCheck((await context.known()).sources);
		if (links.length === 0) return { items: [], cursor: context.cursor };
		const start = Number(context.cursor ?? 0) % links.length;
		const count = linksEachRun(links.length);
		const items: FoundItem[] = [];
		for (let offset = 0; offset < count; offset += 1) {
			const source = links[(start + offset) % links.length];
			const outcome = await checkPage(context, 'cited-links', { address: source.link as string, sourceIdentifier: source.key, title: source.title, feeds: ['source-copies'], knownSha256: source.checksum ?? null });
			if (outcome.outcome === 'changed' || outcome.outcome === 'gone') items.push({ ...outcome.item, facts: { ...outcome.item.facts, record: source.key, recordKind: source.kind } });
		}
		return { items, cursor: String((start + count) % links.length) };
	},
	rules: [
		{
			name: 'link-gone',
			decide: (item) => (item.kind === 'link-gone' ? { action: 'review', reason: 'The link no longer answers. Find where it moved, or add it to the Wayback queue.', proposed: 'note', relevance: 0.7 } : null)
		},
		{
			name: 'changed-file',
			decide: (item) => (item.kind === 'changed-file' ? { action: 'review', reason: 'The file at a cited link changed since the record was made.', proposed: 'new-version', relevance: 0.8 } : null)
		}
	]
});
