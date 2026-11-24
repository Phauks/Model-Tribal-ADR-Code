import { workerEnvironment } from '#lib/server/environment.ts';
import { levelAmounts } from '#lib/server/sponsorship-levels.ts';
import { defaultMonthlyCents, type LevelAmounts } from '#lib/sponsorship-levels.ts';
import type { PageServerLoad } from './$types';

// The Sponsorship levels page (docs/sponsorship.md, "Levels"). The amounts
// come from the workspace Sponsors page, so the Worker renders it.
export const prerender = false;

export const load: PageServerLoad = async () => {
	const { database } = workerEnvironment();
	let amounts: LevelAmounts = { ...defaultMonthlyCents };
	if (database) {
		// Before the table exists the page shows the default amounts.
		amounts = await levelAmounts(database).catch((problem) => {
			console.error('Could not read the sponsorship level amounts', problem);
			return amounts;
		});
	}
	return { amounts };
};
