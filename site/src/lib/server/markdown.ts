/**
 * Renders the Markdown in content records to HTML at build time, resolving
 * the project's two link forms (docs/terminology.md, docs/citation-style.md):
 *
 *   [[id]] and [[id|shown text]]   a link to a glossary entry
 *   [@key] and [@key, p. 3]        a citation of a source record
 *
 * Citations become numbered markers in square brackets, linked to the page's
 * Sources section and back (src/lib/citation-marks.ts); a CitationCollector
 * numbers them and records what each source supports.
 */
import { marked } from 'marked';
import { marksHtml, type CitationMark } from '../citation-marks.ts';
import { verifyLink, fileName } from '../checksums.ts';
import { copyPagePath, copyPath, mediaLabel } from '../public-copies.ts';
import { readingLinksHtml } from '../reading-links.ts';
import { glossary, publicCopyFor, type SourceRecord } from './content.ts';

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** A short citation in the project's style, as HTML. */
export function formatSource(
	source: SourceRecord | undefined,
	key: string,
	locator?: string
): string {
	if (!source) {
		return `${escapeHtml(key)}${locator ? `, ${escapeHtml(locator)}` : ''}`;
	}
	const citation = source.citation;
	const authors = (citation.author ?? [])
		.map((name) => name.literal ?? [name.given, name.family].filter(Boolean).join(' '))
		.filter(Boolean);
	const year = citation.issued?.['date-parts']?.[0]?.[0];
	const title = citation.title ?? key;
	const link = source.original_link ?? citation.URL;
	const parts: string[] = [];
	if (authors.length > 0) parts.push(escapeHtml(authors.join(', ')));
	parts.push(
		source.kind.endsWith('statute') || source.kind.endsWith('regulation')
			? escapeHtml(title)
			: `<cite>${escapeHtml(title)}</cite>`
	);
	let text = parts.join(', ');
	if (year) text += ` (${year})`;
	if (locator) text += `, ${escapeHtml(locator)}`;
	const url = webAddress(link);
	const archive = source.archives?.find((copy) => webAddress(copy.link));
	const archiveUrl = webAddress(archive?.link);
	if (url) {
		// Both links are always written; the reader's "Source links" setting
		// hides one with CSS (site/DESIGN.md, section 6, "Citations").
		const original = `<a class="source-original" href="${escapeHtml(url.href)}">${escapeHtml(url.hostname)}</a>`;
		if (archiveUrl) {
			const captured = archive?.captured ? `, ${escapeHtml(formatCaptureDate(archive.captured))}` : '';
			text +=
				`. <span class="source-links has-archive">${original}` +
				`<span class="source-archived"><span class="source-separator">; </span>` +
				`<a href="${escapeHtml(archiveUrl.href)}">archived copy${captured}</a></span></span>`;
		} else {
			text += `. <span class="source-links">${original}</span>`;
		}
	}
	return text + savedCopyLink(source) + readingLinksHtml(source.reading_links);
}

/**
 * A link to the copy this site keeps of the source's document, when it keeps
 * one (src/lib/public-copies.ts), with the date the copy was made. The
 * original address stays in the citation as the source cited.
 */
export function savedCopyLink(source: SourceRecord | undefined): string {
	if (!source) return '';
	const copy = publicCopyFor(source.original_link) ?? publicCopyFor(source.citation.URL);
	if (!copy) return '';
	const saved = copy.captured ? `, saved ${escapeHtml(formatCaptureDate(copy.captured))}` : '';
	// A link to check a downloaded copy against its SHA-256 (src/lib/checksums.ts), as Trevor asked on Nov. 23, 2026.
	// The link opens the copy's page, inside the site's masthead and sidebar; the Verify link names the file itself.
	const page = copyPagePath(copy);
	const verify = escapeHtml(verifyLink(copy.sha256, fileName(copyPath(copy))));
	return ` <span class="source-saved">(<a href="${escapeHtml(page)}">copy on this site${saved}, ${mediaLabel(copy.mediaType)}</a>; <a class="source-verify" href="${verify}">verify a download</a>)</span>`;
}

function webAddress(link: string | undefined): URL | undefined {
	const url = link && URL.canParse(link) ? new URL(link) : undefined;
	return url && (url.protocol === 'https:' || url.protocol === 'http:') ? url : undefined;
}

const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** "2026-11-21" as "Nov. 21, 2026", the style guide's form for dates. */
export function formatCaptureDate(date: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
	if (!match) return date;
	return `${monthNames[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}`;
}

/**
 * Collects the citations on one page. cite() records a citation and returns
 * the marker to show for it (src/lib/citation-marks.ts), numbered by its
 * source's place in the page's Sources section.
 */
export interface CitationCollector {
	cite(key: string, locator?: string): CitationMark;
}

const termLinkPattern = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;
const citationPattern = /\[(@[a-z0-9-]+[^\]]*)\]/g;

function resolveTermLinks(markdown: string): string {
	const entries = new Map(glossary().map((entry) => [entry.id, entry]));
	return markdown.replace(termLinkPattern, (_whole, id: string, shownText?: string) => {
		const entry = entries.get(id);
		if (!entry) {
			throw new Error(`Glossary link [[${id}]] points to no entry in content/glossary/`);
		}
		const text = shownText ?? entry.term;
		return `<a class="term-link" href="/glossary/${id}">${escapeHtml(text)}</a>`;
	});
}

/** A citation with the spaces before it, so the marker sits right against the words it supports. */
const citationWithSpacePattern = /[ \t]*\[(@[a-z0-9-]+[^\]]*)\]/g;

function resolveCitations(markdown: string, citations: CitationCollector): string {
	return markdown.replace(citationWithSpacePattern, (whole, inside: string) => {
		const parts = inside.split(';').map((part) => part.trim().match(/^@([a-z0-9-]+)(?:,\s*(.+))?$/));
		// Text in brackets that is not wholly citations stays as it was written.
		if (parts.some((match) => !match)) return escapeHtml(whole);
		const marks: CitationMark[] = [];
		for (const match of parts) marks.push(citations.cite(match![1], match![2]?.trim()));
		return marksHtml(marks);
	});
}

/** Markdown with term links and citations, as block HTML. */
export function renderMarkdown(markdown: string, citations: CitationCollector): string {
	const prepared = resolveCitations(resolveTermLinks(markdown.normalize('NFC')), citations);
	return marked.parse(prepared, { async: false });
}

/**
 * Markdown as plain text with no citations: each term link becomes its words,
 * and emphasis and other Markdown marks are dropped. Used for short summaries,
 * such as the text of a glossary hover card.
 */
export function plainText(markdown: string): string {
	const entries = new Map(glossary().map((entry) => [entry.id, entry]));
	return markdown
		.normalize('NFC')
		.replace(citationPattern, '')
		.replace(
			termLinkPattern,
			(_whole, id: string, shownText?: string) => shownText ?? entries.get(id)?.term ?? id
		)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/[*_`]/g, '')
		.replace(/\s+/g, ' ')
		.replace(/\s+([.,;:)])/g, '$1')
		.trim();
}

/**
 * A changelog file as HTML: drops the file's own title and the note to
 * maintainers before the first version, and moves every heading down one
 * level so each version sits under its track's heading on the page.
 */
export function renderChangelog(markdown: string): string {
	const firstVersion = markdown.indexOf('\n## ');
	const body = firstVersion === -1 ? '' : markdown.slice(firstVersion + 1);
	return marked.parse(body, {
		async: false,
		walkTokens(token) {
			if (token.type === 'heading') token.depth = Math.min(token.depth + 1, 6);
		}
	});
}
