/**
 * The eCFR (docs/source-watch.md, "Sources and how each is watched"). Once a
 * day the watcher reads the list of titles; when a watched title's latest
 * issue date moves, it asks the versions API which sections changed since
 * the last issue it saw, and reports each one.
 *
 * Watched: all of Title 25 (Indians), and the parts with Indian provisions in
 * other titles, such as 42 C.F.R. part 136 (Indian Health Service) and
 * 43 C.F.R. part 4 (hearings and appeals, including the Interior Board of
 * Indian Appeals).
 *
 * The eCFR's robots.txt bars the full-text and rendering endpoints
 * (/api/versioner/v1/full/ and /api/renderer/v1/content/), checked
 * Nov. 26, 2026, so the watcher links to the section and keeps no copy; the
 * text is fetched when a person accepts the change.
 */
import { defineWatcher, type FoundItem } from '../../src/lib/server/watch/watcher.ts';

const base = 'https://www.ecfr.gov/api/versioner/v1';

/** Each watched title, with the parts watched (none listed: the whole title). */
export const watchedTitles: { title: number; parts: string[] }[] = [
	{ title: 25, parts: [] },
	{ title: 42, parts: ['136', '136a', '137'] },
	{ title: 43, parts: ['4'] }
];

interface TitleRow {
	number: number;
	latest_issue_date?: string;
	latest_amended_on?: string;
}

interface Version {
	date: string;
	amendment_date: string;
	issue_date: string;
	identifier: string;
	name: string;
	part: string;
	substantive: boolean;
	removed: boolean;
	title: string;
	type: string;
}

/** The cursor: each watched title's latest issue date seen. */
export function readCursor(cursor: string | null): Record<string, string> {
	try {
		const parsed = cursor ? (JSON.parse(cursor) as Record<string, string>) : {};
		return typeof parsed === 'object' && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}

export function sectionLink(title: string | number, identifier: string): string {
	return `https://www.ecfr.gov/current/title-${title}/section-${identifier}`;
}

export function itemFor(version: Version): FoundItem {
	const name = version.name.replace(/\s+/g, ' ').trim();
	return {
		sourceIdentifier: `title-${version.title}/${version.identifier}/${version.amendment_date}`,
		kind: version.removed ? 'regulation-section-removed' : 'regulation-section',
		title: `${version.title} C.F.R. ${name}`,
		date: version.amendment_date,
		link: sectionLink(version.title, version.identifier),
		feeds: Number(version.title) === 25 ? ['regulation-sections', 'federal-regulations'] : ['federal-regulations'],
		facts: { title: Number(version.title), part: version.part, section: version.identifier, substantive: version.substantive, removed: version.removed, issueDate: version.issue_date }
	};
}

export default defineWatcher({
	identifier: 'ecfr',
	title: 'eCFR',
	tier: 1,
	feeds: ['regulation-sections', 'federal-regulations'],
	driver: 'api',
	schedule: '23 14 * * *',
	hosts: ['www.ecfr.gov'],
	hosting: 'serve',
	documentation: ['https://www.ecfr.gov/developers/documentation/api/v1', 'https://www.ecfr.gov/robots.txt'],
	async check(context) {
		const seen = readCursor(context.cursor);
		const { response } = await context.fetch(`${base}/titles.json`, { accept: 'application/json' });
		if (!response.ok) {
			await response.body?.cancel();
			throw new Error(`www.ecfr.gov answered ${response.status}`);
		}
		const titles = ((await response.json()) as { titles?: TitleRow[] }).titles ?? [];
		const items: FoundItem[] = [];
		const next = { ...seen };
		for (const { title, parts } of watchedTitles) {
			const row = titles.find((entry) => entry.number === title);
			const latest = row?.latest_issue_date;
			if (!latest) continue;
			const last = seen[title];
			if (!last) {
				// A first run only notes where each title stands.
				next[title] = latest;
				continue;
			}
			if (latest <= last) continue;
			for (const part of parts.length > 0 ? parts : [null]) {
				const query = new URLSearchParams({ 'issue_date[gte]': last });
				if (part) query.set('part', part);
				const answer = await context.fetch(`${base}/versions/title-${title}.json?${query}`, { accept: 'application/json' });
				if (!answer.response.ok) {
					await answer.response.body?.cancel();
					throw new Error(`www.ecfr.gov answered ${answer.response.status} for title ${title}`);
				}
				const versions = ((await answer.response.json()) as { content_versions?: Version[] }).content_versions ?? [];
				items.push(...versions.filter((version) => version.type === 'section').map(itemFor));
			}
			next[title] = latest;
		}
		return { items, cursor: JSON.stringify(next) };
	},
	rules: [
		{
			name: 'editorial-change',
			decide: (item) => (item.facts?.substantive === false && item.facts?.removed !== true ? { action: 'close', reason: 'The eCFR marks this change as not substantive (an editorial change).', relevance: 0.1 } : null)
		},
		{
			name: 'section-changed',
			decide: (item) =>
				item.facts?.removed === true
					? { action: 'review', reason: 'A section was removed.', proposed: 'new-version', relevance: 0.9 }
					: { action: 'review', reason: 'A substantive change to a watched section.', proposed: 'new-version', relevance: 0.85 }
		}
	]
});
