// The prerendered pages in a build, as the addresses they are served at.
// Shared by tools/check-accessibility.mjs and tools/accessibility-scope.mjs.

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** Every page under `output` (the build's client folder), sorted, skipping _app. */
export function pagePaths(output, folder = output) {
	const found = [];
	for (const name of readdirSync(folder)) {
		const full = path.join(folder, name);
		if (statSync(full).isDirectory()) {
			if (name !== '_app') found.push(...pagePaths(output, full));
		} else if (name.endsWith('.html')) {
			const relative = path.relative(output, full).replace(/\\/g, '/').replace(/\.html$/, '');
			found.push(relative === 'index' ? '/' : `/${relative.replace(/\/index$/, '')}`);
		}
	}
	return found.sort();
}
