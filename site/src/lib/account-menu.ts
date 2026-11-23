// The Account pages, as the left sidebar lists them under "Your account"
// (site/DESIGN.md, section 6, "Settings and Account"; decision record 0045).
// The group shows on every page for someone signed in: the profile button in
// the masthead holds only Sign out (Trevor, Nov. 23, 2026).
// Account holds who someone is to the project and what it keeps about them,
// on the server; how the site looks on one screen is in Settings, on the
// device. A new account page is added here, in reading order.

export interface AccountPage {
	label: string;
	link: string;
	/** Other addresses that belong to this entry, such as the profile's edit and review pages. */
	within?: string[];
}

export const accountPages: readonly AccountPage[] = [
	{ label: 'Profile and credit', link: '/profile' },
	// Updates to the pages the person follows (site/DESIGN.md, section 6, "Follow").
	{ label: 'Following', link: '/following' },
	// Files and links the person sent the project (docs/uploads.md).
	{ label: 'Your uploads', link: '/uploads' },
	// Asking for, and holding, a place on a nation's team that keeps its page (decision record 0041).
	{ label: 'Nation team', link: '/profile/nation-team' },
	{ label: 'Sign-in and security', link: '/account/security', within: ['/profile/password'] },
	{ label: 'Email and notifications', link: '/account/email' },
	// Printed copies ordered while signed in, with tracking and problems (docs/book-orders.md, "Your orders and problems").
	{ label: 'Your orders', link: '/account/orders' },
	// An organization's gift and how the project thanks it in public (docs/sponsorship.md).
	{ label: 'Sponsorship', link: '/account/sponsorship' },
	{ label: 'Your data', link: '/account/data', within: ['/profile/delete-account'] }
];

function matches(link: string, path: string): boolean {
	return path === link || path.startsWith(`${link}/`);
}

/** Whether a path is one of the Account pages, so the sidebar shows the group. */
export function isAccountPath(path: string): boolean {
	return ['/account', '/profile', '/uploads', '/following'].some((link) => matches(link, path));
}

/** The entry for the page at this path. The longest matching address wins, so /profile/password is Sign-in and security and /profile/nation-team is Nation team. */
export function currentAccountPage(path: string): AccountPage | undefined {
	let best: AccountPage | undefined;
	let bestLength = -1;
	for (const item of accountPages) {
		for (const link of [item.link, ...(item.within ?? [])]) {
			if (matches(link, path) && link.length > bestLength) {
				best = item;
				bestLength = link.length;
			}
		}
	}
	return best;
}
