import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// The Account overview was removed (Trevor, Nov. 23, 2026). Its address
// still opens, on Sign-in and security, so old links keep working; the left
// sidebar lists the other Account pages from there.
export const load: PageServerLoad = () => {
	redirect(308, '/account/security');
};
