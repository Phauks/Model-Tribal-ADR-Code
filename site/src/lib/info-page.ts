/**
 * The shapes an item page passes to InfoPage.svelte, the site's one layout
 * for an item, like a wiki's article with its infobox (Trevor, Nov. 24, 2026).
 */
import type { CitationMark } from "./citation-marks.ts";

export interface InfoPicture {
  src: string;
  alt: string;
  credit: string;
  /** The picture's page at its source, with its date and rights. */
  original: string;
  width: number;
  height: number;
}

/** Another name for the item, shown under the title: "Kan-gi-shun-ca, as the Supreme Court Reporter prints it". */
export interface InfoName {
  name: string;
  note?: string;
  citations?: CitationMark[];
}
