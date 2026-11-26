// One Node.js version everywhere. Cloudflare's Workers Builds reads
// .node-version from each Worker's root directory (site, site/live,
// site/scanner, site/wayback), the checks read the copy at the top of the
// repository, and both package.json files refuse an older Node. This keeps
// the copies, the engines fields and the npm version from drifting apart.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repository = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (path: string) => readFileSync(join(repository, path), 'utf8');

const nodeVersion = read('.node-version').trim();
const packages = ['site/package.json', 'pdf/package.json'].map((path) => ({
	path,
	json: JSON.parse(read(path)) as { engines?: { node?: string }; packageManager?: string }
}));

describe('Node.js and npm versions', () => {
	it('names a whole major version at the top of the repository', () => {
		expect(nodeVersion).toMatch(/^\d+$/);
	});

	it.each(['site', 'site/live', 'site/scanner', 'site/wayback'])(
		'%s/.node-version matches the top of the repository',
		(folder) => {
			expect(read(`${folder}/.node-version`).trim()).toBe(nodeVersion);
		}
	);

	it.each(packages)('$path requires that Node.js version or later', ({ json }) => {
		expect(json.engines?.node).toBe(`>=${nodeVersion}`);
	});

	it('both package.json files name the same npm', () => {
		const [site, pdf] = packages.map(({ json }) => json.packageManager);
		expect(site).toMatch(/^npm@\d+\.\d+\.\d+$/);
		expect(pdf).toBe(site);
	});
});
