/**
 * Small helpers for the site's navigation: the "Go to a nation" box in the
 * Nations menu (SectionBar.svelte) and the groups the reader opened or shut
 * in the side column (SiteSidebar.svelte), worked out without the browser so
 * they can be tested.
 */
import type { OutlineItem } from './site-sections.ts';

/** The entries whose names hold every word of the filter, ignoring case and accents. */
export function filterEntries(items: OutlineItem[], filter: string): OutlineItem[] {
	const words = fold(filter).split(/\s+/).filter(Boolean);
	if (words.length === 0) return items;
	return items.filter((item) => {
		const name = fold(item.label);
		return words.every((word) => name.includes(word));
	});
}

function fold(text: string): string {
	return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US');
}

/** The storage key for the groups the reader opened or shut, such as the Workspace, kept from page to page. */
export const sectionChoicesKey = 'sidebar-open-sections';

/**
 * Reads the stored choices: an object of section address to open (true) or
 * shut (false). An older list of open addresses is read as all open.
 */
export function parseSectionChoices(text: string | null): Record<string, boolean> {
	try {
		const value: unknown = JSON.parse(text ?? '{}');
		if (Array.isArray(value)) {
			return Object.fromEntries(value.filter((link): link is string => typeof link === 'string').map((link) => [link, true]));
		}
		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
			);
		}
	} catch {
		// Not something this site wrote; start afresh.
	}
	return {};
}
