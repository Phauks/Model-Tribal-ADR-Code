/**
 * Draws a part of a case's or law's box from its words, as the page shows
 * it, so a draft or a newly published edit shows in place before the site is
 * rebuilt (docs/site-text.md, "Record text"). Citation numbers start again
 * at 1 in a part drawn alone; the rebuilt page numbers them in order.
 */
import { partInnerHtml, recordTextHeadings } from '#lib/record-text.ts';
import type { SiteTextEntry } from '#lib/site-text-markers.ts';
import { essayLibrary } from './essay-pages.ts';
import { renderWithCitations } from './essay-citations.ts';
import type { PieceState } from './site-text.ts';

export async function recordPartHtml(entry: SiteTextEntry, words: string): Promise<string | null> {
	if (!entry.record) return null;
	return partInnerHtml((await renderWithCitations(`::: ${entry.record.part}\n${words}\n:::\n`, essayLibrary)).html);
}

/**
 * What the editing box needs for a part of a box: its heading, and the
 * words it shows with drafts drawn as HTML when they differ from what the
 * page was built with (null when the built page already shows them).
 */
export async function recordPiece(entry: SiteTextEntry, state: PieceState | undefined): Promise<{ heading: string; html: string | null } | null> {
	if (!entry.record) return null;
	const heading = recordTextHeadings[entry.record.part];
	const shown = state?.draft ? (state.draft.words ?? entry.words) : (state?.published ?? entry.words);
	return { heading, html: state ? await recordPartHtml(entry, shown) : null };
}
