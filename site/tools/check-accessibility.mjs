// Runs axe-core on every built page, in the light and the dark theme
// (site/DESIGN.md, section 9). Run from site/ after `npm run build`:
//   node tools/check-accessibility.mjs [--pages /,/nations/map]
//
// The prerendered pages are served from the build output by a small local
// server and opened in Chromium through Playwright. Each page is checked
// against the WCAG 2.0, 2.1 and 2.2 level A and AA rules that axe-core
// automates. Automated checks find only part of the problems; the manual
// checks in DESIGN.md section 9 still apply.
//
// Set CHROMIUM_PATH to use a Chromium that is already installed.

import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const output = path.resolve('.svelte-kit/cloudflare/client');
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const themes = ['light', 'dark'];
const workers = 4;

if (!existsSync(output)) {
	console.error(`${output} does not exist. Run npm run build first.`);
	process.exit(1);
}

const types = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.svg': 'image/svg+xml',
	'.woff2': 'font/woff2',
	'.woff': 'font/woff',
	'.webmanifest': 'application/manifest+json',
	'.txt': 'text/plain; charset=utf-8'
};

/** The file a path is served from, as Cloudflare serves prerendered pages. */
function fileFor(pathname) {
	const clean = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
	const candidates =
		clean === '/'
			? ['index.html']
			: [clean.slice(1), `${clean.slice(1)}.html`, `${clean.slice(1)}/index.html`];
	for (const candidate of candidates) {
		const full = path.join(output, candidate);
		if (!full.startsWith(output)) return undefined;
		if (existsSync(full) && statSync(full).isFile()) return full;
	}
	return undefined;
}

function pagePaths(folder = output) {
	const found = [];
	for (const name of readdirSync(folder)) {
		const full = path.join(folder, name);
		if (statSync(full).isDirectory()) {
			if (name !== '_app') found.push(...pagePaths(full));
		} else if (name.endsWith('.html')) {
			const relative = path.relative(output, full).replace(/\\/g, '/').replace(/\.html$/, '');
			found.push(relative === 'index' ? '/' : `/${relative.replace(/\/index$/, '')}`);
		}
	}
	return found.sort();
}

const only = process.argv.indexOf('--pages');
const pages = only > -1 ? process.argv[only + 1].split(',') : pagePaths();

const server = createServer((request, response) => {
	const file = fileFor(new URL(request.url, 'http://localhost').pathname);
	if (!file) {
		response.writeHead(404).end();
		return;
	}
	response.writeHead(200, {
		'content-type': types[path.extname(file)] ?? 'application/octet-stream'
	});
	response.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch(
	process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const problems = [];
const started = Date.now();

for (const theme of themes) {
	// Service workers are blocked so every page is read from the build, not a cache.
	const context = await browser.newContext({ colorScheme: theme, serviceWorkers: 'block' });
	const queue = [...pages];
	await Promise.all(
		Array.from({ length: workers }, async () => {
			const page = await context.newPage();
			while (queue.length > 0) {
				const pathname = queue.shift();
				try {
					const response = await page.goto(base + pathname, { waitUntil: 'load' });
					if (!response?.ok()) {
						problems.push(`${pathname}: not a prerendered page in the build`);
						continue;
					}
					await page.addScriptTag({ content: axeSource });
					const violations = await page.evaluate(
						async (runOnly) =>
							(await window.axe.run(document, { runOnly: { type: 'tag', values: runOnly } }))
								.violations,
						tags
					);
					for (const violation of violations) {
						const where = violation.nodes
							.slice(0, 3)
							.map((node) => node.target.join(' '))
							.join('; ');
						problems.push(
							`${pathname} (${theme}): ${violation.id}, ${violation.help} [${violation.nodes.length}] ${where}`
						);
					}
				} catch (error) {
					problems.push(`${pathname} (${theme}): could not be checked: ${error.message}`);
				}
			}
			await page.close();
		})
	);
	await context.close();
}

await browser.close();
server.close();

const seconds = Math.round((Date.now() - started) / 1000);
if (problems.length > 0) {
	console.error(problems.join('\n'));
	console.error(`\n${problems.length} accessibility problem(s) found by axe-core.`);
	process.exit(1);
}
console.log(
	`Accessibility checked with axe-core: ${pages.length} pages in ${themes.length} themes, ${seconds} s.`
);
