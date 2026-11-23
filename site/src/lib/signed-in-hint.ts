/**
 * A cookie that tells the site's pages, which are built ahead of time and
 * cannot ask the Worker who is signed in, to show the profile button in the
 * masthead instead of "Sign in", and which workspace pages to list in the
 * left sidebar. It holds no name, role or token: only "1", or the names of
 * the workspace pages the person's role opens, such as
 * "overview.essays.reviews". The session itself stays in its own HTTP-only
 * cookie (src/lib/server/sign-in.ts), and every workspace page still checks
 * it (src/hooks.server.ts), so a changed hint only changes what is listed. If
 * the hint outlives the session, its links lead to the sign-in page, which is
 * where "Sign in" would have led.
 */
export const signedInHintCookie = 'signed-in-hint';

/** The longest a session lasts (site/COLLABORATION.md): 12 hours. */
export const signedInHintLifetimeSeconds = 12 * 60 * 60;

/** The hint's value: the workspace pages' names joined by dots, or "1" for none. */
export function signedInHintValue(workspacePageNames: readonly string[]): string {
	return workspacePageNames.length > 0 ? workspacePageNames.join('.') : '1';
}

export interface SignedInHint {
	signedIn: boolean;
	/** The names of the workspace pages to list; empty when the person has none or the hint does not say. */
	workspacePageNames: string[];
}

/** Reads the hint from a browser's document.cookie string. */
export function readSignedInHint(cookieText: string): SignedInHint {
	for (const entry of cookieText.split(';')) {
		const [name, ...rest] = entry.trim().split('=');
		if (name !== signedInHintCookie) continue;
		const value = rest.join('=');
		if (value === '') break;
		const workspacePageNames = value === '1' ? [] : value.split('.').filter((part) => /^[a-z]+(-[a-z]+)*$/.test(part));
		return { signedIn: true, workspacePageNames };
	}
	return { signedIn: false, workspacePageNames: [] };
}
