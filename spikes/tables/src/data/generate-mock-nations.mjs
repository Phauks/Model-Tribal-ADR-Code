// Writes ../out/data/mock-nations.json: 1,000 fictional records shaped like
// schemas/tribe.schema.json. Every name is fictional ("Sample Nation ..."),
// following the mockups' "Sample Nation". The same seed gives the same file.
//
// Twelve rows carry names that test sorting: accented capitals, a lowercase
// name, an ʻokina and numbers that must sort as numbers (2 and 3 before 10).

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outputFile = join(here, '..', '..', 'out', 'data', 'mock-nations.json');

const recordCount = Number(process.argv[2] ?? 1000);

// Mulberry32: a small seeded random number generator, so runs are repeatable.
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
const random = createRandom(20261121);
const pick = (list) => list[Math.floor(random() * list.length)];

const stateCodes = [
  'AK', 'AL', 'AZ', 'CA', 'CO', 'CT', 'FL', 'ID', 'KS', 'LA', 'MA', 'ME', 'MI',
  'MN', 'MS', 'MT', 'NC', 'ND', 'NE', 'NM', 'NV', 'NY', 'OK', 'OR', 'RI', 'SC',
  'SD', 'TX', 'UT', 'VA', 'WA', 'WI', 'WY',
];
const recognitionTypes = ['federal', 'federal', 'federal', 'state', 'unrecognized', 'petitioning'];
const reviewStatuses = [
  'drafted-from-public-sources', 'drafted-from-public-sources', 'drafted-from-public-sources',
  'sent-to-nation', 'reviewed-by-nation', 'approved-by-nation',
];
const institutionKinds = ['tribal-court', 'peacemaking-program', 'court-of-appeals', 'healing-to-wellness-court', 'elders-council'];

const sortingTestNames = [
  'Sample Nation Ä',
  'Sample Nation Å',
  'Sample Nation É',
  'Sample Nation Ø',
  'Sample Nation Ž',
  'Sample Nation ʻOkina',
  'sample nation lowercase',
  'Sample Nation Zebra',
  'Sample Nation Aardvark',
  'Sample Nation 2',
  'Sample Nation 10',
  'Sample Nation 3',
];

function slugFor(name, index) {
  const ascii = name.normalize('NFD').toLowerCase().replace(/[^a-z0-9 ]/g, '');
  return `${ascii.trim().replace(/\s+/g, '-')}-${String(index).padStart(4, '0')}`;
}

function isoDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const records = [];
for (let index = 1; index <= recordCount; index += 1) {
  const name = index <= sortingTestNames.length
    ? sortingTestNames[index - 1]
    : `Sample Nation ${index}`;
  const stateCount = random() < 0.85 ? 1 : 2 + Math.floor(random() * 2);
  const states = [...new Set(Array.from({ length: stateCount }, () => pick(stateCodes)))]
    .sort()
    .map((state) => ({ state, presence: pick(['land', 'government-office', 'service-area']), source: 'sample-source' }));
  const institutionCount = Math.floor(random() * 4);
  const record = {
    id: slugFor(name, index),
    names: { official: name.normalize('NFC') },
    recognition: [{ type: pick(recognitionTypes), source: 'sample-source' }],
    states,
    justice_institutions: Array.from({ length: institutionCount }, (_, position) => ({
      kind: pick(institutionKinds),
      name: `${name} institution ${position + 1}`,
      source: 'sample-source',
    })),
    review: {
      status: pick(reviewStatuses),
      // Between January 2025 and October 2026, so no date is in the future.
      last_verified: isoDate(2025 + Math.floor(random() * 2), 1 + Math.floor(random() * 10), 1 + Math.floor(random() * 28)),
    },
  };
  records.push(record);
}

// Shuffle so the file order is not the sorted order.
for (let index = records.length - 1; index > 0; index -= 1) {
  const other = Math.floor(random() * (index + 1));
  [records[index], records[other]] = [records[other], records[index]];
}

mkdirSync(dirname(outputFile), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
console.log(`Wrote ${records.length} fictional records to ${outputFile}`);
