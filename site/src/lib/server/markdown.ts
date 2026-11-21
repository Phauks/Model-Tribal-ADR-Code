/**
 * Renders the Markdown in content records to HTML at build time, resolving
 * the project's two link forms (docs/terminology.md, docs/citation-style.md):
 *
 *   [[id]] and [[id|shown text]]   a link to a glossary entry
 *   [@key] and [@key, p. 3]        a citation of a source record
 *
 * Citations become numbered notes collected in a Notes object, which the page
 * prints at the end, each linked to its source.
 */
import { marked } from 'marked';
import { glossary, sources, type SourceRecord } from './content.ts';

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

/** A short citation in the project's style, as HTML. */
export function formatSource(source: SourceRecord | undefined, key: string, locator?: string): string {
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
	const url = link && URL.canParse(link) ? new URL(link) : undefined;
	if (url && (url.protocol === 'https:' || url.protocol === 'http:')) {
		text += `. <a href="${escapeHtml(url.href)}">${escapeHtml(url.hostname)}</a>`;
	}
	return text;
}

export interface Note {
	number: number;
	key: string;
	html: string;
}

/** Numbered notes for one page. The same source and locator reuse one number. */
export class Notes {
	readonly list: Note[] = [];

	add(key: string, locator?: string): number {
		const existing = this.list.find(
			(note) => note.key === key && note.html === formatSource(sources().get(key), key, locator)
		);
		if (existing) return existing.number;
		const number = this.list.length + 1;
		this.list.push({ number, key, html: formatSource(sources().get(key), key, locator) });
		return number;
	}
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

function resolveCitations(markdown: string, notes: Notes): string {
	return markdown.replace(citationPattern, (_whole, inside: string) => {
		const markers = inside.split(';').map((part) => {
			const match = part.trim().match(/^@([a-z0-9-]+)(?:,\s*(.+))?$/);
			if (!match) return escapeHtml(part);
			const number = notes.add(match[1], match[2]?.trim());
			return `<a href="#note-${number}" class="note-marker" aria-label="Note ${number}">${number}</a>`;
		});
		return `<sup>${markers.join(', ')}</sup>`;
	});
}

/** Markdown with term links and citations, as block HTML. */
export function renderMarkdown(markdown: string, notes: Notes): string {
	const prepared = resolveCitations(resolveTermLinks(markdown.normalize('NFC')), notes);
	return marked.parse(prepared, { async: false });
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
