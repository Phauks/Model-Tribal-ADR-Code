// Prints the website comparison tables in REPORT.md from
// ../evidence/site-output.json, so the report's figures come straight from
// the measurements. Run: node tools/summarize-site-output.mjs
import { readFileSync } from 'node:fs';

const output = JSON.parse(readFileSync(new URL('../../evidence/site-output.json', import.meta.url), 'utf8'));
const kilobytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const milliseconds = (value) => (value === undefined ? 'n/a' : `${Math.round(value)} ms`);
const baseline = output.results.find((result) => result.route === '/baseline/');
const rows = output.results.filter((result) => result.route !== '/baseline/');

console.log('| Candidate | Rows in the prerendered HTML | Rows readable without scripts | HTML, gzipped | JavaScript, gzipped (whole page) | Ready, normal CPU | Ready, CPU slowed 4 times | Sort click, median (4 times slower) | Search, "Sample Nation 99" (4 times slower) |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
console.log(`| Baseline page, no table | 0 | n/a | ${kilobytes(baseline.html.gzipBytes)} | ${kilobytes(baseline.scripts.gzipBytes)} | ${milliseconds(baseline.timing.readyMilliseconds)} | ${milliseconds(baseline.timingCpuSlowedFourTimes.readyMilliseconds)} | n/a | n/a |`);
for (const result of rows) {
  if (result.error) {
    console.log(`| ${result.label} | error: ${result.error} |`);
    continue;
  }
  const normal = result.interaction;
  const slow = result.interactionCpuSlowedFourTimes;
  console.log(`| ${result.label} | ${result.html.tableRowsInPrerenderedHtml} | ${result.withoutScripts.visibleRows} | ${kilobytes(result.html.gzipBytes)} | ${kilobytes(result.scripts.gzipBytes)} | ${milliseconds(result.timing.readyMilliseconds)} | ${milliseconds(result.timingCpuSlowedFourTimes.readyMilliseconds)} | ${milliseconds(normal.sortClickMillisecondsMedian)} (${milliseconds(slow.sortClickMillisecondsMedian)}) | ${milliseconds(normal.searchMilliseconds)} (${milliseconds(slow.searchMilliseconds)}) |`);
}

console.log('\n| Candidate | Markup | Row headers kept | Caption | Keyboard: Tab to "Nation", then Enter or Space sorts | aria-sort set | Page at 320 px | Accessibility scan (light / dark) | Colors follow tokens in dark mode | Requests to other hosts |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const result of rows) {
  if (result.error) continue;
  const structure = result.structure;
  const markup = structure.tableElements ? `\`<table>\`, ${structure.columnHeadersWithScope} \`th scope="col"\`` : `\`div role="grid"\`, ${structure.rowRoles} rows in the page`;
  const axe = (list) => (list.length === 0 ? '0' : list.map((violation) => `${violation.id} (${violation.nodes})`).join(', '));
  const dark = result.colors_dark;
  const tokens = dark.header.background === dark.tokenSurface && dark.header.color === dark.tokenInk
    ? 'Yes'
    : `No (header ${dark.header.background}, token ${dark.tokenSurface})`;
  console.log(`| ${result.label} | ${markup} | ${structure.rowHeadersWithScope} of 1000 | ${structure.captions ? 'Yes' : 'No'} | ${result.keyboard.tabPressesToNationSort} Tab presses; ${result.keyboard.enterSorts ? 'Enter yes' : 'Enter no'}, ${result.keyboard.spaceSorts ? 'Space yes' : 'Space no'} | ${result.interaction.afterFirstClick.ariaSort ?? 'none'} | ${result.narrowScreen.pageScrollsSideways ? 'Scrolls sideways' : 'No sideways scroll'} | ${axe(result.axe_light)} / ${axe(result.axe_dark)} | ${tokens} | ${result.requestsToOtherHosts.length ? result.requestsToOtherHosts.join(', ') : 'None'} |`);
}
