import { biographies, biographyPage } from '#lib/server/biographies.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	people: biographies().map((person) => {
		const page = biographyPage(person.key)!;
		return {
			key: person.key,
			name: person.name,
			lead: person.lead,
			nations: page.nations,
			// Signed treaties for the United States rather than for a nation.
			unitedStates: page.treaties.length > 0 && page.treaties.every((treaty) => treaty.signedFor === 'United States'),
			cases: page.cases.length
		};
	})
});
