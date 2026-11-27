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
//
// Navigation labels are in Title Case, like the sections' (Trevor, Nov. 27,
// 2026), so the labels here are written out rather than taken from the
// pages' own names in workspace-menu.ts and account-menu.ts.
import { accountPages, isAccountPath, type AccountGroup } from './account-menu.ts';
import type { NavigationIconName, NavigationLink, NavigationSection } from './site-navigation.ts';
import { groupWorkspacePages, type WorkspaceCategory, type WorkspacePage, type WorkspacePageName } from './workspace-menu.ts';

/** How the section bar and the side column name each workspace page, and its icon. */
const workspaceLinks: Record<WorkspacePageName, { label: string; icon: NavigationIconName }> = {
	overview: { label: 'Overview', icon: 'briefcase' },
	'review-requests': { label: 'Review Requests', icon: 'inbox' },
	comments: { label: 'Comments for You', icon: 'message-square' },
	reviews: { label: 'Reviews', icon: 'file-search' },
	stubs: { label: 'Stubs', icon: 'file-pen' },
	inbox: { label: 'Inbox', icon: 'inbox' },
	requests: { label: 'Requests', icon: 'flag' },
	outreach: { label: 'Outreach', icon: 'send' },
	'address-book': { label: 'Address Book', icon: 'book-user' },
	uploads: { label: 'Uploads', icon: 'upload' },
	intake: { label: 'Intake', icon: 'folder-input' },
	'nation-uploads': { label: 'Files About Your Nation', icon: 'folder' },
	library: { label: 'Source Library', icon: 'library' },
	watch: { label: 'Source Watch', icon: 'radar' },
	'nation-teams': { label: 'Nation Teams', icon: 'users' },
	'nation-pages': { label: 'Nations’ Changes', icon: 'file-diff' },
	events: { label: 'Events', icon: 'calendar' },
	rooms: { label: 'Video Rooms', icon: 'video' },
	people: { label: 'People', icon: 'users' },
	contributors: { label: 'Contributors', icon: 'contact' },
	access: { label: 'Access', icon: 'key-round' },
	activity: { label: 'Activity Log', icon: 'scroll-text' },
	sponsors: { label: 'Sponsors', icon: 'hand-coins' },
	orders: { label: 'Orders', icon: 'receipt' },
	nonprofit: { label: 'Nonprofit', icon: 'landmark' },
	'site-text': { label: 'Site Text', icon: 'text-cursor-input' },
	changes: { label: 'Hidden Changes', icon: 'eye-off' },
	'service-checks': { label: 'Service Checks', icon: 'activity' },
	wayback: { label: 'Wayback Captures', icon: 'archive' }
};

const workspaceCategoryLabels: Record<WorkspaceCategory, string> = {
	'Writing and review': 'Writing and Review',
	Messages: 'Messages',
	'Files and sources': 'Files and Sources',
	Nations: 'Nations',
	Events: 'Events',
	'People and access': 'People and Access',
	Money: 'Money',
	Site: 'Site'
};

/** The Workspace as a section: its pages under their categories, Overview as its home. */
export function workspaceSection(pages: readonly WorkspacePage[]): NavigationSection | undefined {
	if (pages.length === 0) return undefined;
	const groups = groupWorkspacePages(pages).flatMap((group) =>
		group.category
			? [{ title: workspaceCategoryLabels[group.category], links: group.pages.map((item): NavigationLink => ({ ...workspaceLinks[item.name], link: item.link })) }]
			: []
	);
	const overview = pages.find((item) => item.name === 'overview');
	return { key: 'workspace', label: 'Workspace', home: overview?.link, groups, holds: ['/workspace'] };
}

/** How the profile button's menu and the side column name each account page, and its icon. */
export const accountLinks: Record<string, { label: string; icon: NavigationIconName }> = {
	'/profile': { label: 'Profile and Credit', icon: 'user-round' },
	'/following': { label: 'Following', icon: 'bell' },
	'/uploads': { label: 'Your Uploads', icon: 'upload' },
	'/profile/nation-team': { label: 'Nation Team', icon: 'users' },
	'/starred': { label: 'Starred Pages', icon: 'star' },
	'/account/security': { label: 'Sign-In and Security', icon: 'shield-check' },
	'/account/email': { label: 'Email and Notifications', icon: 'mail' },
	'/account/orders': { label: 'Your Orders', icon: 'shopping-bag' },
	'/account/sponsorship': { label: 'Sponsorship', icon: 'hand-heart' },
	'/account/data': { label: 'Your Data', icon: 'database' }
};

/** The account pages in one group of the menu, as navigation links. */
export function accountGroupLinks(group: AccountGroup): NavigationLink[] {
	return accountPages.filter((item) => item.group === group).map((item) => ({ ...accountLinks[item.link], link: item.link }));
}

/** Starred pages, the reader's own, kept on this device: in the account menu after the person's pages. */
export const starredPagesLink: NavigationLink = { ...accountLinks['/starred'], link: '/starred' };

/** The Account pages as a section, in the two groups of the profile button's menu; the first has no heading, as in the menu. */
export const accountSection: NavigationSection = {
	key: 'account',
	label: 'Your Account',
	groups: [
		{ title: '', links: accountGroupLinks('yours') },
		{ title: 'Settings', links: accountGroupLinks('settings') }
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
