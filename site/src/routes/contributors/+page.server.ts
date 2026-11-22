import { printedSectionHeadings, printedSectionOrder } from '#lib/credits-export.ts';
import { confirmedCredits } from '#lib/server/contributor-profiles.ts';
import { workerEnvironment } from '#lib/server/environment.ts';
import type { PageServerLoad } from './$types';

// Read from the database on each visit, so a credit appears once it is confirmed and placed.
export const prerender = false;

/**
 * Everyone welcomed and placed in a section who chose to be credited on the
 * website, from the version each person last confirmed
 * (docs/contributor-profiles.md, "Credits on the website").
 */
export const load: PageServerLoad = async ({ setHeaders }) => {
	const database = workerEnvironment().database;
	const credits = database ? (await confirmedCredits(database)).filter((credit) => credit.onWebsite) : [];
	setHeaders({ 'cache-control': 'public, max-age=300' });
	return {
		sections: printedSectionOrder
			.map((section) => ({
				heading: printedSectionHeadings[section],
				entries: credits
					.filter((credit) => credit.section === section)
					.map(({ line, biography }) => ({ line, biography }))
			}))
			.filter((section) => section.entries.length > 0)
	};
};
