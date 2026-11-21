// Measures every website candidate in Chromium (Playwright) and runs the
// accessibility scan (axe-core) in the light and dark themes. Also scans the
// ebook's table chapter.
//
// Run from src/ after `npm run build:site` and `npm run build:ebook`:
//   node tools/check-site.cjs
// Writes ../evidence/site-output.json and screenshots to ../evidence/.

const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const spikeRoot = path.resolve(__dirname, '..', '..');
const siteRoot = path.join(spikeRoot, 'out', 'site');
const evidence = path.join(spikeRoot, 'evidence');
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const definition = JSON.parse(fs.readFileSync(path.join(spikeRoot, 'out', 'tables', 'nations-directory.json'), 'utf8'));

const candidates = [
  { route: '/baseline/', label: 'Baseline (no table)', kind: 'none' },
  { route: '/no-library/', label: 'No library, Svelte state', kind: 'table' },
  { route: '/no-library-enhancer/', label: 'No library, small script', kind: 'table' },
  { route: '/no-library-enhancer-content-visibility/', label: 'No library, small script, off-screen rows skipped', kind: 'table', screenshots: false },
  { route: '/tanstack/', label: 'TanStack Table v9', kind: 'table' },
  { route: '/svar/', label: 'SVAR Svelte DataGrid', kind: 'grid' },
  { route: '/simple-datatables/', label: 'simple-datatables', kind: 'table' },
  { route: '/datatables/', label: 'DataTables 3', kind: 'table' },
];

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json' };
function startServer() {
  const server = http.createServer((request, response) => {
    let filePath = path.join(siteRoot, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
    if (filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
    if (!filePath.startsWith(siteRoot) || !fs.existsSync(filePath)) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': types[path.extname(filePath)] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const gzipSize = (buffer) => zlib.gzipSync(buffer, { level: 9 }).length;

// Runs inside the page: the visible body rows and their first-column text.
function readRows(kind) {
  if (kind === 'grid') {
    const rows = [...document.querySelectorAll('[role="grid"] [role="row"]')].filter((row) => row.querySelector('[role="gridcell"]'));
    return rows.map((row) => row.querySelector('[role="gridcell"]').textContent.trim());
  }
  const rows = [...document.querySelectorAll('table tbody tr')].filter((row) => !row.hidden && row.offsetParent !== null);
  return rows.map((row) => row.cells[0].textContent.trim());
}

function nameHeaderSelector(kind) {
  return kind === 'grid' ? '[role="columnheader"][data-header-id=":name"]' : 'thead th:first-child';
}
function columnHeaderSelector(kind, position) {
  return kind === 'grid' ? `[role="columnheader"][aria-colindex="${position}"]` : `thead th:nth-child(${position})`;
}

// Time from an action until the browser has drawn the frame after the last
// change the action made. A MutationObserver catches libraries that update
// after a delay (debounced search); the window is 1.5 s. The time includes
// style and layout of the changed rows, not only script time.
function timeAction(page, action, argument) {
  return page.evaluate(async ({ action: kind, argument: value }) => {
    let lastChange = null;
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => setTimeout(() => {
        lastChange = performance.now();
      }, 0));
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const start = performance.now();
    if (kind === 'click') {
      const header = document.querySelector(value);
      (header.querySelector('button, [role="button"]') ?? header).click();
    } else {
      const input = document.querySelector('input[type="search"]');
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    observer.disconnect();
    const settled = lastChange ?? start;
    return Math.round((settled - start) * 10) / 10;
  }, { action, argument });
}
const timeClick = (page, selector) => timeAction(page, 'click', selector);
const timeSearch = (page, text) => timeAction(page, 'search', text);
const median = (values) => [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)];

async function axeScan(page) {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return result.violations.map((violation) => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length, help: violation.help, firstTarget: violation.nodes[0]?.target.join(' '), firstSummary: violation.nodes[0]?.failureSummary }));
  });
}

async function measureCandidate(browser, origin, candidate) {
  const result = { route: candidate.route, label: candidate.label };
  const htmlFile = path.join(siteRoot, candidate.route, 'index.html');
  const html = fs.readFileSync(htmlFile);
  result.html = { bytes: html.length, gzipBytes: gzipSize(html), tableRowsInPrerenderedHtml: (html.toString().match(/<tr[ >]/g) ?? []).length - (candidate.kind === 'table' ? 1 : 0) };

  // 1. Without scripts.
  {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(origin + candidate.route);
    result.withoutScripts = candidate.kind === 'none' ? null : {
      visibleRows: (await page.evaluate(readRows, candidate.kind)).length,
      lastNameFindable: await page.evaluate(() => document.body.innerText.includes('Sample Nation 987')),
    };
    await context.close();
  }

  // 2. With scripts: bytes downloaded, time until ready, at normal speed and with the CPU slowed 4 times.
  for (const throttle of [1, 4]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const scripts = [];
    const styles = [];
    const otherHosts = new Set();
    page.on('response', async (response) => {
      const url = new URL(response.url());
      if (url.origin !== origin) otherHosts.add(url.host);
      const type = response.request().resourceType();
      if (type === 'script' || type === 'stylesheet') {
        try {
          const body = await response.body();
          (type === 'script' ? scripts : styles).push({ url: url.pathname, bytes: body.length, gzipBytes: gzipSize(body) });
        } catch {}
      }
    });
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    await page.goto(origin + candidate.route, { waitUntil: 'load' });
    if (candidate.kind !== 'none') await page.waitForSelector('html[data-table-ready]', { state: 'attached', timeout: 30000 });
    const timing = await page.evaluate(() => ({
      readyMilliseconds: performance.now(),
      domContentLoadedMilliseconds: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,
      elementCount: document.getElementsByTagName('*').length,
    }));
    if (throttle === 1) {
      await page.waitForTimeout(300);
      result.scripts = { files: scripts.length, bytes: scripts.reduce((sum, file) => sum + file.bytes, 0), gzipBytes: scripts.reduce((sum, file) => sum + file.gzipBytes, 0), list: scripts };
      result.styles = { bytes: styles.reduce((sum, file) => sum + file.bytes, 0), gzipBytes: styles.reduce((sum, file) => sum + file.gzipBytes, 0) };
      result.requestsToOtherHosts = [...otherHosts];
      result.timing = timing;
    } else {
      result.timingCpuSlowedFourTimes = timing;
    }

    if (candidate.kind !== 'none') {
      const label = throttle === 1 ? 'interaction' : 'interactionCpuSlowedFourTimes';
      const interaction = {};
      interaction.rowsInDocument = (await page.evaluate(readRows, candidate.kind)).length;
      // Sort by name: first click, then second click (the other direction).
      interaction.firstClickMilliseconds = await timeClick(page, nameHeaderSelector(candidate.kind));
      interaction.afterFirstClick = { ariaSort: await page.getAttribute(nameHeaderSelector(candidate.kind), 'aria-sort'), firstRows: (await page.evaluate(readRows, candidate.kind)).slice(0, 3) };
      interaction.secondClickMilliseconds = await timeClick(page, nameHeaderSelector(candidate.kind));
      interaction.afterSecondClick = { ariaSort: await page.getAttribute(nameHeaderSelector(candidate.kind), 'aria-sort'), firstRows: (await page.evaluate(readRows, candidate.kind)).slice(0, 3) };
      // Five more clicks; the median is the figure reported.
      const clickTimes = [interaction.firstClickMilliseconds, interaction.secondClickMilliseconds];
      for (let click = 0; click < 5; click += 1) clickTimes.push(await timeClick(page, nameHeaderSelector(candidate.kind)));
      interaction.sortClickMillisecondsMedian = median(clickTimes);
      interaction.sortClickMillisecondsAll = clickTimes;
      // Whichever click gave descending order shows where the 12 test names land.
      if (throttle === 1) {
        const descendingRows = interaction.afterSecondClick.firstRows[0].startsWith('Sample Nation 2') || interaction.afterSecondClick.firstRows[0].startsWith('Sample Nation 10')
          ? interaction.afterFirstClick : interaction.afterSecondClick;
        void descendingRows;
        // Click until the order is descending (some libraries cycle through
        // ascending, descending and unsorted).
        let rows = await page.evaluate(readRows, candidate.kind);
        for (let attempt = 0; attempt < 3 && /^Sample Nation \d/.test(rows[0]); attempt += 1) {
          await timeClick(page, nameHeaderSelector(candidate.kind));
          rows = await page.evaluate(readRows, candidate.kind);
        }
        interaction.descendingNameOrderOfTestRows = rows.slice(0, 13);
        // Date column: ascending should start in January 2025.
        await timeClick(page, columnHeaderSelector(candidate.kind, 6));
        const afterDateSort = await page.evaluate((kind) => {
          if (kind === 'grid') {
            const row = [...document.querySelectorAll('[role="grid"] [role="row"]')].find((element) => element.querySelector('[role="gridcell"]'));
            return [...row.querySelectorAll('[role="gridcell"]')].map((cell) => cell.textContent.trim())[5];
          }
          const row = [...document.querySelectorAll('table tbody tr')].find((element) => !element.hidden);
          return row.cells[5].textContent.trim();
        }, candidate.kind);
        interaction.lastVerifiedAfterOneClick = afterDateSort;
      }
      // Search.
      const hasSearch = await page.$('input[type="search"]');
      if (hasSearch) {
        interaction.searchMilliseconds = await timeSearch(page, 'Sample Nation 99');
        interaction.rowsMatching_SampleNation99 = (await page.evaluate(readRows, candidate.kind)).length;
        if (throttle === 1) {
          await timeSearch(page, 'okina');
          interaction.rowsMatching_okina = await page.evaluate(readRows, candidate.kind);
          await timeSearch(page, '');
        }
      }
      result[label] = interaction;
    }
    await context.close();
  }

  if (candidate.kind === 'none') return result;

  // 3. Structure, keyboard, accessibility scan, themes, narrow screen.
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme });
    const page = await context.newPage();
    await page.goto(origin + candidate.route);
    await page.waitForSelector('html[data-table-ready]', { state: 'attached' });
    await page.waitForTimeout(300);
    if (colorScheme === 'light') {
      result.structure = await page.evaluate(() => ({
        tableElements: document.querySelectorAll('table').length,
        captions: document.querySelectorAll('caption').length,
        columnHeadersWithScope: document.querySelectorAll('th[scope="col"]').length,
        rowHeadersWithScope: document.querySelectorAll('th[scope="row"]').length,
        gridRoles: document.querySelectorAll('[role="grid"], [role="treegrid"]').length,
        rowRoles: document.querySelectorAll('[role="row"]').length,
        gridcellRoles: document.querySelectorAll('[role="gridcell"]').length,
        sortButtons: document.querySelectorAll('thead button, [role="columnheader"] button').length,
        columnHeadersFocusable: document.querySelectorAll('[role="columnheader"][tabindex="0"]').length,
        searchHasLabel: (() => {
          const input = document.querySelector('input[type="search"]');
          if (!input) return null;
          return Boolean((input.id && document.querySelector(`label[for="${input.id}"]`)) || input.getAttribute('aria-label') || input.closest('label'));
        })(),
      }));
      // Keyboard: Tab from the top of the page until the "Nation" sort control has focus, then press Enter.
      await page.evaluate(() => document.activeElement?.blur());
      let reached = false;
      for (let press = 0; press < 40 && !reached; press += 1) {
        await page.keyboard.press('Tab');
        reached = await page.evaluate(() => {
          const active = document.activeElement;
          const name = `${active?.textContent ?? ''} ${active?.getAttribute('aria-label') ?? ''}`;
          return Boolean(active && /Nation/.test(name) && (active.closest('thead') || active.getAttribute('role') === 'columnheader' || active.closest('[role="columnheader"]')));
        });
        if (reached) result.keyboard = { tabPressesToNationSort: press + 1 };
      }
      if (reached) {
        // A key "sorts" if any of three presses changes the first row. (The
        // table starts sorted by name, so a press may only confirm that
        // order, and some libraries cycle back to the starting order.)
        const signature = async () => (await page.evaluate(readRows, candidate.kind))[0];
        for (const key of ['Enter', 'Space']) {
          const before = await signature();
          let changed = false;
          for (let press = 0; press < 3; press += 1) {
            await page.keyboard.press(key);
            await page.waitForTimeout(300);
            if ((await signature()) !== before) changed = true;
          }
          result.keyboard[`${key.toLowerCase()}Sorts`] = changed;
        }
      } else {
        result.keyboard = { tabPressesToNationSort: null };
      }
      await page.reload();
      await page.waitForSelector('html[data-table-ready]', { state: 'attached' });
      await page.waitForTimeout(300);
    }
    const colors = await page.evaluate((kind) => {
      const header = kind === 'grid' ? document.querySelector('[role="columnheader"]') : document.querySelector('thead th');
      const cell = kind === 'grid' ? document.querySelector('[role="gridcell"]') : document.querySelector('tbody td');
      const style = (element) => (element ? { color: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor } : null);
      // The surface token as the browser resolves it, to compare with the header.
      const probe = document.createElement('div');
      probe.style.background = 'var(--color-surface)';
      probe.style.color = 'var(--color-ink)';
      document.body.append(probe);
      const tokens = style(probe);
      probe.remove();
      return { page: style(document.body), header: style(header), cell: style(cell), tokenSurface: tokens.background, tokenInk: tokens.color };
    }, candidate.kind);
    const slug = candidate.route.replaceAll('/', '');
    await page.evaluate(() => window.scrollTo(0, 0));
    if (candidate.screenshots !== false) await page.screenshot({ path: path.join(evidence, `site-${slug}-${colorScheme}.png`) });
    result[`axe_${colorScheme}`] = await axeScan(page);
    result[`colors_${colorScheme}`] = colors;
    await context.close();
  }

  // Narrow screen (320 CSS px): the page must not scroll sideways; the table scrolls in its own box.
  {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const page = await context.newPage();
    await page.goto(origin + candidate.route);
    await page.waitForSelector('html[data-table-ready]', { state: 'attached' });
    await page.waitForTimeout(300);
    result.narrowScreen = await page.evaluate((kind) => {
      const box = kind === 'grid' ? document.querySelector('.wx-scroll, .wx-table-box') : document.querySelector('.table-scroll, .datatable-container');
      return {
        pageScrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        tableBoxScrolls: box ? box.scrollWidth > box.clientWidth : null,
      };
    }, candidate.kind);
    if (candidate.screenshots !== false) await page.screenshot({ path: path.join(evidence, `site-${candidate.route.replaceAll('/', '')}-320px.png`) });
    await context.close();
  }
  return result;
}

(async () => {
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const results = [];
  const only = process.argv[2];
  for (const candidate of candidates.filter((entry) => !only || entry.route === only)) {
    process.stdout.write(`Measuring ${candidate.label}...\n`);
    try {
      results.push(await measureCandidate(browser, origin, candidate));
    } catch (error) {
      results.push({ route: candidate.route, label: candidate.label, error: error.message.split('\n')[0] });
      process.stdout.write(`${error.stack}\n`);
    }
  }

  // The ebook's table chapter, scanned the same way.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`file://${path.join(spikeRoot, 'out', 'epub', 'unpacked', 'EPUB', 'table.xhtml')}`);
  const ebook = { axe: await axeScan(page), rowHeaders: await page.evaluate(() => document.querySelectorAll('th[scope="row"]').length) };
  await context.close();

  await browser.close();
  server.close();
  const expectedRowsFor99 = definition.rows.filter((row) => ['name', 'states', 'recognition', 'review'].some(() => true) && /99/.test(row.cells.name.text)).length;
  const output = { measuredOn: new Date().toISOString().slice(0, 10), browser: 'Chromium (Playwright)', rows: definition.rows.length, expectedRowsMatching_SampleNation99: expectedRowsFor99, results, ebook };
  if (only) {
    console.log(JSON.stringify(results, null, 2).slice(0, 4000));
    return;
  }
  fs.writeFileSync(path.join(evidence, 'site-output.json'), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(output, null, 2));
})();
