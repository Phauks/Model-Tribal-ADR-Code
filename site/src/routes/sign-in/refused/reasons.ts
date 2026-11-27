/** Why a sign-in was refused, kept for a few minutes in a cookie so the next page can say. */
export const refusalCookie = 'sign-in-refused';

export const refusalReasons = {
	removed: 'Access for this account has been removed. Ask the lead author if you think this is a mistake.',
	expired: 'That sign-in link has expired or was already used. Ask for a new code, or ask the lead author for a new link.',
	'outside-expired': 'That sign-in took too long or was already used. Please start again.',
	'outside-failed': 'Google or Microsoft did not confirm who you are. Please try again, or sign in another way.',
	'unverified-email':
		'Microsoft or Google did not confirm that you own that email address, so we could not match it to an account. Sign in another way, then connect it on Account, Sign-in and security.',
	'connected-elsewhere': 'That Google or Microsoft account is already connected to a different account here.'
} as const;

export type RefusalReason = keyof typeof refusalReasons;

export function isRefusalReason(value: string | undefined): value is RefusalReason {
	return value !== undefined && Object.hasOwn(refusalReasons, value);
}
