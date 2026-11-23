// The workspace's pages, as the left sidebar lists them under "Workspace"
// (Trevor asked on Nov. 22, 2026 for them to move there from a separate bar
// at the top of each workspace page). Each person sees only the pages their
// role opens; every page still checks for itself (src/lib/server/workspace.ts),
// so the list only decides what is shown.
import type { Permission } from './permissions.ts';

export type WorkspacePageName =
	| 'overview'
	| 'essays'
	| 'review-requests'
	| 'requests'
	| 'inbox'
	| 'outreach'
	| 'uploads'
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
	| 'sponsors'
	| 'book-orders'
	| 'activity';

export interface WorkspacePage {
	name: WorkspacePageName;
	label: string;
	link: string;
	/** The permission a person needs to see the page listed; none means everyone with workspace access. */
	needs?: Permission;
}

export const workspacePages: readonly WorkspacePage[] = [
	{ name: 'overview', label: 'Overview', link: '/workspace' },
	// Everyone sees the essays they can open, by role or by grant.
	{ name: 'essays', label: 'Essays', link: '/workspace/essays' },
	// Drafts and sections people asked this person to review (src/lib/server/essay-review-requests.ts).
	{ name: 'review-requests', label: 'Review requests', link: '/workspace/review-requests', needs: 'comment' },
	{ name: 'requests', label: 'Requests', link: '/workspace/requests', needs: 'read-requests' },
	{ name: 'inbox', label: 'Inbox', link: '/workspace/inbox', needs: 'read-mail' },
	{ name: 'outreach', label: 'Outreach', link: '/workspace/outreach', needs: 'send-outreach' },
	{ name: 'uploads', label: 'Uploads', link: '/workspace/uploads', needs: 'review-uploads' },
	// A nation reviewer reads and comments on files sent about their nation.
	{ name: 'nation-uploads', label: 'Files about your nation', link: '/workspace/nation-uploads', needs: 'comment-on-nation-uploads' },
	// Everyone sees the documents they can open, by role or by grant.
	{ name: 'reviews', label: 'Reviews', link: '/workspace/reviews' },
	{ name: 'library', label: 'Source library', link: '/workspace/library', needs: 'search-source-library' },
	{ name: 'contributors', label: 'Contributors', link: '/workspace/contributors', needs: 'read-contributors' },
	{ name: 'events', label: 'Events', link: '/workspace/events', needs: 'manage-events' },
	// Video rooms of their own: instant, planned, public or private (src/lib/server/video-rooms.ts).
	{ name: 'rooms', label: 'Video rooms', link: '/workspace/rooms', needs: 'host-video-rooms' },
	{ name: 'people', label: 'People', link: '/workspace/people', needs: 'manage-people' },
	{ name: 'nation-teams', label: 'Nation teams', link: '/workspace/nation-teams', needs: 'manage-people' },
	// What nations published on their own pages, for the project to read afterwards.
	{ name: 'nation-pages', label: 'Nations’ changes', link: '/workspace/nation-pages', needs: 'review-nation-pages' },
	{ name: 'access', label: 'Access', link: '/workspace/access', needs: 'manage-people' },
	{ name: 'address-book', label: 'Address book', link: '/workspace/address-book', needs: 'manage-address-book' },
	{ name: 'changes', label: 'Hidden changes', link: '/workspace/changes', needs: 'hide-changes' },
	{ name: 'nonprofit', label: 'Nonprofit', link: '/workspace/nonprofit', needs: 'manage-nonprofit' },
	{ name: 'service-checks', label: 'Service checks', link: '/workspace/service-checks', needs: 'check-services' },
	{ name: 'sponsors', label: 'Sponsors', link: '/workspace/sponsors', needs: 'manage-sponsors' },
	// Printed-copy orders, problems buyers report, and refunds (docs/book-orders.md).
	{ name: 'book-orders', label: 'Book orders', link: '/workspace/book-orders', needs: 'manage-book-orders' },
	{ name: 'activity', label: 'Activity log', link: '/workspace/activity', needs: 'manage-people' }
];

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
