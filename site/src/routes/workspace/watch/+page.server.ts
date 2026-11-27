import { fail } from '@sveltejs/kit';
import { nationNames } from 'virtual:section-lists';
import { collections } from '#lib/server/collections.ts';
import { fileScans, scanStatusWords } from '#lib/server/file-scans.ts';
import { readWatchProgress, watchState, watchStateWords, watchWorkerAddress } from '#lib/server/watch/progress.ts';
import { decide, decisions, readFilters, readView, reviewList, reviewViewLabels, viewsFor, type Decision } from '#lib/server/watch/review.ts';
import { formText, requirePermission, storage } from '#lib/server/workspace.ts';
import { isAdministrator } from '#lib/permissions.ts';
import { watcherNamed } from '../../../../watch/watchers/index.ts';
import type { Actions, PageServerLoad } from './$types';
import { reportHere } from '#lib/server/report-here.ts';

// What the source watch found (docs/source-watch.md, "The review queue"),
// laid out as mockup A, which Trevor chose on Nov. 26, 2026: one table whose
// rows open in place. Nothing is published from here.
export const prerender = false;

const nationNameByIdentifier = new Map(nationNames.map(([name, identifier]) => [identifier, name]));
const collectionTitles: Record<string, string> = Object.fromEntries(collections.map((collection) => [collection.identifier, collection.title]));

function nextRun(progress: Awaited<ReturnType<typeof readWatchProgress>>): { title: string; at: string } | null {
	const due = Object.values(progress?.watchers ?? {})
		.filter((watcher) => watcher.enabled && watcher.nextDueAt)
		.sort((first, second) => (first.nextDueAt ?? '').localeCompare(second.nextDueAt ?? ''))[0];
	return due?.nextDueAt ? { title: due.title, at: due.nextDueAt } : null;
}

export const load: PageServerLoad = async (event) => {
	const person = requirePermission(event, 'review-watch');
	const { database, bucket } = storage(event);
	const isLeadAuthor = isAdministrator(person);
	const view = readView(event.url.searchParams.get('view'), isLeadAuthor);
	const filters = readFilters(event.url.searchParams);
	const [list, progress] = await Promise.all([reviewList(database, view, filters), readWatchProgress(bucket).catch((problem: unknown) => {
			// The page shows the list without the Worker's progress; the failure is reported.
			reportHere(problem, { code: 'radar.progress', place: '/workspace/watch' });
			return null;
		})]);
	const scans = await fileScans(database, list.items.map((item) => item.captureKey).filter((key): key is string => Boolean(key)));
	const state = watchState(progress, new Date());
	const label = (kind: string, value: string) => {
		if (kind === 'nation') return nationNameByIdentifier.get(value) ?? value;
		if (kind === 'watcher') return watcherNamed(value)?.title ?? value;
		return value;
	};
	return {
		view,
		views: viewsFor(isLeadAuthor).map((name) => ({ name, label: reviewViewLabels[name], count: list.counts[name] })),
		filters,
		choices: Object.fromEntries(Object.entries(list.choices).map(([kind, values]) => [kind, values.map((value) => ({ value, label: label(kind, value) }))])),
		total: list.total,
		waitingForModel: list.waitingForModel,
		items: list.items.map((item) => {
			const scan = item.captureKey ? scans.get(item.captureKey) ?? null : null;
			return {
				identifier: item.identifier,
				title: item.title,
				watcher: item.watcher,
				watcherTitle: watcherNamed(item.watcher)?.title ?? item.watcher,
				sourceIdentifier: item.sourceIdentifier,
				documentNumber: typeof item.facts.documentNumber === 'string' ? item.facts.documentNumber : null,
				kind: item.kind,
				publishedOn: item.publishedOn,
				foundAt: item.foundAt,
				link: item.link,
				feeds: item.feeds,
				nations: item.nations.map((identifier) => ({ identifier, name: nationNameByIdentifier.get(identifier) ?? identifier })),
				summary: item.summary,
				capture: item.captureKey ? { extension: item.captureKey.split('.').pop() ?? '', clean: scan?.status === 'clean' || scan?.status === 'released-by-hand', scanLabel: scanStatusWords(scan).label } : null,
				difference: item.difference,
				matchKind: item.matchKind,
				matchRecord: item.matchRecord,
				matchTitle: typeof item.facts.matchTitle === 'string' ? item.facts.matchTitle : null,
				proposed: item.proposed,
				triage: item.triage.map((step) => ({ step: step.step, by: step.by, reason: step.reason })),
				sensitivity: item.sensitivity,
				hosting: item.hosting,
				status: item.status,
				decidedAt: item.decidedAt,
				decisionNote: item.decisionNote
			};
		}),
		watch: {
			state: state.state,
			stateWords: watchStateWords[state.state],
			minutesSinceTick: state.minutesSinceTick,
			watchersOn: Object.values(progress?.watchers ?? {}).filter((watcher) => watcher.enabled).length,
			next: nextRun(progress),
			progressPage: `${watchWorkerAddress}/`
		},
		isLeadAuthor,
		collectionTitles
	};
};

export const actions: Actions = {
	decide: async (event) => {
		const person = requirePermission(event, 'review-watch');
		const { database } = storage(event);
		const form = await event.request.formData();
		const identifier = Number(formText(form, 'identifier', 20));
		const decision = formText(form, 'decision', 40) as Decision | null;
		if (!Number.isInteger(identifier) || !decision || !decisions.includes(decision)) return fail(400, { identifier, problem: 'Choose an item and what to do with it.' });
		const result = await decide(database, { identifier, decision, record: formText(form, 'record', 300), note: formText(form, 'note', 1000) }, { identifier: person.identifier, isLeadAuthor: isAdministrator(person) }, new Date());
		if ('problem' in result) return fail(400, { identifier, problem: result.problem });
		return { identifier, done: decision };
	}
};
