/**
 * Prerendered pages whose data names a nation's law or court opinion, as a
 * reader may see them once nations' choices are applied
 * (src/lib/restricted-files.ts has the rules). When anything on such a page
 * is restricted, the Worker draws the page again from its built data with
 * these filters applied (src/lib/server/restricted-pages.ts), so neither
 * the HTML nor the data the page runs on holds a hidden item. Pages with
 * nothing restricted go out as built.
 *
 * Counts the nation's own page already corrects from its live changes
 * (src/lib/nation-restrictions.ts, PageRestrictions) are left alone here.
 */
import { versionItemIdentifier } from './nation-restrictions.ts';
import {
	filterCopyRows,
	filterCopyTableRows,
	filterOpinionYears,
	filterOpinions,
	filterTimelineEntries,
	hiddenOpinions,
	levelOf,
	type SiteRestrictions
} from './restricted-files.ts';
import type { OpinionYear, TimelineEntry } from './timeline.ts';

type Data = Record<string, unknown>;

/** The pages drawn again, by their address. */
export const restrictedPageViews = [
	{ view: 'timeline', pattern: /^\/nations\/timeline$/ },
	{ view: 'nation', pattern: /^\/nations\/(?!(?:coverage|data|federal-offices|law|letter|map|recourse|state|timeline)$)([a-z0-9-]+)$/ },
	{ view: 'opinions', pattern: /^\/nations\/([a-z0-9-]+)\/opinions$/ },
	{ view: 'copies', pattern: /^\/copies\/list\/([a-z0-9-]+)$/ },
	{ view: 'chart-bar', pattern: /^\/nations\/data\/(?!(?:build|tables)\/)([a-z0-9-]+)\/(?!sources$)([^/]+)$/ }
] as const;

export type RestrictedPageView = (typeof restrictedPageViews)[number]['view'];

/** The view of a page's address, or undefined for a page never drawn again. */
export function restrictedPageView(path: string): { view: RestrictedPageView; match: RegExpExecArray } | undefined {
	for (const candidate of restrictedPageViews) {
		const match = candidate.pattern.exec(path);
		if (match) return { view: candidate.view, match };
	}
	return undefined;
}

interface DocumentLike {
	id: string;
	heading?: string;
	title?: string;
	versions: { id: string; label?: string; link?: string }[];
}

interface SourceLike {
	groups: { section: string; facts: string[] }[];
}

/**
 * A nation's page: hidden opinions, versions of documents and timeline
 * entries left out, with the References' mentions of the hidden versions,
 * and a document none of whose versions is left; cited opinions without
 * their Mentions. Each year's count of opinions on the timeline leaves out
 * the hidden ones.
 */
export function filterNationPage(data: Data, restrictions: SiteRestrictions, nation: string): Data {
	const result: Data = { ...data };
	const opinions = data.opinions as { shown: { key: string; topics: string[] }[] } | undefined;
	if (opinions) result.opinions = { ...opinions, shown: filterOpinions(opinions.shown, restrictions) };

	// Each hidden version, by its document's heading and its label, as the References name it.
	const gone = new Set<string>();
	const emptied = new Set<string>();
	const documents = (data.documents as DocumentLike[] | undefined) ?? [];
	result.documents = documents.flatMap((document) => {
		const versions = document.versions.filter((version) => {
			const hidden = levelOf(restrictions, versionItemIdentifier(version.link, document.id, version.id)) === 'hide';
			// The References name the section by the document's title or its heading.
			if (hidden) for (const section of [document.title, document.heading]) if (section) gone.add(`${section}\u0000${version.label ?? ''}`);
			return !hidden;
		});
		if (versions.length === document.versions.length) return [document];
		if (versions.length === 0) {
			emptied.add(document.id);
			return [];
		}
		return [{ ...document, versions }];
	});

	const timeline = data.timeline as { entries: TimelineEntry[]; opinions: OpinionYear[] } | undefined;
	if (timeline) {
		result.timeline = {
			...timeline,
			entries: filterTimelineEntries(timeline.entries, restrictions),
			opinions: filterOpinionYears(timeline.opinions, restrictions, nation)
		};
	}

	if (gone.size > 0) {
		const sources = (data.sources as SourceLike[] | undefined) ?? [];
		result.sources = sources.flatMap((source) => {
			const groups = source.groups
				.map((group) => ({ ...group, facts: group.facts.filter((fact) => !gone.has(`${group.section}\u0000${fact}`)) }))
				.filter((group) => group.facts.length > 0);
			if (groups.length === source.groups.length && groups.every((group, index) => group.facts.length === source.groups[index].facts.length)) return [source];
			return groups.length > 0 ? [{ ...source, groups }] : [];
		});
	}
	const outline = data.outline as { items: { link: string; children?: { link: string }[] }[] } | undefined;
	if (outline && emptied.size > 0) {
		result.outline = {
			...outline,
			items: outline.items.map((item) =>
				item.children ? { ...item, children: item.children.filter((child) => !emptied.has(child.link.replace(/^#document-/, ''))) } : item
			)
		};
	}
	return result;
}

/** A nation's table of court opinions: hidden ones left out, cited ones without their Mentions. */
export function filterOpinionsPage(data: Data, restrictions: SiteRestrictions): Data {
	return { ...data, opinions: filterOpinions((data.opinions as { key: string; topics: string[] }[]) ?? [], restrictions) };
}

/** One list of copies: hidden copies left out, cited ones linked to their originals. */
export function filterCopiesPage(data: Data, restrictions: SiteRestrictions): Data {
	return { ...data, copies: filterCopyRows((data.copies as Parameters<typeof filterCopyRows>[0]) ?? [], restrictions) };
}

/** The records one bar of a chart counts: hidden opinions left out and not counted. */
export function filterChartBarPage(data: Data, restrictions: SiteRestrictions): Data {
	const rows = (data.rows as Parameters<typeof filterCopyTableRows>[0]) ?? [];
	const kept = filterCopyTableRows(rows, restrictions);
	const removed = rows.length - kept.length;
	const changed = removed > 0 || kept.some((row, index) => row !== rows[index]);
	if (!changed) return data;
	const bar = data.bar as { value: number };
	const value = Math.max(0, bar.value - removed);
	const description = String(data.description ?? '').replace(bar.value.toLocaleString('en-US'), value.toLocaleString('en-US'));
	return { ...data, rows: kept, bar: { ...bar, value }, description };
}

/**
 * The full timeline, whose entries and counts are short arrays (src/routes/nations/timeline):
 * [kind, date, title, citation, detail, link, nations, italic] and [year, count, nation, mentions].
 */
export function filterTimelinePage(data: Data, restrictions: SiteRestrictions, kinds: readonly string[]): Data {
	const nations = (data.nations as { id: string }[]) ?? [];
	const entries = (data.entries as unknown[][]) ?? [];
	const documentKind = kinds.indexOf('document');
	const kept = entries.flatMap((entry) => {
		if (entry[0] !== documentKind) return [entry];
		const [shown] = filterTimelineEntries([{ kind: 'document', date: String(entry[1]), link: String(entry[5]) }], restrictions);
		if (!shown) return [];
		return shown.link === entry[5] ? [entry] : [[...entry.slice(0, 5), shown.link ?? '', ...entry.slice(6)]];
	});
	const opinions = ((data.opinions as unknown[][]) ?? []).flatMap((year) => {
		const nation = nations[Number(year[2])]?.id;
		const hidden = nation ? hiddenOpinions(restrictions, Number(year[0]), nation) : 0;
		if (hidden === 0) return [year];
		const count = Number(year[1]) - hidden;
		// Which of the year's Mentions numbers was the hidden opinion's is not known here, so they stay; a filter by word may count one more.
		return count > 0 ? [[year[0], count, ...year.slice(2)]] : [];
	});
	return { ...data, entries: kept, opinions };
}

/** A page's data as a reader may have it. */
export function filterPageData(view: RestrictedPageView, match: RegExpExecArray, data: Data, restrictions: SiteRestrictions, timelineKinds: readonly string[]): Data {
	switch (view) {
		case 'nation':
			return filterNationPage(data, restrictions, match[1]);
		case 'opinions':
			return filterOpinionsPage(data, restrictions);
		case 'copies':
			return filterCopiesPage(data, restrictions);
		case 'chart-bar':
			return filterChartBarPage(data, restrictions);
		case 'timeline':
			return filterTimelinePage(data, restrictions, timelineKinds);
	}
}
