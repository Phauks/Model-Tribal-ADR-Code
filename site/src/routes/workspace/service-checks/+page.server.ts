import { buildCommit } from 'virtual:build';
import { workerEnvironment } from '#lib/server/environment.ts';
import { workerSocketOpener } from '#lib/server/mail/socket-opener.ts';
import { runServiceChecks } from '#lib/server/service-checks.ts';
import { requirePermission } from '#lib/server/workspace.ts';
import type { PageServerLoad } from './$types';

// The migration files this build was made with, by name only: the files are
// not loaded unless something asks for them, which nothing here does.
const migrationFiles = Object.keys(import.meta.glob('/migrations/*.sql', { query: '?raw', import: 'default' }))
	.map((path) => path.split('/').at(-1) ?? path)
	.sort();

export const load: PageServerLoad = async (event) => {
	requirePermission(event, 'check-services');
	const checkedAt = new Date();
	const results = await runServiceChecks({
		environment: workerEnvironment(),
		fetcher: (input, init) => fetch(input, init),
		openSocket: workerSocketOpener,
		migrationFiles,
		now: checkedAt
	});
	// Mockup only: ?design=b shows the second design for Trevor to compare.
	const design = event.url.searchParams.get('design') === 'b' ? 'b' : 'a';
	return { results, checkedAt: checkedAt.toISOString(), buildCommit, design };
};
