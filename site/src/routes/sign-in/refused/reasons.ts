/** Why a sign-in was refused, kept for a few minutes in a cookie so the next page can say. */
export const refusalCookie = 'sign-in-refused';

export const refusalReasons = {
	removed: 'Access for this account has been removed. Ask the lead author if you think this is a mistake.',
	expired: 'That sign-in link has expired or was already used. Ask for a new code, or ask the lead author for a new link.'
} as const;

export type RefusalReason = keyof typeof refusalReasons;

export function isRefusalReason(value: string | undefined): value is RefusalReason {
	return value !== undefined && Object.hasOwn(refusalReasons, value);
}
