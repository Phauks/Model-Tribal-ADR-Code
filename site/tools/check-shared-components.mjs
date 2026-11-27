// Fails if a page or component draws a <select> or a <table> of its own.
// Pick-one fields use the shared Dropdown, or SearchableDropdown for a long
// list, and data tables use the shared DataTable (site/DESIGN.md, section 6),
// so every one looks, sorts, filters and downloads the same way
// (improvements report, item R10, approved by Trevor on Nov. 24, 2026).
//
// The files below may keep theirs, as many as listed: the shared components
// themselves, and the few that are not a list to pick from or a table of
// data. A new one needs a reason here.
//
// Run from site/:  node tools/check-shared-components.mjs

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const allowed = new Map(
	Object.entries({
		// The shared components: the browser's own <select> stands in without scripts.
		'src/lib/components/Dropdown.svelte': { select: 1 },
		'src/lib/components/SearchableDropdown.svelte': { select: 1 },
		'src/lib/components/DataTable.svelte': { table: 1 },
		// The calendar's month and year, and its grid of days.
		'src/lib/components/DateField.svelte': { select: 2, table: 1 },
		// The editor's toolbar: the block style, and a menu of things to add.
		'src/lib/components/essays/EssayEditor.svelte': { select: 2 },
		// Totals and receipts laid out as tables, not data to sort.
		'src/lib/components/CheckoutGift.svelte': { table: 1 },
		'src/lib/components/FileSender.svelte': { table: 1 },
		'src/lib/components/orders/YourOrders.svelte': { table: 1 },
		'src/routes/book/+page.svelte': { table: 1 },
		'src/routes/offline/+page.svelte': { table: 1 },
		'src/routes/sponsor/levels/+page.svelte': { table: 1 },
		// Forms laid out as tables: a row for each name, nation or language, and versions to compare.
		'src/routes/profile/edit/+page.svelte': { table: 4 },
		'src/lib/components/PageHistory.svelte': { table: 1 },
		// A nation's laws and cases: a level for each kind and for each item, picked in its row.
		'src/routes/workspace/nation-teams/[nation]/laws-and-cases/+page.svelte': { table: 2 },
		// A short summary beside a form, and the list of settings that let sponsors give.
		'src/routes/workspace/outreach/new/+page.svelte': { table: 1 },
		'src/routes/workspace/sponsors/+page.svelte': { table: 1 },
		// A nation's Census areas in Key facts: two short columns in a narrow panel, as in the approved mockup (Trevor, Nov. 27, 2026, design/census-key-facts); all their figures sort and download in the table builder it links to.
		'src/lib/components/FactGroups.svelte': { table: 1 },
		// The Source watch queue: each row opens in place to the item's details and the decisions on it (mockup A, Trevor, Nov. 26, 2026), a work list rather than data to sort or download.
		'src/routes/workspace/watch/+page.svelte': { table: 1 }
	}).map(([file, counts]) => [path.normalize(file), counts])
);

const advice = {
	select: 'use Dropdown.svelte, or SearchableDropdown.svelte for a long list',
	table: 'use DataTable.svelte'
};

function filesUnder(folder) {
	const found = [];
	for (const name of readdirSync(folder)) {
		const full = path.join(folder, name);
		if (statSync(full).isDirectory()) found.push(...filesUnder(full));
		else if (name.endsWith('.svelte')) found.push(full);
	}
	return found;
}

/** The text with its comments blanked out, line breaks kept, so a comment that names <select> does not count. */
function withoutComments(text) {
	const blank = (comment) => comment.replace(/[^\n]/g, ' ');
	return text
		.replace(/<!--[\s\S]*?-->/g, blank)
		.replace(/\/\*[\s\S]*?\*\//g, blank)
		.replace(/(^|[\s;{}])\/\/[^\n]*/g, (comment, before) => before + blank(comment.slice(before.length)));
}

let problems = 0;
for (const file of filesUnder('src')) {
	const lines = withoutComments(readFileSync(file, 'utf8')).split('\n');
	const found = { select: [], table: [] };
	lines.forEach((line, index) => {
		for (const match of line.matchAll(/<(select|table)(?=[\s>/]|$)/g)) found[match[1]].push(index + 1);
	});
	const limits = allowed.get(path.normalize(file)) ?? {};
	for (const element of ['select', 'table']) {
		const extra = found[element].slice(limits[element] ?? 0);
		for (const line of extra) {
			console.error(`${file}:${line}: a <${element}> of its own; ${advice[element]}`);
			problems += 1;
		}
	}
}

if (problems > 0) {
	console.error(`\n${problems} <select> or <table> element(s) outside the shared components (tools/check-shared-components.mjs lists the exceptions).`);
	process.exit(1);
}
console.log('Every pick-one field and data table uses the shared components.');
