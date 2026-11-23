// The workspace's pages, as the left sidebar lists them under "Workspace"
// (Trevor asked on Nov. 22, 2026 for them to move there from a separate bar
// at the top of each workspace page). Each person sees only the pages their
// role opens; every page still checks for itself (src/lib/server/workspace.ts),
// so the list only decides what is shown.
import type { Permission } from './permissions.ts';

export type WorkspacePageName =
	| 'overview'
	| 'essays'
	| 'requests'
	| 'uploads'
	| 'reviews'
	| 'contributors'
	| 'people'
	| 'access'
	| 'address-book'
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
	{ name: 'requests', label: 'Requests', link: '/workspace/requests', needs: 'read-requests' },
	{ name: 'uploads', label: 'Uploads', link: '/workspace/uploads', needs: 'review-uploads' },
	// Everyone sees the documents they can open, by role or by grant.
	{ name: 'reviews', label: 'Reviews', link: '/workspace/reviews' },
	{ name: 'contributors', label: 'Contributors', link: '/workspace/contributors', needs: 'read-contributors' },
	{ name: 'people', label: 'People', link: '/workspace/people', needs: 'manage-people' },
	{ name: 'access', label: 'Access', link: '/workspace/access', needs: 'manage-people' },
	{ name: 'address-book', label: 'Address book', link: '/workspace/address-book', needs: 'manage-address-book' },
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
