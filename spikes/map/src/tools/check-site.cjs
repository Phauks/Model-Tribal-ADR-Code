// Browser checks for the sample page: hover, click, keyboard, no-script fallback, offline,
// light and dark themes, external requests, and an axe-core accessibility scan.
// Usage: node tools/check-site.cjs <base url> <axe.min.js path> <screenshot folder>
const { chromium } = require("playwright");
const { readFileSync } = require("node:fs");

(async () => {
  const [base, axePath, shots] = process.argv.slice(2);
  const axeSource = readFileSync(axePath, "utf8");
  const results = {};
  const browser = await chromium.launch();

  const context = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: "light" });
  const page = await context.newPage();
  const externalRequests = [];
  page.on("request", (request) => { if (!request.url().startsWith(base)) externalRequests.push(request.url()); });
  await page.goto(`${base}/index.html`);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // second load is served under the service worker's control
  results.service_worker_controls_page = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));

  // Hover
  await page.hover('path[data-state="OK"]');
  results.hover_tooltip = await page.textContent("#map-tooltip");
  results.hover_tooltip_visible = await page.isVisible("#map-tooltip");
  // Click
  await page.click('path[data-state="OK"]');
  results.click_details_heading = await page.textContent("#state-details h2");
  results.click_details_items = await page.locator("#state-details li").count();
  results.focus_after_click = await page.evaluate(() => document.activeElement.id);
  // Small place marker (DC) is clickable even though the district is a few pixels wide
  await page.click('circle[data-state="DC"]');
  results.click_marker_details_heading = await page.textContent("#state-details h2");
  // Keyboard: how many tab stops does the map add, and does Enter open details?
  results.map_tab_stops = await page.locator(".presence-map a").count();
  await page.focus('.presence-map a[href="#state-AZ"]');
  await page.keyboard.press("Enter");
  results.keyboard_enter_details_heading = await page.textContent("#state-details h2");
  results.table_rows = await page.locator("#presence-table tbody tr").count();

  const runAxe = async () => {
    await page.addScriptTag({ content: axeSource });
    const report = await page.evaluate(async () => (await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] })));
    return report.violations.map((violation) => `${violation.id} (${violation.impact}, ${violation.nodes.length} nodes)`);
  };
  results.axe_light_violations = await runAxe();
  await page.screenshot({ path: `${shots}/site-light.png`, fullPage: false });

  // Theme toggle (explicit choice) and system dark preference
  await page.click("#theme-toggle");
  results.toggle_sets_theme = await page.evaluate(() => document.documentElement.dataset.theme);
  results.dark_fill_oklahoma = await page.evaluate(() => getComputedStyle(document.querySelector('path[data-state="OK"]')).fill);
  results.axe_dark_violations = await runAxe();

  // Offline: drop the network and reload
  await context.setOffline(true);
  await page.reload();
  results.offline_map_states = await page.locator(".presence-map .state").count();
  results.offline_table_rows = await page.locator("#presence-table tbody tr").count();
  await page.hover('path[data-state="NV"]');
  results.offline_hover_tooltip = await page.textContent("#map-tooltip");
  results.offline_font_loaded = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('16px "Atkinson Hyperlegible Next"'); });
  results.external_requests = externalRequests;
  await context.close();

  // System dark preference with no stored choice
  const darkContext = await browser.newContext({ viewport: { width: 1100, height: 900 }, colorScheme: "dark" });
  const darkPage = await darkContext.newPage();
  await darkPage.goto(`${base}/index.html`);
  results.system_dark_fill_oklahoma = await darkPage.evaluate(() => getComputedStyle(document.querySelector('path[data-state="OK"]')).fill);
  await darkPage.hover('path[data-state="OK"]');
  await darkPage.screenshot({ path: `${shots}/site-dark.png`, fullPage: false });
  await darkContext.close();

  // No script: links still reach the table row, titles remain for tooltips
  const plainContext = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1100, height: 900 } });
  const plainPage = await plainContext.newPage();
  await plainPage.goto(`${base}/index.html`);
  await plainPage.click('path[data-state="OK"]');
  results.no_script_click_url_hash = new URL(plainPage.url()).hash;
  results.no_script_title_elements = await plainPage.locator(".presence-map title").count();
  await plainContext.close();

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
