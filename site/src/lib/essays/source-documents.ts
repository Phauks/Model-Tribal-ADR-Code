/**
 * Links to a source's documents, for the essay editor (Trevor, Nov. 22, 2026:
 * "I want easy access to the source documents as well, so provide links to
 * them"). They are read from the source's full citation as the site writes
 * it (src/lib/server/markdown.ts): the original address, an archived copy
 * when there is one, and the copy this site keeps (src/lib/public-copies.ts).
 */
import { citationReferences } from './syntax.ts';
import type { Node as EditorNode } from 'prosemirror-model';

export interface SourceDocuments {
	/** The site's own copy, such as "/copies/govinfo/…", and what kind of file it is. */
	copy?: { href: string; label: string };
	/** Where the source was published. */
	original?: { href: string; label: string };
	/** An archived copy of the original, such as a Wayback Machine capture. */
	archived?: { href: string; label: string };
}

function decode(text: string): string {
	return text
		.replaceAll('&amp;', '&')
		.replaceAll('&#38;', '&')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>');
}

function link(html: string, pattern: RegExp): { href: string; label: string } | undefined {
	const match = pattern.exec(html);
	return match ? { href: decode(match[1]), label: decode(match[2].replace(/<[^>]+>/g, '')).trim() } : undefined;
}

/** The document links in a source's full citation, as HTML. */
export function sourceDocuments(citationHtml: string): SourceDocuments {
	const documents: SourceDocuments = {};
	// The saved copy leads the reading links after the citation: "Saved copy (official report, PDF, Nov. 23, 2026; SHA-256)".
	const saved = /<span class="source-saved"><a href="([^"]+)">([\s\S]*?)<\/a>\s*\(([^;<)]*)/.exec(citationHtml);
	const copy = saved ? { href: decode(saved[1]), label: decode(`${saved[2]} (${saved[3].trim()})`) } : undefined;
	// The essays' citations (src/lib/server/essay-library.ts) link the address as written; the site's other pages mark it "source-original".
	const citation = citationHtml.replace(/ ?<span class="reading-links">[\s\S]*$/, '').replace(/<span class="source-archived">[\s\S]*?<\/a><\/span>/g, '');
	const original = link(citation, /<a (?:class="source-original" )?href="(https?:\/\/[^"]+)">([\s\S]*?)<\/a>/);
	if (original && URL.canParse(original.href)) original.label = new URL(original.href).hostname;
	const archived = link(citationHtml, /<span class="source-archived">[\s\S]*?<a href="([^"]+)">([\s\S]*?)<\/a>/);
	if (copy) documents.copy = copy;
	if (original) documents.original = original;
	if (archived) documents.archived = archived;
	return documents;
}

/** The source keys an editor document cites, in the order it first cites them, case and law boxes included. */
export function citedKeys(doc: EditorNode): string[] {
	const keys = new Set<string>();
	doc.descendants((node) => {
		if (node.type.name === 'citation') {
			for (const reference of citationReferences(String(node.attrs.text))) keys.add(reference.key);
		} else if ((node.type.name === 'case_block' || node.type.name === 'law_block') && node.attrs.source) {
			keys.add(String(node.attrs.source));
		}
		return true;
	});
	return [...keys];
}

/** A citation in plain text without its web address, which the document links give. */
export function citationWithoutAddress(text: string): string {
	return text.replace(/\s*(?:https?:\/\/|www\.)\S+/g, '').replace(/[,.\s]+$/, '');
}
