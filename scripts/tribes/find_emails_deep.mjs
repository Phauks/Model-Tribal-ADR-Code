// Read nations' own websites more deeply for an email address, with a real browser.
//
// scripts/tribes/find_contacts.py read each site's home page and up to three contact pages
// as plain HTML. Many sites build their pages with scripts (Wix, Squarespace, Weebly) or hide
// addresses from scripts (Cloudflare's email protection, "name [at] tribe [dot] org"), so this
// pass opens each page in headless Chromium and reads it after it renders. Per site it reads
// the home page, the contact pages already on file, and up to EXTRA_PAGES more same-site pages
// whose link words or address suggest contact, about, government, council, administration,
// office, staff or directory, plus matching addresses from the site's sitemap. It obeys
// robots.txt, waits about a second between pages of one site, and does not try to get past a
// bot check or a sign-in.
//
// The results name staff members, so they are written outside the repository (argument 2);
// scripts/tribes/write_contacts.py keeps only general office addresses from them.
//
// Run from the repository root:
//   node scripts/tribes/find_emails_deep.mjs missing.json results.json
// missing.json: [{id, name, sites: [address], contact_pages: [address]}]

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const AGENT_NAME = 'model-tribal-adr-code contact finder';
const USER_AGENT = `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 (${AGENT_NAME}; nations' published contact pages; about 1 page per second per site)`;
const EXTRA_PAGES = 8;
const PARALLEL = 10;
const LINK_WORDS = /\b(contact|about|government|council|administration|admin|office|staff|directory|departments?|leadership|reach us|get in touch|tribal (council|government|office))\b/i;
const LINK_ADDRESS = /contact|about|government|council|admin|office|staff|directory|department|leadership/i;
const SKIP = /\.(pdf|jpe?g|png|gif|docx?|xlsx?|zip|mp4|mp3)(\?|$)|\/wp-content\/|\/feed\/?$|\/(cart|login|account|shop)\b/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const OBFUSCATED = /([A-Za-z0-9._%+-]+)\s*[\[(]\s*at\s*[\])]\s*([A-Za-z0-9-]+(?:\s*[\[(]\s*dot\s*[\])]\s*[A-Za-z0-9-]+)+)/gi;
const CHALLENGE = /just a moment|one moment, please|attention required|access denied|captcha|are you a robot|verify you are human/i;

const [, , input, output] = process.argv;
const nations = JSON.parse(readFileSync(input, 'utf8')).filter((n) => n.sites.length || n.contact_pages.length);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const host = (address) => new URL(address).hostname.toLowerCase().replace(/^www\./, '');

function decodeCloudflare(hex) {
	const key = parseInt(hex.slice(0, 2), 16);
	let text = '';
	for (let i = 2; i < hex.length; i += 2) text += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
	return text;
}

async function robotsFor(context, origin) {
	try {
		const response = await context.request.get(`${origin}/robots.txt`, { timeout: 15000 });
		if (!response.ok()) return [];
		const rules = [];
		let applies = false;
		for (const raw of (await response.text()).split('\n')) {
			const line = raw.split('#')[0].trim();
			const [field, ...rest] = line.split(':');
			const value = rest.join(':').trim();
			if (/^user-agent$/i.test(field)) applies = value === '*' || AGENT_NAME.toLowerCase().includes(value.toLowerCase());
			else if (applies && /^disallow$/i.test(field) && value) rules.push(value);
		}
		return rules;
	} catch {
		return [];
	}
}

async function sitemapLinks(context, origin) {
	try {
		const response = await context.request.get(`${origin}/sitemap.xml`, { timeout: 15000 });
		if (!response.ok()) return [];
		let text = await response.text();
		const nested = [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]).filter((l) => /sitemap.*\.xml/i.test(l) && /page/i.test(l));
		for (const more of nested.slice(0, 2)) {
			const r = await context.request.get(more, { timeout: 15000 }).catch(() => null);
			if (r?.ok()) text += await r.text();
		}
		return [...text.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]).filter((l) => !/\.xml$/i.test(l) && LINK_ADDRESS.test(new URL(l).pathname));
	} catch {
		return [];
	}
}

async function readPage(page, address) {
	const response = await page.goto(address, { timeout: 30000, waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
	const title = await page.title();
	const found = await page.evaluate(() => {
		const mailto = [...document.querySelectorAll('a[href^="mailto:" i]')].map((a) => ({ value: decodeURIComponent(a.getAttribute('href').slice(7).split('?')[0]), words: (a.innerText || '').trim().slice(0, 120), context: (a.closest('p,li,div,td,section')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 240) }));
		const protectedAddresses = [...document.querySelectorAll('[data-cfemail]')].map((el) => el.getAttribute('data-cfemail'));
		const protectedLinks = [...document.querySelectorAll('a[href*="email-protection#"]')].map((a) => a.getAttribute('href').split('#')[1]);
		const links = [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, words: (a.innerText || a.getAttribute('aria-label') || '').trim().slice(0, 120) }));
		const forms = document.querySelectorAll('form textarea, form input[type="email"]').length;
		return { mailto, protectedAddresses: [...protectedAddresses, ...protectedLinks], links, text: document.body ? document.body.innerText : '', forms };
	});
	return { status: response?.status() ?? null, final: page.url(), title, ...found };
}

function emailsFrom(result, address) {
	const emails = new Map();
	const add = (value, how, context) => {
		value = value.trim().toLowerCase().replace(/^mailto:/, '').replace(/[.,;:]+$/, '');
		if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(value) || /\.(png|jpe?g|gif|webp|svg)$/.test(value) || /example\.|sentry|wixpress|domain\.com|email\.com$/.test(value)) return;
		if (!emails.has(value)) emails.set(value, { value, page: address, how, context: context.slice(0, 240) });
	};
	for (const m of result.mailto) add(m.value, 'mailto', `${m.words} | ${m.context}`);
	for (const hex of result.protectedAddresses) if (hex) add(decodeCloudflare(hex), 'cloudflare-protected', '');
	const text = result.text.replace(/\s+/g, ' ');
	for (const m of text.matchAll(EMAIL)) add(m[0], 'text', text.slice(Math.max(0, m.index - 160), m.index + m[0].length + 40));
	for (const m of text.matchAll(OBFUSCATED)) add(`${m[1]}@${m[2].replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, '.')}`, 'written-out', text.slice(Math.max(0, m.index - 160), m.index + m[0].length + 40));
	return [...emails.values()];
}

async function searchNation(browser, nation) {
	const result = { id: nation.id, name: nation.name, checked: new Date().toISOString().slice(0, 10), sites: [], pages: [], emails: [] };
	for (const site of nation.sites.length ? nation.sites : [nation.contact_pages[0]]) {
		const context = await browser.newContext({ userAgent: USER_AGENT, ignoreHTTPSErrors: true });
		const page = await context.newPage();
		const record = { site, read: 0, challenge: false, unreachable: false };
		try {
			const origin = new URL(site).origin;
			const disallowed = await robotsFor(context, origin);
			const allowed = (address) => !disallowed.some((rule) => new URL(address).pathname.startsWith(rule));
			const queue = [site, ...nation.contact_pages.filter((p) => host(p) === host(site))];
			const seen = new Set();
			let extra = 0;
			const candidates = new Map();
			for (const link of await sitemapLinks(context, origin)) candidates.set(link.split('#')[0], 2);
			while (queue.length || candidates.size) {
				let address = queue.shift();
				if (!address) {
					if (extra >= EXTRA_PAGES) break;
					const [best] = [...candidates.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
					candidates.delete(best[0]);
					address = best[0];
					extra += 1;
				}
				address = address.split('#')[0];
				if (seen.has(address) || !allowed(address)) continue;
				seen.add(address);
				let read;
				try {
					read = await readPage(page, address);
				} catch (error) {
					result.pages.push({ address, error: String(error.message).slice(0, 120) });
					if (record.read === 0) record.unreachable = true;
					continue;
				}
				record.read += 1;
				seen.add(read.final.split('#')[0]);
				if (CHALLENGE.test(read.title) || CHALLENGE.test(read.text.slice(0, 400))) record.challenge = true;
				const emails = emailsFrom(read, read.final);
				result.pages.push({ address: read.final, title: read.title.slice(0, 160), status: read.status, emails: emails.length, form: read.forms > 0 });
				for (const email of emails) if (!result.emails.some((e) => e.value === email.value)) result.emails.push(email);
				for (const link of read.links) {
					try {
						const target = new URL(link.href);
						if (!/^https?:$/.test(target.protocol) || host(target.href) !== host(site) || SKIP.test(target.href)) continue;
						const clean = target.href.split('#')[0];
						let score = 0;
						if (/contact/i.test(link.words)) score += 5;
						if (/contact/i.test(target.pathname)) score += 4;
						if (LINK_WORDS.test(link.words)) score += 2;
						if (LINK_ADDRESS.test(target.pathname)) score += 1;
						if (score && !seen.has(clean)) candidates.set(clean, Math.max(score, candidates.get(clean) ?? 0));
					} catch {}
				}
				await sleep(1000);
			}
		} catch (error) {
			record.unreachable = true;
		}
		result.sites.push(record);
		await context.close();
	}
	return result;
}

const browser = await chromium.launch();
const results = [];
let next = 0;
async function worker() {
	while (next < nations.length) {
		const nation = nations[next++];
		const result = await Promise.race([searchNation(browser, nation), sleep(240000).then(() => ({ id: nation.id, name: nation.name, timeout: true, sites: [], pages: [], emails: [] }))]);
		results.push(result);
		if (results.length % 25 === 0) {
			console.error(`${results.length} of ${nations.length}`);
			writeFileSync(output, JSON.stringify(results, null, 1) + '\n');
		}
	}
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
await browser.close();
results.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(output, JSON.stringify(results, null, 1) + '\n');
console.error(`${results.length} nations; ${results.filter((r) => r.emails.length).length} with an address`);
