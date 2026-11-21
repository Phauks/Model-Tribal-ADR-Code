import { isRefusalReason, refusalCookie, refusalReasons } from './reasons.ts';
import type { PageServerLoad } from './$types';

export const prerender = false;

export const load: PageServerLoad = ({ cookies }) => {
	const reason = cookies.get(refusalCookie);
	cookies.delete(refusalCookie, { path: '/sign-in' });
	return {
		message: isRefusalReason(reason) ? refusalReasons[reason] : 'You are not signed in.'
	};
};
