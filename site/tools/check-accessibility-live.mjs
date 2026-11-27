// Runs axe-core on the pages the Worker answers, signed out and signed in,
// and on the site's menus and dialogs while they are open, in the light and
// the dark theme (site/DESIGN.md, section 9). Run from site/ after
// `npm run build`:
//   node tools/check-accessibility-live.mjs [--only /workspace,/sign-in]
//
// tools/check-accessibility.mjs checks every prerendered page as first
// loaded. This checks what that cannot reach: the workspace, sign-in,
// account, profile, events, uploads and request pages, which the Worker
// renders for each visitor, and the open states of the header's controls,
// the sidebar and the dropdowns. It uses the same axe-core rules and themes
// (tools/accessibility-rules.mjs).
//
// It fills the local copy of the database with the fixtures of
// tools/seed-local-database.mjs (never the live database), starts sessions
// for the fixture accounts, starts the built Worker with `wrangler dev`, and
// opens each page in Chromium through Playwright as the visitor named for
// it. Requests to other hosts are blocked.
//
// --only checks just the pages whose address starts with one of the given
// addresses. Set CHROMIUM_PATH to use a Chromium that is already installed.

import { chromium } from 'playwright';
import { axeViolations, describeViolation, waitUntilSettled } from './accessibility-rules.mjs';
import { startLocalWorker } from './local-worker.mjs';
import {
	executeLocally,
	fixtureEssay,
	fixtureEvent,
	fixtureNation,
	fixtureRequestReference,
	fixtureSessions,
	fixtureUploadReferences,
	seed
} from './seed-local-database.mjs';

/** Time limits, in milliseconds. */
const limits = { navigation: 60_000, page: 120_000, open: 10_000 };
const wide = { width: 1280, height: 800 };
const phone = { width: 390, height: 844 };

/**
 * Problems axe-core finds that are known and accepted for now, each with the
 * reason. `where` is the page's address, with " › " and the open state when
 * there is one. Keep this short: fix a problem rather than list it here.
 */
const allowed = [
	// The small "Document access" link in each row sits 2 px above the row's
	// "Remove access" button. Making it a 24 px target moves the buttons.
	{ where: '/workspace/people as leadAuthor', rule: 'target-size', reason: 'link and button stacked in the Actions column' },
	// The open search panel drops from the masthead over the right of the
	// section bar (SectionBar.svelte), so axe measures the sections under it
	// as partly covered. They are behind the panel, which closes on a click
	// outside it, not beside it.
	{ where: '/glossary as signedOut › search', rule: 'target-size', reason: 'sections behind the open search panel' },
	{ where: '/workspace as leadAuthor › search', rule: 'target-size', reason: 'sections behind the open search panel' }
];

/* Opening menus and dialogs ------------------------------------------------ */

/** Clicks the button with this name in the masthead, opening the More menu first when the screen is narrow. */
async function mastheadButton(page, name) {
	const more = page.locator('.masthead .more-button');
	if (await more.isVisible()) await more.click();
	await page.locator('.masthead').getByRole('button', { name, exact: true }).filter({ visible: true }).first().click();
}

/** The open states each page can be checked in, by name. */
const openers = {
	async search(page) {
		// Wide screens show the search box in the masthead; narrower ones show the icon that opens it as a bar.
		const icon = page.locator('.masthead .site-search > button[aria-label="Search"]');
		if (await icon.isVisible()) await icon.click();
		const box = page.locator('.masthead input[type="search"]');
		await box.click();
		await box.fill('navajo');
		await page.locator('.search-panel').waitFor({ state: 'visible' });
	},
	async 'page settings'(page) {
		await mastheadButton(page, 'Settings');
		await page.locator('#page-settings').waitFor({ state: 'visible' });
	},
	async settings(page) {
		await openers['page settings'](page);
		await page.locator('#page-settings').getByRole('button', { name: 'More settings' }).click();
		await page.locator('dialog.modal[open]').waitFor({ state: 'visible' });
	},
	async 'settings dropdown'(page) {
		await openers.settings(page);
		await page.locator('dialog.modal[open] .dropdown-button').first().click();
		await page.locator('dialog.modal[open] [role="listbox"]').first().waitFor({ state: 'visible' });
	},
	async print(page) {
		await mastheadButton(page, 'Print this page');
		await page.locator('dialog.modal[open]').waitFor({ state: 'visible' });
	},
	async download(page) {
		await mastheadButton(page, 'Download');
		await page.locator('#download-choices').waitFor({ state: 'visible' });
	},
	async report(page) {
		await mastheadButton(page, 'Request a Change');
		await page.locator('dialog.modal[open]').waitFor({ state: 'visible' });
	},
	async follow(page) {
		await mastheadButton(page, 'Follow this page');
		await page.locator('dialog.modal[open]').waitFor({ state: 'visible' });
	},
	async account(page) {
		await mastheadButton(page, 'Your account');
		await page.locator('#account-links').waitFor({ state: 'visible' });
	},
	async 'sign-in panel'(page) {
		await mastheadButton(page, 'Sign in');
		await page.locator('#sign-in-panel form').first().waitFor({ state: 'visible' });
	},
	async 'section menu'(page) {
		await page.locator('.section-bar summary').first().click();
		await page.locator('.section-bar details[open] .menu-panel').waitFor({ state: 'visible' });
	},
	async 'phone menu'(page) {
		await page.setViewportSize(phone);
		await page.locator('.sidebar-narrow .menu-sheet > summary').click();
		await page.locator('.sidebar-narrow .menu-sheet[open] > nav').waitFor({ state: 'visible' });
	},
	async 'phone more'(page) {
		await page.setViewportSize(phone);
		await page.locator('.masthead .more-button').click();
		await page.locator('#masthead-more').waitFor({ state: 'visible' });
	},
	async 'column filter'(page) {
		await page.locator('table thead button.filter-button').filter({ visible: true }).first().click();
		await page.locator('[popover]:popover-open').first().waitFor({ state: 'visible' });
	},
	async 'searchable dropdown'(page) {
		await page.locator('input[role="combobox"]').filter({ visible: true }).first().click();
		await page.locator('[role="listbox"]').filter({ visible: true }).first().waitFor({ state: 'visible' });
	}
};

/* The pages, and whom to see them as -------------------------------------- */

const headerStates = ['search', 'page settings', 'settings', 'settings dropdown', 'print', 'download', 'report'];

/** Each visitor's pages: an address, or an address and the open states to check it in. */
const visits = {
	signedOut: [
		['/glossary', [...headerStates, 'sign-in panel', 'section menu', 'phone menu', 'phone more']],
		['/nations/hannahville-indian-community', ['follow']],
		['/supreme-court/burger-court', ['column filter']],
		// One page of each family the Worker draws from built data (src/lib/server/page-data.ts); the prerendered check no longer sees them.
		'/cases/worcester-v-georgia',
		'/laws/act-1858-12-22-pueblo-land-claims-confirmed',
		'/biographies/a-pish-ka-go-gi',
		'/supreme-court/justices/john-marshall',
		'/supreme-court/presidents/abraham-lincoln',
		'/sign-in',
		'/sign-in/forgot',
		['/requests', ['sign-in panel']],
		'/events',
		`/events/${fixtureEvent}`
	],
	reader: [
		['/account/security', ['account']],
		'/account/security/two-step',
		'/account/orders',
		'/account/data',
		'/account/email',
		'/profile',
		['/profile/edit', ['searchable dropdown']],
		'/uploads',
		'/uploads/send',
		'/events',
		`/events/${fixtureEvent}`,
		'/store'
	],
	leadAuthor: [
		['/workspace', [...headerStates, 'account', 'phone menu', 'phone more']],
		'/workspace/people',
		'/workspace/access',
		'/workspace/requests',
		`/workspace/requests/${fixtureRequestReference}`,
		'/workspace/uploads',
		`/workspace/uploads/${fixtureUploadReferences[1]}`,
		`/workspace/essays/${fixtureEssay}`,
		'/workspace/events',
		'/workspace/events/new',
		'/workspace/nation-teams',
		`/workspace/nation-teams/${fixtureNation}`,
		'/workspace/activity',
		'/workspace/contributors',
		'/workspace/reviews',
		'/workspace/orders',
		'/workspace/sponsors',
		'/workspace/rooms',
		'/workspace/intake',
		'/workspace/address-book',
		'/workspace/site-text',
		'/workspace/nonprofit',
		'/workspace/comments',
		'/workspace/review-requests'
	],
	coAuthor: ['/workspace', `/workspace/essays/${fixtureEssay}`],
	nationReviewer: ['/profile/nation-team', `/workspace/nation-teams/${fixtureNation}`]
};

function argument(name) {
	const index = process.argv.indexOf(name);
	return index > -1 ? process.argv[index + 1] : undefined;
}
const only = argument('--only')?.split(',');

/* Running it ---------------------------------------------------------------- */

function withLimit(promise, milliseconds, message) {
	let timer;
	const limit = new Promise((_, reject) => {
		timer = setTimeout(() => reject(new Error(message)), milliseconds);
	});
	return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

const started = Date.now();
await seed();
const signedIn = Object.keys(visits).filter((visitor) => visitor !== 'signedOut');
const { statements, tokens } = fixtureSessions(signedIn);
executeLocally(statements);

const worker = await startLocalWorker();
// The browser reaches no other host: every request to one goes to a proxy
// that is not there and fails at once. Blocking them with context.route()
// alone is not enough, because Playwright routes a request's first address
// and not where it is redirected. A copy the local bucket lacks is answered
// with a redirect to its government address, so the law page's embedded
// Statutes at Large copy loaded www.govinfo.gov, and when govinfo.gov stopped
// answering on Nov. 27, 2026 the page's load never finished.
const browser = await chromium.launch({
	...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
	proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1' }
});
const problems = [];
const accepted = [];
let checked = 0;

/** Loads a page as the context's visitor, and returns why it cannot be checked, if it cannot. */
async function load(page, address) {
	const response = await page.goto(worker.base + address, { waitUntil: 'load' });
	const landed = new URL(page.url()).pathname;
	if (!response?.ok()) return `answered ${response?.status()}`;
	if (landed !== address) return `went to ${landed} instead`;
	await waitUntilSettled(page);
	return undefined;
}

async function check(page, where) {
	for (const violation of await axeViolations(page)) {
		const line = describeViolation(where, violation);
		const reason = allowed.find((entry) => entry.where === where && entry.rule === violation.id)?.reason;
		if (reason) accepted.push(`${line} (allowed: ${reason})`);
		else problems.push(line);
	}
	checked += 1;
}

try {
	for (const [visitor, addresses] of Object.entries(visits)) {
		const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: wide });
		context.setDefaultNavigationTimeout(limits.navigation);
		context.setDefaultTimeout(limits.open);
		await context.route(
			(url) => url.origin !== worker.base,
			(route) => route.abort('blockedbyclient')
		);
		if (tokens[visitor]) {
			// The session cookie (src/lib/server/sign-in.ts). Its __Host- name needs Secure, which browsers allow on 127.0.0.1.
			const host = new URL(worker.base).hostname;
			await context.addCookies([
				{ name: '__Host-session', value: tokens[visitor], domain: host, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' }
			]);
		}
		const page = await context.newPage();
		for (const entry of addresses) {
			const [address, states] = typeof entry === 'string' ? [entry, []] : entry;
			if (only && !only.some((prefix) => address.startsWith(prefix))) continue;
			const label = `${address} as ${visitor}`;
			try {
				await withLimit(
					(async () => {
						const problem = await load(page, address);
						if (problem) {
							problems.push(`${label}: ${problem}`);
							return;
						}
						await check(page, label);
						for (const state of states) {
							await page.setViewportSize(wide);
							if ((await load(page, address)) !== undefined) continue;
							try {
								await openers[state](page);
							} catch (error) {
								problems.push(`${label} › ${state}: could not be opened: ${error.message.split('\n')[0]}`);
								continue;
							}
							await waitUntilSettled(page);
							await check(page, `${label} › ${state}`);
						}
						await page.setViewportSize(wide);
					})(),
					limits.page,
					`took longer than ${limits.page / 1000} s`
				);
			} catch (error) {
				problems.push(`${label}: could not be checked: ${error.message.split('\n')[0]}`);
			}
		}
		await context.close();
	}
} finally {
	await browser.close().catch(() => {});
	await worker.stop();
}

const seconds = Math.round((Date.now() - started) / 1000);
if (accepted.length > 0) console.log(`Allowed for now:\n${accepted.join('\n')}\n`);
if (problems.length > 0) {
	console.error(problems.join('\n'));
	console.error(`\n${problems.length} accessibility problem(s) found on the Worker's pages and open menus.`);
	process.exit(1);
}
console.log(`Accessibility checked with axe-core on the Worker's pages and open menus: ${checked} views in 2 themes, ${seconds} s.`);
