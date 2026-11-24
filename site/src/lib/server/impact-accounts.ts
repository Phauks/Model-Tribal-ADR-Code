/**
 * Accounts of how a law, treaty, court case or federal policy affected the
 * people who lived under it (Trevor, Nov. 24, 2026: "there is a very human
 * side to the law"). An account is a story record (content/stories/) with an
 * `account` label and an `affected_by` list; each entry names one law's
 * source record or one event, with the place in the telling that names it.
 *
 * The links run both ways and are many to many: a story's page lists
 * everything it is affected by, and each law's or case's page lists every
 * account that points to it, under "Accounts of its impact". A page with no
 * linked account shows no such section; nothing here guesses a link.
 */
import { accountTypeLabels, eventLabels, labelFor } from '../story-labels.ts';
import { isoDate, shownExcerpts, shownFullText, shownTellings, type StoryAffectedBy, type StoryRecord } from '../story-visibility.ts';
import { recordName, recordPageLink } from './law-names.ts';
import { creditText, partialDate, publishedStories } from './stories.ts';

/** A law, case or event an account is linked to, as a link where it has a page. */
export interface AffectedByView {
	name: string;
	/** A case name, set in italics. */
	italic?: boolean;
	link?: string;
	/** "Event" for a policy or event; otherwise the record's kind, such as "Treaty". */
	what: string;
	/** Where the account names it, such as "page 186, as “the Curtis law”". */
	where: string;
}

/** One account, as a law's or case's page lists it. */
export interface AccountEntry {
	id: string;
	title: string;
	link: string;
	/** "Firsthand", "Descendant’s account", "Period record" or "Published history". */
	type: string;
	/** Who gave it, with the nation: "D. W. C. Duncan, Cherokee Nation". */
	teller: string;
	/** In what form, where and when, and who recorded it. */
	detail: string;
	/** The account's own words that name this law, or its first quoted passage. */
	excerpt?: { text: string; locator: string };
	/** The other laws and events the same account is linked to. */
	also: AffectedByView[];
}

const kindNames: Record<string, string> = {
	'federal-statute': 'Federal statute',
	'federal-regulation': 'Federal regulation',
	'federal-register-notice': 'Federal Register notice',
	'executive-order': 'Executive order',
	'federal-case': 'Court case',
	'tribal-case': 'Court case',
	'state-case': 'Court case'
};

function today(): string {
	return isoDate(new Date());
}

/** One entry of a story's affected_by list as a link. */
export function affectedByView(entry: StoryAffectedBy): AffectedByView {
	const where = [entry.named_in.locator, entry.named_in.words ? `as “${entry.named_in.words}”` : ''].filter(Boolean).join(', ');
	if (entry.event) return { name: labelFor(eventLabels, entry.event), link: `/stories/events/${entry.event}`, what: 'Event', where };
	const named = recordName(entry.record!);
	return { name: named.name, italic: named.italic, link: recordPageLink(entry.record!), what: named.kind ? (kindNames[named.kind] ?? named.what) : named.what, where };
}

function sameTarget(entry: StoryAffectedBy, target: { record?: string; event?: string }): boolean {
	return target.record ? entry.record === target.record : entry.event === target.event;
}

/** The sentence of the shown full text, or the quoted passage, that names the law in the account's own words. */
function namingWords(record: StoryRecord, entry: StoryAffectedBy, date: string): { text: string; locator: string } | undefined {
	const words = entry.named_in.words?.toLocaleLowerCase('en-US');
	const quoted = shownExcerpts(record, date).filter((excerpt) => excerpt.quoted && excerpt.text);
	if (words) {
		const excerpt = quoted.find((candidate) => candidate.text!.toLocaleLowerCase('en-US').includes(words));
		if (excerpt) return { text: excerpt.text!, locator: excerpt.locator };
		const full = shownFullText(record, date);
		for (const paragraph of full?.paragraphs ?? []) {
			if (typeof paragraph !== 'string') continue;
			const sentence = paragraph.match(/[^.!?]+[.!?]+["”’)]*/g)?.find((candidate) => candidate.toLocaleLowerCase('en-US').includes(words));
			if (sentence) return { text: sentence.trim(), locator: entry.named_in.locator };
		}
	}
	const first = quoted[0];
	return first ? { text: first.text!, locator: first.locator } : undefined;
}

function accountDetail(record: StoryRecord): string {
	const account = record.account!;
	const form = account.form ? account.form.charAt(0).toLocaleUpperCase('en-US') + account.form.slice(1).replaceAll('-', ' ') : '';
	const when = partialDate(account.recorded);
	const by = account.recorded_by && account.recorded_by !== creditText(shownTellings(record, today())[0]?.teller) ? `recorded by the ${account.recorded_by.replace(/^the /i, '')}` : '';
	return [form, account.place, when].filter(Boolean).join(', ') + (by && account.form !== 'history' && account.form !== 'memoir' ? `. ${by.charAt(0).toLocaleUpperCase('en-US')}${by.slice(1)}` : '');
}

/**
 * Every shown account linked to a law, case or event, oldest recorded first,
 * so a reader meets them in the order they were given.
 */
export function accountsOf(target: { record?: string; event?: string }): AccountEntry[] {
	const date = today();
	const found: (AccountEntry & { sortDate: string })[] = [];
	for (const record of publishedStories()) {
		if (!record.account) continue;
		const entry = record.affected_by?.find((candidate) => sameTarget(candidate, target));
		if (!entry) continue;
		const telling = shownTellings(record, date).find((candidate) => candidate.id === entry.named_in.telling) ?? shownTellings(record, date)[0];
		found.push({
			id: record.id,
			title: record.title,
			link: `/stories/${record.id}`,
			type: labelFor(accountTypeLabels, record.account.type),
			teller: creditText(telling?.teller ? { ...telling.teller, role: undefined } : undefined) ?? telling?.published_by ?? record.account.recorded_by ?? '',
			detail: accountDetail(record),
			excerpt: namingWords(record, entry, date),
			also: (record.affected_by ?? []).filter((other) => !sameTarget(other, target)).map(affectedByView),
			sortDate: String(record.account.recorded ?? '9999')
		});
	}
	return found.sort((one, other) => one.sortDate.localeCompare(other.sortDate)).map(({ sortDate: _sortDate, ...entry }) => entry);
}
