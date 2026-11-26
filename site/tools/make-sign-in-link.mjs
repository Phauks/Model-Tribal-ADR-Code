#!/usr/bin/env node
/**
 * Makes a one-time sign-in link for an email address, from the command line,
 * for someone with access to the project's Cloudflare account
 * (site/COLLABORATION.md, "First sign-in").
 *
 * Use it for the first lead author before the site can send email, or when
 * someone has lost both their password and access to their email. The link
 * works once, for one hour. It is printed here and stored in the database
 * only as a SHA-256 hash.
 *
 *   npm run sign-in-link -- person@example.com
 *   npm run sign-in-link -- person@example.com --local
 *   npm run sign-in-link -- person@example.com --site https://example.org
 *
 * --local writes to the copy of the database that `npm run preview` uses and
 * prints a link for http://localhost:8787. Without it, Wrangler writes to
 * the live database and needs to be signed in to Cloudflare.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const arguments_ = process.argv.slice(2);
const local = arguments_.includes('--local');
const siteIndex = arguments_.indexOf('--site');
const email = arguments_.find((value, index) => !value.startsWith('--') && (siteIndex < 0 || index !== siteIndex + 1));
const site =
	siteIndex >= 0 ? arguments_[siteIndex + 1] : local ? 'http://localhost:8787' : 'https://triballawproject.org';

if (!email || !/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/u.test(email)) {
	console.error('Give the email address, for example: npm run sign-in-link -- person@example.com');
	process.exit(1);
}

const token = randomBytes(32).toString('base64url');
const linkHash = createHash('sha256').update(token).digest('hex');
const created = new Date();
const expires = new Date(created.getTime() + 60 * 60 * 1000);
const address = email.normalize('NFC').trim();

// Every value is checked above or made here, and none can contain a quote.
const sql = `INSERT INTO sign_in_codes (identifier, email, code_hash, link_hash, origin, created_at, expires_at)
VALUES ('${randomUUID()}', '${address}', NULL, '${linkHash}', 'operator', '${created.toISOString()}', '${expires.toISOString()}');`;

execFileSync('npx', ['wrangler', 'd1', 'execute', 'database', local ? '--local' : '--remote', '--command', sql], {
	stdio: ['ignore', 'ignore', 'inherit']
});

const link = new URL('/sign-in/link', site);
link.searchParams.set('token', token);
console.log(`Sign-in link for ${address}, working once until ${expires.toLocaleString('en-US')}:`);
console.log(link.href);
