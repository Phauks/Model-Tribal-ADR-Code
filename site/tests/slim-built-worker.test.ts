import { describe, expect, it } from 'vitest';
import { isImported, sharePrerenderedList } from '../tools/slim-built-worker.mjs';

const serverSource = `import { create_server } from './server/index.js';
const manifest = (() => {
return {
	app_dir: "_app",
	prerendered_routes: new Set(["/","/about"]),
	matchers: async () => {
		return {};
	}
}
})();
export const server = create_server(manifest);
`;

const entrySource = `import { server } from './server.js';
import { env } from 'cloudflare:workers';

const prerendered = new Set(["/","/about"]);
export default { fetch: (request) => (prerendered.has(new URL(request.url).pathname) ? env.ASSETS.fetch(request) : server.respond(request)) };
`;

describe('slimming the built Worker', () => {
	it('has index.js read the prerendered pages from the manifest in server.js', () => {
		const shared = sharePrerenderedList(serverSource, entrySource);
		if (!shared) throw new Error('The files were left as they are.');
		expect(shared.server).toContain('export const manifest = (() => {');
		expect(shared.entry).toContain("import { server, manifest as serverManifest } from './server.js';");
		expect(shared.entry).toContain('const prerendered = serverManifest.prerendered_routes;');
		expect(shared.entry).not.toContain('"/about"');
	});

	it('leaves the files as they are when the two lists differ or the files are not as expected', () => {
		expect(sharePrerenderedList(serverSource, entrySource.replace('"/about"', '"/other"'))).toBeUndefined();
		expect(sharePrerenderedList(serverSource.replace('const manifest =', 'let manifest ='), entrySource)).toBeUndefined();
		expect(sharePrerenderedList(serverSource, entrySource.replace("import { server } from './server.js';", "import { server as other } from './server.js';"))).toBeUndefined();
	});

	it('deletes a file only when nothing imports it', () => {
		expect(isImported('server/manifest.js', { 'server.js': serverSource, 'server/manifest.js': 'export const manifest = {};' })).toBe(false);
		expect(isImported('server/manifest.js', { 'a.js': "import { manifest } from './server/manifest.js';" })).toBe(true);
		expect(isImported('server/manifest.js', { 'a.js': "const load = () => import('./manifest.js');" })).toBe(true);
	});
});
