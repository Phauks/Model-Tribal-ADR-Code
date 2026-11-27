/**
 * What each President's page lists beyond the Justices they appointed
 * (Trevor, Nov. 27, 2026: "U.S. President pages should be treated like a
 * nation page, and have left nav and different sections. we should show
 * executive orders and other things they signed on their pages as well"):
 *
 * - the executive orders, proclamations and other presidential documents on
 *   this site that the President signed (law-facts.ts, orderPresident);
 * - the treaties the President proclaimed, by the proclamation date in
 *   Kappler's header (content/law/treaty-proclamations.yaml, written by
 *   scripts/law/treaty_proclamations.py). A ratified treaty with no
 *   proclamation date on file is left off every President's page rather than
 *   given to the President in office the day it was signed;
 * - the Acts of Congress on this site that became law during the term, by
 *   the date each record gives;
 * - the Supreme Court cases on this site decided during the term. Andrew
 *   Johnson appointed no Justice, so the old page, which counted only the
 *   cases heard by a President's appointees, gave him none, though six cases
 *   on this site were decided while he was President.
 *
 * Who was in office on a day comes from src/lib/president-terms.ts. Runs at
 * build time only.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { presidentOn, presidentTerms } from '../president-terms.ts';
import { readableDate } from '../readable-date.ts';
import { casePreviewList } from './case-previews.ts';
import { repositoryRoot, sources, type SourceRecord } from './content.ts';
import { isoOf, orderPresident } from './law-facts.ts';
import { recordName, recordPageLink } from './law-records.ts';
import { courtPath } from './supreme-courts.ts';

/** A document on a President's page: an order, a treaty or an Act. */
export interface PresidentDocument {
	key: string;
	title: string;
	link?: string;
	/** The day it was signed, proclaimed or became law, YYYY-MM-DD. */
	date: string;
	dateText: string;
	/** "Executive order", "Proclamation", "Memorandum". */
	kind?: string;
	citation?: string;
	/** A treaty's signing, when the date above is its proclamation. */
	signed?: string;
	signedText?: string;
}

/** A Supreme Court case decided during the term. */
export interface TermCase {
	key: string;
	name: string;
	citation: string;
	link?: string;
	decided: string;
	decidedText: string;
	court: string;
	courtLink?: string;
	vote?: string;
}

export interface PresidentDocuments {
	orders: PresidentDocument[];
	treaties: PresidentDocument[];
	acts: PresidentDocument[];
	cases: TermCase[];
}

interface TreatyDates {
	source: string;
	treaties: { key: string; signed?: string; citation?: string; ratified?: string; proclaimed: string }[];
}

let treatyDatesCache: TreatyDates | undefined;

/** content/law/treaty-proclamations.yaml. */
export function treatyDates(): TreatyDates {
	treatyDatesCache ??= parse(readFileSync(path.join(repositoryRoot, 'content/law/treaty-proclamations.yaml'), 'utf8')) as TreatyDates;
	return treatyDatesCache;
}

/** A full date only: a year or a month names no one President. */
function fullDate(record: SourceRecord): string | undefined {
	const date = isoOf(record.citation.issued?.['date-parts']?.[0]);
	return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

/** The Statutes at Large or Federal Register citation, as the record gives it. */
function citationOf(record: SourceRecord): string | undefined {
	const citation = record.citation as SourceRecord['citation'] & { 'container-title'?: string; volume?: string; page?: string; number?: string };
	if (citation.volume && citation.page && /Statutes at Large/.test(citation['container-title'] ?? '')) return `${citation.volume} Stat. ${citation.page}`;
	if (citation.volume && citation.page && /Federal Register/.test(citation['container-title'] ?? '')) return `${citation.volume} Fed. Reg. ${citation.page}`;
	return undefined;
}

function byDate(first: { date: string; key: string }, second: { date: string; key: string }): number {
	return first.date.localeCompare(second.date) || first.key.localeCompare(second.key);
}

let everyPresident: Map<string, PresidentDocuments> | undefined;

/** Every President's documents and cases, worked out once per build. */
function allDocuments(): Map<string, PresidentDocuments> {
	if (everyPresident) return everyPresident;
	const found = new Map<string, PresidentDocuments>(presidentTerms.map((term) => [term.key, { orders: [], treaties: [], acts: [], cases: [] }]));
	const previews = new Map(casePreviewList().cases.map((preview) => [preview.id, preview]));
	const proclaimed = new Map(treatyDates().treaties.map((entry) => [entry.key, entry]));

	for (const record of sources().values()) {
		const genre = (record.citation as { genre?: string }).genre;
		if (record.kind === 'executive-order') {
			const date = fullDate(record);
			const president = date ? orderPresident(record) : undefined;
			if (!date || !president) continue;
			found.get(president.key)?.orders.push({
				key: record.key,
				title: record.citation.title ?? record.key,
				link: recordPageLink(record.key),
				date,
				dateText: readableDate(date),
				kind: genre ?? 'Executive order',
				citation: citationOf(record)
			});
		} else if (record.kind === 'federal-statute') {
			const date = fullDate(record);
			const president = presidentOn(date);
			if (!date || !president) continue;
			found.get(president.key)?.acts.push({
				key: record.key,
				title: recordName(record.key).name,
				link: recordPageLink(record.key),
				date,
				dateText: readableDate(date),
				citation: (record.citation as { number?: string }).number ?? citationOf(record)
			});
		} else if ((record as { supreme_court?: unknown }).supreme_court) {
			const bench = (record as unknown as { supreme_court: { court: string; vote?: { majority?: number | null; minority?: number | null } } }).supreme_court;
			const date = fullDate(record);
			const president = presidentOn(date);
			if (!date || !president) continue;
			const preview = previews.get(record.key);
			const { majority, minority } = bench.vote ?? {};
			found.get(president.key)?.cases.push({
				key: record.key,
				name: record.citation.title ?? record.key,
				citation: preview?.citation ?? [(record.citation as { volume?: string }).volume, 'U.S.', (record.citation as { page?: string }).page].filter(Boolean).join(' '),
				link: preview?.link,
				decided: date,
				decidedText: readableDate(date),
				court: bench.court,
				courtLink: courtPath(bench.court) ?? undefined,
				vote: Number.isInteger(majority) && Number.isInteger(minority) ? `${majority}–${minority}` : undefined
			});
		}
	}

	for (const entry of proclaimed.values()) {
		const record = sources().get(entry.key);
		const president = presidentOn(entry.proclaimed);
		if (!record || !president) continue;
		found.get(president.key)?.treaties.push({
			key: record.key,
			// "Treaty with the Ute, 1868" and "…, 1868 (Fort Laramie Treaty)" without the year, which the dates beside it give.
			title: recordName(record.key).name.replace(/ \(\d{4}\)$/, '').replace(/, \d{4}(?= \(|$)/, ''),
			link: recordPageLink(record.key),
			date: entry.proclaimed,
			dateText: readableDate(entry.proclaimed),
			citation: entry.citation ?? /(\d+ Stat\. \d+)/.exec(record.citation.title ?? '')?.[1],
			signed: entry.signed,
			signedText: entry.signed ? readableDate(entry.signed) : undefined
		});
	}

	for (const lists of found.values()) {
		lists.orders.sort(byDate);
		lists.treaties.sort(byDate);
		lists.acts.sort(byDate);
		lists.cases.sort((first, second) => first.decided.localeCompare(second.decided) || first.key.localeCompare(second.key));
	}
	everyPresident = found;
	return found;
}

/** One President's documents and cases; empty lists for a key with no term. */
export function presidentDocuments(key: string): PresidentDocuments {
	return allDocuments().get(key) ?? { orders: [], treaties: [], acts: [], cases: [] };
}

/** Each run of days in office: [from, to), with `to` the next President's first day, or none for the President serving now. */
export function termsOf(key: string): { from: string; to?: string; before?: string; after?: string }[] {
	const runs: { from: string; to?: string; before?: string; after?: string }[] = [];
	presidentTerms.forEach((term, index) => {
		if (term.key !== key) return;
		runs.push({ from: term.from, to: presidentTerms[index + 1]?.from, before: presidentTerms[index - 1]?.key, after: presidentTerms[index + 1]?.key });
	});
	return runs;
}
