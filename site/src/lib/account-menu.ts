// The Account pages, as the profile button's menu in the masthead lists them
// (AccountLink.svelte) and as the side column lists them on the Account pages
// themselves (site/DESIGN.md, section 6, "Settings and Account"; decision
// record 0045). Trevor chose on Nov. 27, 2026 to move them out of the side
// column and under the profile button, now that the section bar carries the
// site's places (design/sidebar-workspace-profile, option B).
// Account holds who someone is to the project and what it keeps about them,
// on the server; how the site looks on one screen is in Settings, on the
// device. A new account page is added here, in reading order.

/** The two groups of the menu: the person's own pages, then the settings kept with the account. */
export type AccountGroup = 'yours' | 'settings';

export interface AccountPage {
	label: string;
	link: string;
	group: AccountGroup;
	/** Other addresses that belong to this entry, such as the profile's edit and review pages. */
	within?: string[];
}

export const accountPages: readonly AccountPage[] = [
	{ label: 'Profile and credit', link: '/profile', group: 'yours' },
	// Updates to the pages the person follows (site/DESIGN.md, section 6, "Follow").
	{ label: 'Following', link: '/following', group: 'yours' },
	// Files and links the person sent the project (docs/uploads.md).
	{ label: 'Your uploads', link: '/uploads', group: 'yours' },
	// Asking for, and holding, a place on a nation's team that keeps its page (decision record 0041).
	{ label: 'Nation team', link: '/profile/nation-team', group: 'yours' },
	{ label: 'Sign-in and security', link: '/account/security', group: 'settings', within: ['/profile/password'] },
	{ label: 'Email and notifications', link: '/account/email', group: 'settings' },
	// Everything bought from the Store while signed in, with tracking and problems (docs/store.md).
	{ label: 'Your orders', link: '/account/orders', group: 'settings' },
	// An organization's gift and how the project thanks it in public (docs/sponsorship.md).
	{ label: 'Sponsorship', link: '/account/sponsorship', group: 'settings' },
	{ label: 'Your data', link: '/account/data', group: 'settings', within: ['/profile/delete-account'] }
];

function matches(link: string, path: string): boolean {
	return path === link || path.startsWith(`${link}/`);
}

/** Whether a path is one of the Account pages, so the side column lists them. */
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
