/**
 * The by-hand driver (docs/source-watch.md, "Watchers"): for a source that
 * turns scripts away or asks not to be read systematically, the watcher adds
 * a reminder to the review queue on its schedule, such as "Check the National
 * Indian Law Library bulletin", with the same "Send a file" link as the
 * Wayback captures page. It fetches nothing.
 */
import type { CheckContext, CheckResult, Feed } from '../watcher.ts';

/** One reminder per period: the period's start (a month "2026-11", a week's Monday) is its identifier. */
export function reminder(context: CheckContext, options: { title: string; link: string; feeds: Feed[]; period: 'month' | 'week' | 'year'; instructions: string }): CheckResult {
	const now = context.now;
	let period: string;
	if (options.period === 'year') period = String(now.getUTCFullYear());
	else if (options.period === 'month') period = now.toISOString().slice(0, 7);
	else {
		const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
		period = monday.toISOString().slice(0, 10);
	}
	if (context.cursor === period) return { items: [], cursor: period };
	return {
		cursor: period,
		items: [{ sourceIdentifier: `reminder-${period}`, kind: 'by-hand-reminder', title: options.title, link: options.link, date: now.toISOString().slice(0, 10), feeds: options.feeds, summary: options.instructions, noModelText: true }]
	};
}
