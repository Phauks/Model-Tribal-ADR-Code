// Builds the print test pages at two trim sizes, with and without tagged row
// headers, times each compile (5 runs) and inspects the PDFs.
// Needs Typst 0.15.1 on PATH or in TYPST; Python 3 with pypdf.
// Writes ../evidence/print-output.json.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = join(here, '..');
const spikeRoot = join(sourceRoot, '..');
const typst = process.env.TYPST ?? 'typst';
const outputDirectory = join(spikeRoot, 'out', 'print');
mkdirSync(outputDirectory, { recursive: true });

const trimSizes = [
  { width: '6in', height: '9in', label: '6x9' },
  { width: '8.5in', height: '11in', label: '8.5x11' },
];
const variants = [
  { label: '', flags: [] },
  { label: '-tagged-row-headers', flags: ['--features', 'a11y-extras'] },
];

const results = [];
for (const size of trimSizes) {
  for (const variant of variants) {
    const output = join(outputDirectory, `nations-directory-${size.label}${variant.label}.pdf`);
    const arguments_ = [
      'compile', '--root', spikeRoot, '--ignore-system-fonts', '--font-path', join(sourceRoot, 'fonts'),
      ...variant.flags,
      '--input', `page-width=${size.width}`, '--input', `page-height=${size.height}`,
      '--input', 'definition=/out/tables/nations-directory.json',
      join(here, 'nations-directory.typ'), output,
    ];
    const timesInSeconds = [];
    for (let run = 0; run < 5; run += 1) {
      const start = process.hrtime.bigint();
      execFileSync(typst, arguments_, { stdio: 'inherit' });
      timesInSeconds.push(Number(process.hrtime.bigint() - start) / 1e9);
    }
    results.push({ trimSize: size.label, variant: variant.label || 'default', output: output.replace(`${spikeRoot}/`, ''), timesInSeconds: timesInSeconds.map((time) => Number(time.toFixed(3))) });
  }
}

const inspection = JSON.parse(execFileSync('python3', ['-I', join(sourceRoot, 'tools', 'inspect-pdf-table.py'), ...results.map((result) => join(spikeRoot, result.output))], { encoding: 'utf8' }));
for (const [index, result] of results.entries()) {
  Object.assign(result, inspection[index], { file: undefined });
}
const evidenceFile = join(spikeRoot, 'evidence', 'print-output.json');
mkdirSync(dirname(evidenceFile), { recursive: true });
writeFileSync(evidenceFile, `${JSON.stringify({ typst: execFileSync(typst, ['--version'], { encoding: 'utf8' }).trim(), rows: 1000, results }, null, 2)}\n`);
console.log(JSON.stringify(results, null, 2));
