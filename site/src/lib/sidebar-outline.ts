/**
 * A small helper for the site's navigation: the groups the reader opened or
 * shut in the side column (SiteSidebar.svelte), worked out without the
 * browser so it can be tested.
 */

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
		// expected: not something this site wrote; start afresh.
	}
	return {};
}
