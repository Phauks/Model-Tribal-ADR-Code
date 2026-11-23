/**
 * Wakes the virus scanner's desk (site/scanner, SCANNING.md) as soon as a
 * file is put in line, so the check starts within seconds instead of at the
 * scanner's next once-a-minute round. The desk is reached through the
 * scanDesks binding (wrangler.jsonc). Waking is only a nudge: if it fails, or
 * the binding is missing, the minute round still finds the file.
 */
import { afterResponse, workerEnvironment } from './environment.ts';

export function wakeScanner(): void {
	const desks = workerEnvironment().scanDesks;
	if (!desks) return;
	afterResponse(
		desks
			.get(desks.idFromName('desk'))
			.fetch('https://desk/wake', { method: 'POST' })
			.then((response) => response.body?.cancel())
	);
}
