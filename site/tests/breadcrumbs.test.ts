// Every page's trail comes from one component, src/lib/components/Breadcrumbs.svelte
// (Trevor, Nov. 23, 2026; site/DESIGN.md, Breadcrumbs). These checks read the
// page sources so a page cannot quietly draw its own again.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceFolder = join(import.meta.dirname, '..', 'src');
const componentFile = join('lib', 'components', 'Breadcrumbs.svelte');

function svelteFiles(folder: string): string[] {
	return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
		const path = join(folder, entry.name);
		if (entry.isDirectory()) return svelteFiles(path);
		return entry.name.endsWith('.svelte') ? [path] : [];
	});
}

const files = svelteFiles(sourceFolder).map((path) => ({ name: relative(sourceFolder, path), text: readFileSync(path, 'utf8') }));

describe('breadcrumbs', () => {
	it('are drawn only by the shared component', () => {
		const ownTrails = files
			.filter((file) => file.name !== componentFile)
			.filter((file) => /aria-label="Breadcrumb"|class="[^"]*\b(breadcrumb|trail)\b/.test(file.text))
			.map((file) => file.name);
		expect(ownTrails).toEqual([]);
	});

	it('never type a › between links', () => {
		const typedSeparators = files.filter((file) => /<\/a>\s*›/.test(file.text)).map((file) => file.name);
		expect(typedSeparators).toEqual([]);
	});
});
