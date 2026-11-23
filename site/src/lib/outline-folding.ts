/**
 * Which entries of the sidebar outline start open (SiteSidebar.svelte).
 * Every entry with entries under it folds open and shut (Trevor, Nov. 22,
 * 2026: "Allow items in left sidebar to collapse at each level"). An entry
 * starts open when it is, or holds, the page or heading being read, and
 * shut otherwise, so a long outline shows its top level and the way to
 * where the reader is. What the reader opens or shuts stays so on that page.
 */
import type { OutlineItem } from './site-sections.ts';

/** Whether an entry is, or holds, an entry for which `here` is true. */
export function holds(item: OutlineItem, here: (item: OutlineItem) => boolean): boolean {
	return here(item) || (item.children ?? []).some((child) => holds(child, here));
}

/** Whether an entry with entries under it shows them: the reader's choice, or open when it holds where the reader is. */
export function isUnfolded(item: OutlineItem, choices: Record<string, boolean>, here: (item: OutlineItem) => boolean): boolean {
	return choices[item.link] ?? holds(item, here);
}
