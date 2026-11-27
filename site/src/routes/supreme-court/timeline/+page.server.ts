import { chartCases } from '#lib/server/chart-cases.ts';
import { courts } from '#lib/server/supreme-courts.ts';
import type { PageServerLoad } from './$types';

// Every Supreme Court case on this site on one timeline, with how each
// Justice voted (Trevor, Nov. 27, 2026: "we should enable having one
// timeline for all cases as well"). Built ahead of time, like the Supreme
// Court index.
export const load: PageServerLoad = () => {
	const cases = chartCases();
	const named = new Set(cases.map((item) => item.court));
	return {
		cases,
		courts: courts()
			.filter((court) => named.has(court.name))
			.map((court) => ({ name: court.name, start: court.start, end: court.end, link: court.record ? `/supreme-court/${court.key}` : undefined }))
	};
};
