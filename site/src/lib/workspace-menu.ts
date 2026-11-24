// The workspace's pages, as the left sidebar lists them under "Workspace"
// (Trevor asked on Nov. 22, 2026 for them to move there from a separate bar
// at the top of each workspace page). Each person sees only the pages their
// role opens; every page still checks for itself (src/lib/server/workspace.ts),
// so the list only decides what is shown.
import type { Permission } from './permissions.ts';

export type WorkspacePageName =
	| 'overview'
	| 'review-requests'
	| 'comments'
	| 'requests'
	| 'inbox'
	| 'outreach'
	| 'uploads'
	| 'intake'
	| 'nation-uploads'
	| 'reviews'
	| 'library'
	| 'contributors'
	| 'events'
	| 'rooms'
	| 'people'
	| 'nation-teams'
	| 'nation-pages'
	| 'access'
	| 'address-book'
	| 'changes'
	| 'nonprofit'
	| 'service-checks'
	| 'site-text'
	| 'sponsors'
	| 'orders'
	| 'activity';

/**
 * The groups the sidebar lists the workspace pages under (Trevor asked on
 * Nov. 23, 2026 for the pages to be organized into categories). Overview has
 * none and stays first, on its own.
 */
export const workspaceCategories = [
	'Writing and review',
	'Messages',
	'Files and sources',
	'Nations',
	'Events',
	'People and access',
	'Money',
	'Site'
] as const;

export type WorkspaceCategory = (typeof workspaceCategories)[number];

export interface WorkspacePage {
	name: WorkspacePageName;
	label: string;
	link: string;
	/** The group the sidebar lists it under; none for Overview. */
	category?: WorkspaceCategory;
	/** The permission a person needs to see the page listed; none means everyone with workspace access. */
	needs?: Permission;
}

/** In menu order: Overview, then each category's pages in the order of the categories. */
export const workspacePages: readonly WorkspacePage[] = [
	{ name: 'overview', label: 'Overview', link: '/workspace' },
	// Essays are started, edited and reviewed on their own pages; Workspace › Essays was removed (lead author, Nov. 23, 2026).
	// Drafts and sections people asked this person to review (src/lib/server/essay-review-requests.ts).
	{ name: 'review-requests', label: 'Review requests', link: '/workspace/review-requests', category: 'Writing and review', needs: 'comment' },
	// Comments that mention this person or answer them (src/lib/server/essay-comments.ts).
	{ name: 'comments', label: 'Comments for you', link: '/workspace/comments', category: 'Writing and review', needs: 'comment' },
	// Everyone sees the documents they can open, by role or by grant.
	{ name: 'reviews', label: 'Reviews', link: '/workspace/reviews', category: 'Writing and review' },
	{ name: 'inbox', label: 'Inbox', link: '/workspace/inbox', category: 'Messages', needs: 'read-mail' },
	{ name: 'requests', label: 'Requests', link: '/workspace/requests', category: 'Messages', needs: 'read-requests' },
	{ name: 'outreach', label: 'Outreach', link: '/workspace/outreach', category: 'Messages', needs: 'send-outreach' },
	{ name: 'address-book', label: 'Address book', link: '/workspace/address-book', category: 'Messages', needs: 'manage-address-book' },
	{ name: 'uploads', label: 'Uploads', link: '/workspace/uploads', category: 'Files and sources', needs: 'review-uploads' },
	// Files for the research library, filed by the intake script (docs/uploads.md, "Intake").
	{ name: 'intake', label: 'Intake', link: '/workspace/intake', category: 'Files and sources', needs: 'review-uploads' },
	// A nation reviewer reads and comments on files sent about their nation.
	{ name: 'nation-uploads', label: 'Files about your nation', link: '/workspace/nation-uploads', category: 'Files and sources', needs: 'comment-on-nation-uploads' },
	{ name: 'library', label: 'Source library', link: '/workspace/library', category: 'Files and sources', needs: 'search-source-library' },
	{ name: 'nation-teams', label: 'Nation teams', link: '/workspace/nation-teams', category: 'Nations', needs: 'manage-people' },
	// What nations published on their own pages, for the project to read afterwards.
	{ name: 'nation-pages', label: 'Nations’ changes', link: '/workspace/nation-pages', category: 'Nations', needs: 'review-nation-pages' },
	{ name: 'events', label: 'Events', link: '/workspace/events', category: 'Events', needs: 'manage-events' },
	// Video rooms of their own: instant, planned, public or private (src/lib/server/video-rooms.ts).
	{ name: 'rooms', label: 'Video rooms', link: '/workspace/rooms', category: 'Events', needs: 'host-video-rooms' },
	{ name: 'people', label: 'People', link: '/workspace/people', category: 'People and access', needs: 'manage-people' },
	{ name: 'contributors', label: 'Contributors', link: '/workspace/contributors', category: 'People and access', needs: 'read-contributors' },
	{ name: 'access', label: 'Access', link: '/workspace/access', category: 'People and access', needs: 'manage-people' },
	{ name: 'activity', label: 'Activity log', link: '/workspace/activity', category: 'People and access', needs: 'manage-people' },
	{ name: 'sponsors', label: 'Sponsors', link: '/workspace/sponsors', category: 'Money', needs: 'manage-sponsors' },
	// Orders from the Store, problems buyers report, and refunds (docs/store.md, docs/book-orders.md).
	{ name: 'orders', label: 'Orders', link: '/workspace/orders', category: 'Money', needs: 'manage-orders' },
	{ name: 'nonprofit', label: 'Nonprofit', link: '/workspace/nonprofit', category: 'Money', needs: 'manage-nonprofit' },
	// The site's own wording, edited on its pages (docs/site-text.md); the page checks the person's level.
	{ name: 'site-text', label: 'Site text', link: '/workspace/site-text', category: 'Site', needs: 'comment' },
	{ name: 'changes', label: 'Hidden changes', link: '/workspace/changes', category: 'Site', needs: 'hide-changes' },
	{ name: 'service-checks', label: 'Service checks', link: '/workspace/service-checks', category: 'Site', needs: 'check-services' }
];

export interface WorkspaceGroup {
	/** None for the pages that stand on their own, such as Overview. */
	category?: WorkspaceCategory;
	pages: WorkspacePage[];
}

/**
 * Splits a person's workspace pages into the sidebar's groups, in order. A
 * category none of their pages is in is left out.
 */
export function groupWorkspacePages(pages: readonly WorkspacePage[]): WorkspaceGroup[] {
	const groups: WorkspaceGroup[] = [];
	const loose = pages.filter((item) => !item.category);
	if (loose.length > 0) groups.push({ pages: loose });
	for (const category of workspaceCategories) {
		const inside = pages.filter((item) => item.category === category);
		if (inside.length > 0) groups.push({ category, pages: inside });
	}
	return groups;
}

/** The workspace pages listed for someone holding these permissions, in menu order. */
export function workspacePagesFor(permissions: readonly Permission[]): WorkspacePage[] {
	return workspacePages.filter((item) => !item.needs || permissions.includes(item.needs));
}

/** The workspace pages with these names, in menu order; unknown names are ignored. */
export function workspacePagesNamed(names: readonly string[]): WorkspacePage[] {
	return workspacePages.filter((item) => names.includes(item.name));
}

/** Whether a workspace link is the page at this path, or a page within it. */
export function isCurrentWorkspacePage(link: string, path: string): boolean {
	return link === '/workspace' ? path === link : path === link || path.startsWith(`${link}/`);
}
