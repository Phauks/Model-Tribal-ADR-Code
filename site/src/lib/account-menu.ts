// The Account pages, as the left sidebar lists them under "Your account"
// (site/DESIGN.md, section 6, "Settings and Account"; decision record 0045).
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
	{ label: 'Overview', link: '/account' },
	{ label: 'Profile and credit', link: '/profile' },
	// Files and links the person sent the project (docs/uploads.md).
	{ label: 'Your uploads', link: '/uploads' },
	{ label: 'Sign-in and security', link: '/account/security', within: ['/profile/password'] },
	{ label: 'Email and notifications', link: '/account/email' },
	{ label: 'Your data', link: '/account/data', within: ['/profile/delete-account'] }
];

function matches(link: string, path: string): boolean {
	return path === link || path.startsWith(`${link}/`);
}

/** Whether a path is one of the Account pages, so the sidebar shows the group. */
export function isAccountPath(path: string): boolean {
	return ['/account', '/profile', '/uploads'].some((link) => matches(link, path));
}

/** The entry for the page at this path. The most specific entry wins, so /profile/password is Sign-in and security. */
export function currentAccountPage(path: string): AccountPage | undefined {
	const exact = accountPages.find((item) => item.within?.some((link) => matches(link, path)));
	if (exact) return exact;
	if (path === '/account') return accountPages[0];
	return accountPages.find((item) => item.link !== '/account' && matches(item.link, path));
}
