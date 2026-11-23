import { recoursePageSize } from '#lib/recourse.ts';
import { recourseRows } from '#lib/server/recourse.ts';
import type { PageServerLoad } from './$types';

// The page is built with the first rows and the totals; the browser loads
// every row from ./provisions.json to filter them.
export const load: PageServerLoad = () => {
	const rows = recourseRows();
	return {
		firstRows: rows.slice(0, recoursePageSize),
		total: rows.length,
		nationCount: new Set(rows.map((row) => row.nation.id)).size
	};
};
