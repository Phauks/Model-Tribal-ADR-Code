import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({
	confirmed: url.searchParams.has('confirmed'),
	saved: url.searchParams.has('saved')
});
