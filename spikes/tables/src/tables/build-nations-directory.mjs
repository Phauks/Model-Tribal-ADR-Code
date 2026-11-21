// Turns nation records into the nations directory table definition
// (see table-definition.mjs). Run directly to write
// ../out/tables/nations-directory.json for the print and ebook builds; the
// website imports buildNationsDirectory() at build time.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { problemsIn, sortRows } from './table-definition.mjs';

// Paths are relative to the spike's src/ folder, where every command runs
// (the website build bundles this file, so import.meta.url cannot be used).
const outputRoot = resolve(process.cwd(), '..', 'out');
export const recordsFile = join(outputRoot, 'data', 'mock-nations.json');
export const definitionFile = join(outputRoot, 'tables', 'nations-directory.json');

const recognitionLabels = {
  federal: 'Federal',
  state: 'State',
  unrecognized: 'Not recognized',
  petitioning: 'Petitioning',
};
const reviewLabels = {
  'drafted-from-public-sources': 'Drafted from public sources',
  'sent-to-nation': 'Sent to the nation',
  'reviewed-by-nation': 'Reviewed by the nation',
  'approved-by-nation': 'Approved by the nation',
};
const dateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export const nationsDirectoryColumns = [
  { key: 'name', header: 'Nation', type: 'text', isRowHeader: true, sortable: true, searchable: true, align: 'start', printWidth: '2.2fr' },
  { key: 'states', header: 'States', type: 'text', sortable: true, searchable: true, align: 'start', printWidth: '1.2fr' },
  { key: 'recognition', header: 'Recognition', type: 'text', sortable: true, searchable: true, align: 'start', printWidth: '1.2fr' },
  { key: 'institutions', header: 'Justice institutions', type: 'number', sortable: true, align: 'end', printWidth: '1fr' },
  { key: 'review', header: 'Review status', type: 'text', sortable: true, searchable: true, align: 'start', printWidth: '1.8fr' },
  { key: 'lastVerified', header: 'Last verified', type: 'date', sortable: true, align: 'start', printWidth: '1.5fr' },
  { key: 'reportProblem', header: 'Report', type: 'action', sortable: false, align: 'start', media: ['website'] },
];

export function buildNationsDirectory(records) {
  const definition = {
    identifier: 'nations-directory',
    caption: 'Native nations in the directory (fictional sample data)',
    columns: nationsDirectoryColumns,
    defaultSort: { key: 'name', direction: 'ascending' },
    rows: records
      .filter((record) => record.review.status !== 'withdrawn-at-request')
      .map((record) => {
        const name = record.names.official;
        const stateCodes = record.states.map((entry) => entry.state);
        return {
          key: record.id,
          cells: {
            name: { text: name, href: `/nations/${record.id}` },
            states: { text: stateCodes.join(', ') },
            recognition: { text: record.recognition.map((entry) => recognitionLabels[entry.type]).join(', ') },
            institutions: { text: String(record.justice_institutions?.length ?? 0), sortValue: record.justice_institutions?.length ?? 0 },
            review: { text: reviewLabels[record.review.status] },
            lastVerified: {
              text: dateFormat.format(new Date(`${record.review.last_verified}T00:00:00Z`)),
              sortValue: record.review.last_verified,
            },
            reportProblem: {
              text: 'Report a problem',
              hiddenText: ` with ${name}`,
              href: `/requests?record=tribes/${record.id}`,
            },
          },
        };
      }),
  };
  // Rows are stored in the default order, sorted with the language-aware
  // collator, so every medium starts from the same order.
  definition.rows = sortRows(definition, definition.rows, definition.defaultSort.key, definition.defaultSort.direction);
  const problems = problemsIn(definition);
  if (problems.length > 0) throw new Error(`Nations directory definition: ${problems.join('; ')}`);
  return definition;
}

export function readRecords() {
  return JSON.parse(readFileSync(recordsFile, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const definition = buildNationsDirectory(readRecords());
  mkdirSync(dirname(definitionFile), { recursive: true });
  writeFileSync(definitionFile, `${JSON.stringify(definition, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${definition.rows.length} rows to ${definitionFile}`);
}
