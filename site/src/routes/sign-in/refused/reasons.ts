/** Why a sign-in was refused, kept for a few minutes in a cookie so the next page can say. */
export const refusalCookie = 'sign-in-refused';

export const refusalReasons = {
	'not-on-list': 'This account does not have access to the workspace. You can register to help with the project from your profile, and the lead author will be in touch.',
	removed: 'Access for this account has been removed. Ask the lead author if you think this is a mistake.',
	'email-not-verified': 'Auth0 has not verified this email address yet. Open the verification email Auth0 sent you, then sign in again.',
	'different-account': 'This email address is already linked to a different sign-in, for example a password instead of Google. Sign in the same way you did before.',
	cancelled: 'Sign-in was cancelled.',
	expired: 'The sign-in took too long or was started in another browser. Please try again.'
} as const;

export type RefusalReason = keyof typeof refusalReasons;

export function isRefusalReason(value: string | undefined): value is RefusalReason {
	return value !== undefined && Object.hasOwn(refusalReasons, value);
}
