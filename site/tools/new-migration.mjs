#!/usr/bin/env node
/**
 * Starts a new database migration named for the current UTC time and what it
 * does (site/migrations/README.md):
 *
 *   npm run database:new-migration -- "add file scans"
 *   -> migrations/20261123T0430_add_file_scans.sql
 *
 * The file opens with TODO comments for you to replace: say what the
 * migration changes and where its design is written down.
 * scripts/check_migrations.py checks the name and that comment on every pull
 * request, and refuses a TODO left in it.
 */
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const folder = path.resolve(import.meta.dirname, '../migrations');
const description = process.argv.slice(2).join(' ').trim();
const words = description
	.toLowerCase()
	.replace(/[^a-z0-9]+/gu, ' ')
	.trim()
	.split(' ')
	.filter(Boolean);

if (words.length < 2) {
	console.error('Say what the migration does in at least two words, such as: npm run database:new-migration -- "add file scans"');
	process.exit(1);
}

const now = new Date();
let stamp = now.toISOString().slice(0, 16).replace(/[-:]/gu, '');
// Two migrations may not share a minute (their order would depend on their names), so move on a minute if one already does.
const taken = new Set(readdirSync(folder).map((name) => name.slice(0, 13)));
while (taken.has(stamp)) {
	now.setUTCMinutes(now.getUTCMinutes() + 1);
	stamp = now.toISOString().slice(0, 16).replace(/[-:]/gu, '');
}

const name = `${stamp}_${words.join('_')}.sql`;
const file = path.join(folder, name);
if (existsSync(file)) {
	console.error(`${name} already exists.`);
	process.exit(1);
}
writeFileSync(
	file,
	`-- TODO: say what this migration changes, in a full sentence (${words.join(' ')}).
-- TODO: name the document or decision record that explains the design.

`
);
console.log(`Wrote migrations/${name}`);
