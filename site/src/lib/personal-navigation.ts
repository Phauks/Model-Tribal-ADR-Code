// The Workspace and the Account pages as places, in the same shape as the
// site's six sections (src/lib/site-navigation.ts), so they are shown the
// way the sections are. Trevor chose on Nov. 27, 2026 (design/sidebar-workspace-profile,
// option B) to take them out of the side column:
//
// - the Workspace is a seventh tab at the end of the section bar, only for
//   people with workspace access, and its menu lists its pages under their
//   categories (SectionBar.svelte);
// - the Account pages are under the profile button (AccountLink.svelte);
// - on their own pages the side column lists them, as it lists a section's
//   pages (SiteSidebar.svelte).
import { accountPages, isAccountPath } from './account-menu.ts';
import type { NavigationLink, NavigationSection } from './site-navigation.ts';
import { groupWorkspacePages, type WorkspacePage } from './workspace-menu.ts';

/** The Workspace as a section: its pages under their categories, Overview as its home. */
export function workspaceSection(pages: readonly WorkspacePage[]): NavigationSection | undefined {
	if (pages.length === 0) return undefined;
	const groups = groupWorkspacePages(pages)
		.filter((group) => group.category)
		.map((group) => ({
			title: group.category as string,
			links: group.pages.map((item): NavigationLink => ({ label: item.label, link: item.link }))
		}));
	const overview = pages.find((item) => item.link === '/workspace');
	return { key: 'workspace', label: 'Workspace', home: overview?.link, groups, holds: ['/workspace'] };
}

/** The Account pages as a section, in the two groups of the profile button's menu; the first has no heading, as in the menu. */
export const accountSection: NavigationSection = {
	key: 'account',
	label: 'Your account',
	groups: [
		{ title: '', links: accountPages.filter((item) => item.group === 'yours').map(({ label, link }) => ({ label, link })) },
		{ title: 'Settings', links: accountPages.filter((item) => item.group === 'settings').map(({ label, link }) => ({ label, link })) }
	],
	holds: []
};

/** Whether a path is in the Workspace. */
export function isWorkspacePath(path: string): boolean {
	return path === '/workspace' || path.startsWith('/workspace/');
}

/** The personal place a path is in, if any: the Workspace or the Account pages. */
export function personalSectionOf(path: string, workspace: NavigationSection | undefined): NavigationSection | undefined {
	if (workspace && isWorkspacePath(path)) return workspace;
	if (isAccountPath(path)) return accountSection;
	return undefined;
}
