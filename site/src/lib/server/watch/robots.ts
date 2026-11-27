/**
 * robots.txt, read under RFC 9309 (https://www.rfc-editor.org/rfc/rfc9309),
 * plus the two extensions the source watch also obeys (docs/source-watch.md,
 * "robots.txt and content signals"):
 *
 * - Crawl-delay, which RFC 9309 does not define but many government sites
 *   set; the host's desk waits at least that long between requests.
 * - Content signals (https://contentsignals.org/), such as
 *   "Content-Signal: search=yes, ai-train=no". Where a site signals against
 *   AI use, or turns away Anthropic's crawler, the watcher still notes that a
 *   page changed but never sends that site's text to a model; a person reads it.
 *
 * Fetching it is the desk's job (./polite-fetch.ts); this only reads text.
 */

/** The product token the watcher's requests use, which robots.txt groups name. */
export const watchAgentToken = 'TribalLawProjectWatch';
/** Anthropic's crawler tokens: a site that turns these away gets no model reading of its text. */
const anthropicTokens = ['claudebot', 'claude-user', 'claude-searchbot', 'anthropic-ai'];

interface Rule {
	allow: boolean;
	pattern: string;
}

interface Group {
	agents: string[];
	rules: Rule[];
	crawlDelaySeconds?: number;
}

export interface Robots {
	groups: Group[];
	/** Every Content-Signal value, merged: signal name to yes/no. */
	contentSignals: Record<string, boolean>;
	/** Set when robots.txt could not be read and everything is treated as off-limits (RFC 9309, section 2.3.1.4). */
	unreachable?: boolean;
}

export const allowEverything: Robots = { groups: [], contentSignals: {} };
export const disallowEverything: Robots = { groups: [{ agents: ['*'], rules: [{ allow: false, pattern: '/' }] }], contentSignals: {}, unreachable: true };

/** Reads a robots.txt file. Lines it does not know are skipped, as the RFC asks. */
export function readRobots(text: string): Robots {
	const groups: Group[] = [];
	const contentSignals: Record<string, boolean> = {};
	let current: Group | null = null;
	let lastWasAgent = false;
	for (const rawLine of text.split(/\r\n|\r|\n/)) {
		const line = rawLine.replace(/#.*$/, '').trim();
		const colon = line.indexOf(':');
		if (colon < 0) continue;
		const name = line.slice(0, colon).trim().toLowerCase();
		const value = line.slice(colon + 1).trim();
		if (name === 'user-agent') {
			if (!lastWasAgent || !current) {
				current = { agents: [], rules: [] };
				groups.push(current);
			}
			current.agents.push(value.toLowerCase());
			lastWasAgent = true;
			continue;
		}
		lastWasAgent = false;
		if (name === 'content-signal') {
			for (const pair of value.split(',')) {
				const [signal, answer] = pair.split('=').map((part) => part.trim().toLowerCase());
				if (signal && (answer === 'yes' || answer === 'no')) contentSignals[signal] = answer === 'yes';
			}
			continue;
		}
		if (!current) continue;
		if (name === 'allow' || name === 'disallow') {
			// An empty Disallow allows everything; it adds no rule.
			if (value !== '') current.rules.push({ allow: name === 'allow', pattern: value });
		} else if (name === 'crawl-delay') {
			const seconds = Number(value);
			if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelaySeconds = seconds;
		}
	}
	return { groups, contentSignals };
}

/** The groups that apply to an agent: those naming its token, or else those for "*" (RFC 9309, section 2.2.1). */
function groupsFor(robots: Robots, token: string): Group[] {
	const lower = token.toLowerCase();
	const named = robots.groups.filter((group) => group.agents.includes(lower));
	return named.length > 0 ? named : robots.groups.filter((group) => group.agents.includes('*'));
}

/** Whether a robots.txt pattern (with * and a final $) matches a path. */
function patternMatches(pattern: string, path: string): boolean {
	const anchored = pattern.endsWith('$');
	const body = anchored ? pattern.slice(0, -1) : pattern;
	const expression = body
		.split('*')
		.map((piece) => piece.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
		.join('.*');
	return new RegExp(`^${expression}${anchored ? '$' : ''}`).test(path);
}

/** Decodes percent-escapes that need none, so "/a%2Db" and "/a-b" compare alike (RFC 9309, section 2.2.2). */
function normalizePath(path: string): string {
	return path.replace(/%([0-9a-fA-F]{2})/g, (escape, hex: string) => {
		const character = String.fromCharCode(parseInt(hex, 16));
		return /[A-Za-z0-9\-._~]/.test(character) ? character : escape.toUpperCase();
	});
}

/** Whether an agent may fetch a path (with its query). The longest matching rule wins; on a tie, Allow wins. */
export function mayFetch(robots: Robots, path: string, token = watchAgentToken): boolean {
	if (path === '/robots.txt') return true;
	const normalized = normalizePath(path);
	let best: Rule | null = null;
	for (const group of groupsFor(robots, token)) {
		for (const rule of group.rules) {
			if (!patternMatches(normalizePath(rule.pattern), normalized)) continue;
			if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
		}
	}
	return best ? best.allow : true;
}

/** The longest Crawl-delay among the groups that apply to the agent, in seconds, or null. */
export function crawlDelaySeconds(robots: Robots, token = watchAgentToken): number | null {
	const delays = groupsFor(robots, token)
		.map((group) => group.crawlDelaySeconds)
		.filter((delay): delay is number => typeof delay === 'number');
	return delays.length > 0 ? Math.max(...delays) : null;
}

/**
 * Whether a page's text may be sent to a model: not when the site signals
 * against AI training or AI input, and not when it turns away Anthropic's
 * crawlers for that path.
 */
export function modelMayRead(robots: Robots, path: string): boolean {
	if (robots.contentSignals['ai-train'] === false || robots.contentSignals['ai-input'] === false) return false;
	for (const token of anthropicTokens) {
		const named = robots.groups.some((group) => group.agents.includes(token));
		if (named && !mayFetch(robots, path, token)) return false;
	}
	return true;
}

/**
 * What to do with a robots.txt answer (RFC 9309, section 2.3.1): a 2xx is
 * read; any other 4xx means no rules; a 5xx, a 429 or no answer means the
 * whole site is off-limits until it answers.
 */
export function robotsFromAnswer(status: number | null, text: string): Robots {
	if (status !== null && status >= 200 && status < 300) return readRobots(text);
	if (status !== null && status >= 400 && status < 500 && status !== 429) return allowEverything;
	return disallowEverything;
}
