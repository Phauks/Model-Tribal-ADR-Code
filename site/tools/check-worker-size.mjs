// Checks that the built Worker fits Cloudflare's limits, with room to grow.
// Run from site/ after `npm run build`:
//   node tools/check-worker-size.mjs
//
// From 22:44 UTC on Nov. 26, 2026 every deploy of the site failed with
// "exceeded the uncompressed size limit of 63.9 MiB [code 10027]": the data
// pull requests had grown the Worker's code to about 81 MiB, most of it the
// citation of every source record, and nothing checked the size before
// Workers Builds tried to deploy. The citations are now static files
// (src/lib/essay-citation-files.ts). This check fails a pull request well
// before the limit, so there is time to move the next big thing out too.
//
// Limits (Cloudflare, "Limits", https://developers.cloudflare.com/workers/platform/limits/):
// a Worker's code may be 64 MiB uncompressed, as Wrangler's "Total Upload"
// counts it; each static file 25 MiB; a version 100,000 static files on
// the Workers Paid plan.
//
// The size is what `wrangler deploy --dry-run` says it would upload, the
// measure Cloudflare's documentation gives for this limit. Nothing is sent.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mebibyte = 1024 * 1024;
/** Cloudflare's limit on the Worker's code, uncompressed. */
const codeLimit = 64 * mebibyte;
/** Where this check fails: three quarters of the limit, leaving 16 MiB to spare. */
const codeAtMost = 48 * mebibyte;
/** Cloudflare's limit on one static file, and where this check fails. */
const fileLimit = 25 * mebibyte;
const fileAtMost = 20 * mebibyte;
/** Cloudflare's limit on static files in one version (Workers Paid), and where this check fails. */
const fileCountLimit = 100_000;
const fileCountAtMost = 80_000;

const staticFolder = '.svelte-kit/cloudflare/client';
const problems = [];
const mib = (bytes) => `${(bytes / mebibyte).toFixed(1)} MiB`;

// 1. The Worker's code, as Wrangler would upload it.
const outFolder = mkdtempSync(path.join(tmpdir(), 'worker-size-'));
let output;
try {
	output = execFileSync('npx', ['wrangler', 'deploy', '--dry-run', '--outdir', outFolder], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
		maxBuffer: 64 * mebibyte
	});
} catch (problem) {
	rmSync(outFolder, { recursive: true, force: true });
	console.error(problem.stdout ?? '', problem.stderr ?? '');
	throw new Error('wrangler deploy --dry-run failed, so the Worker\'s size could not be measured.');
}
const total = /Total Upload: ([\d.]+) KiB/.exec(output);
if (!total) {
	rmSync(outFolder, { recursive: true, force: true });
	throw new Error('wrangler deploy --dry-run did not print "Total Upload", so the Worker\'s size could not be read.');
}
const codeBytes = Number(total[1]) * 1024;

// The biggest modules, so a failure says where the size is.
const modules = [];
const walk = (folder) => {
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		const full = path.join(folder, entry.name);
		if (entry.isDirectory()) walk(full);
		else if (!entry.name.endsWith('.map')) modules.push({ name: path.relative(outFolder, full), bytes: statSync(full).size });
	}
};
walk(outFolder);
rmSync(outFolder, { recursive: true, force: true });
modules.sort((first, second) => second.bytes - first.bytes);

console.log(`Worker code: ${mib(codeBytes)} of Cloudflare's ${mib(codeLimit)} (this check fails above ${mib(codeAtMost)}).`);
console.log('Biggest modules:');
for (const module of modules.slice(0, 8)) console.log(`  ${mib(module.bytes).padStart(9)}  ${module.name}`);
if (codeBytes > codeAtMost) {
	problems.push(
		`The Worker's code is ${mib(codeBytes)}, over this check's ${mib(codeAtMost)} (Cloudflare refuses a deploy over ${mib(codeLimit)}). Move the biggest data out of the code into static files read on request, as src/lib/built-files.ts, src/lib/essay-citation-files.ts and src/lib/server/page-data.ts do, or keep a library only the browser runs out of the server build (vite.config.ts, browserOnlyInServer).`
	);
}

// 2. The static files.
let fileCount = 0;
const bigFiles = [];
const walkStatic = (folder) => {
	for (const entry of readdirSync(folder, { withFileTypes: true })) {
		const full = path.join(folder, entry.name);
		if (entry.isDirectory()) walkStatic(full);
		else {
			fileCount++;
			const bytes = statSync(full).size;
			if (bytes > fileAtMost) bigFiles.push(`${path.relative(staticFolder, full)} (${mib(bytes)})`);
		}
	}
};
walkStatic(staticFolder);
console.log(`Static files: ${fileCount.toLocaleString('en-US')} of Cloudflare's ${fileCountLimit.toLocaleString('en-US')} (this check fails above ${fileCountAtMost.toLocaleString('en-US')}).`);
if (fileCount > fileCountAtMost) problems.push(`The site has ${fileCount.toLocaleString('en-US')} static files, over this check's ${fileCountAtMost.toLocaleString('en-US')} (Cloudflare's limit is ${fileCountLimit.toLocaleString('en-US')} a version).`);
// The build splits a file this large into parts (tools/split-large-files.mjs), all but the scripts in /_app/, so one found here is a script, or the build skipped that step.
for (const file of bigFiles) problems.push(`The static file ${file} is over this check's ${mib(fileAtMost)} (Cloudflare refuses one over ${mib(fileLimit)}).`);

if (problems.length) {
	for (const problem of problems) console.error(`✗ ${problem}`);
	process.exit(1);
}
console.log('✓ The Worker fits Cloudflare\'s limits, with room to spare.');
