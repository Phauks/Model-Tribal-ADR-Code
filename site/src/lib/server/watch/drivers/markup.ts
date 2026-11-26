/**
 * Small readers for XML feeds, sitemaps and HTML pages, written without a DOM
 * so they run the same in the Worker and in tests. They read only what the
 * drivers need: entries' titles, links and dates; sitemap addresses and
 * lastmod dates; and a page's main text.
 */

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text: string): string {
	return text
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
		.replace(/&([a-z]+);/gi, (whole, name: string) => entities[name.toLowerCase()] ?? whole);
}

/** The text inside the first <tag>…</tag> in a piece of XML, or null. */
export function firstElementText(xml: string, tag: string): string | null {
	const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
	return match ? decodeEntities(match[1]).trim() : null;
}

/** Every <tag>…</tag> block in a piece of XML. */
export function elements(xml: string, tag: string): string[] {
	return [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gi'))].map((match) => match[1]);
}

export interface FeedEntry {
	identifier: string;
	title: string;
	link: string | null;
	date: string | null;
	summary: string | null;
}

/** Reads an RSS 2.0 or Atom feed. */
export function readFeed(xml: string): FeedEntry[] {
	const rss = elements(xml, 'item');
	const blocks = rss.length > 0 ? rss : elements(xml, 'entry');
	return blocks.map((block) => {
		const atomLink = /<link[^>]*href="([^"]+)"/i.exec(block)?.[1] ?? null;
		const link = firstElementText(block, 'link') || (atomLink ? decodeEntities(atomLink) : null);
		const date = firstElementText(block, 'pubDate') ?? firstElementText(block, 'updated') ?? firstElementText(block, 'published') ?? firstElementText(block, 'dc:date');
		const identifier = firstElementText(block, 'guid') ?? firstElementText(block, 'id') ?? link ?? '';
		return {
			identifier,
			title: stripTags(firstElementText(block, 'title') ?? ''),
			link,
			date: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString().slice(0, 10) : null,
			summary: stripTags(firstElementText(block, 'description') ?? firstElementText(block, 'summary') ?? '') || null
		};
	});
}

export interface SitemapEntry {
	address: string;
	lastModified: string | null;
}

/** Reads a sitemap or a sitemap index; `index` is true for an index of other sitemaps. */
export function readSitemap(xml: string): { index: boolean; entries: SitemapEntry[] } {
	const index = /<sitemapindex[\s>]/i.test(xml);
	const blocks = elements(xml, index ? 'sitemap' : 'url');
	return {
		index,
		entries: blocks
			.map((block) => ({ address: firstElementText(block, 'loc') ?? '', lastModified: firstElementText(block, 'lastmod') }))
			.filter((entry) => entry.address !== '')
	};
}

export function stripTags(html: string): string {
	return decodeEntities(html.replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * A page's main text: what remains after scripts, styles, menus, headers,
 * footers and forms are removed, with whitespace collapsed. Optional
 * patterns remove text that changes on every visit, such as a printed date
 * or a session token (docs/source-watch.md, "Change detection").
 */
export function mainText(html: string, alsoRemove: RegExp[] = []): string {
	let text = html
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<(script|style|noscript|template|svg|nav|header|footer|form|aside|iframe)\b[\s\S]*?<\/\1>/gi, ' ');
	const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(text);
	if (main) text = main[1];
	text = stripTags(text);
	for (const pattern of alsoRemove) text = text.replace(pattern, ' ');
	return text.replace(/\s+/g, ' ').trim();
}

/**
 * A short difference between two texts, by sentence: what was taken out and
 * what was put in, up to a few hundred characters each, for the review page.
 * It is a pointer to the change, not a comparison a person should rely on.
 */
export function shortDifference(before: string, after: string, longest = 600): string {
	const split = (text: string) => text.split(/(?<=[.;:])\s+/).filter(Boolean);
	const beforeSentences = split(before);
	const afterSentences = split(after);
	const beforeSet = new Set(beforeSentences);
	const afterSet = new Set(afterSentences);
	const removed = beforeSentences.filter((sentence) => !afterSet.has(sentence));
	const added = afterSentences.filter((sentence) => !beforeSet.has(sentence));
	const clip = (sentences: string[]) => {
		const joined = sentences.join(' ');
		return joined.length > longest ? `${joined.slice(0, longest)}…` : joined;
	};
	const parts: string[] = [];
	if (removed.length > 0) parts.push(`Taken out: ${clip(removed)}`);
	if (added.length > 0) parts.push(`Put in: ${clip(added)}`);
	return parts.join('\n') || 'The text changed only in spacing or order.';
}
