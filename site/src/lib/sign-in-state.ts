/**
 * What a sign-in form sent back (src/routes/sign-in/+page.server.ts): the
 * step to show next and any problem. The sign-in page gets it as its form
 * result; the masthead's sign-in panel keeps it itself
 * (src/lib/components/SignInForms.svelte).
 */
export interface SignInState {
	/** Email and password, Create an account, or the code from the email. */
	step?: 'email' | 'create' | 'code';
	email?: string;
	returnTo?: string;
	keep?: boolean;
	/** The code was sent by Create an account. */
	creating?: boolean;
	problem?: string;
	/** The email address and password did not match (the panel words this its own way). */
	reason?: 'no-match';
	field?: string;
	minutes?: number;
	shownCode?: string;
	shownLink?: string;
	paused?: { off: boolean; minutes: number; codesAvailable: boolean };
}
