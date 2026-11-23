/**
 * Changes a nation's team makes to its own page on the website (decision
 * record 0041, "Stage 2"; site/COLLABORATION.md, "Nation teams").
 *
 * The rule is "who said it". What the nation says about itself goes live
 * when an editor publishes it: its own words, a note on its courts, its
 * statements beside government records, and its pictures. New contacts wait
 * three days unless a second editor approves them, so nobody can quietly
 * send a nation's mail somewhere else. Hiding a part of the page is always
 * immediate. Facts cited to government records are never edited by a nation;
 * the nation's statement is shown beside them.
 *
 * These rules are pure, so the server, the page overlay and the tests share
 * them.
 */
import { atLeastTeamLevel, type Granter, type PagePart } from './nation-teams.ts';

/** What a change is to. Each kind has one current version per nation. */
export const changeKinds = ['about', 'courts', 'statements', 'contacts', 'pictures', 'hidden'] as const;
export type ChangeKind = (typeof changeKinds)[number];

export const changeKindLabels: Record<ChangeKind, string> = {
	about: 'About',
	courts: 'Courts and dispute resolution',
	statements: 'Statements beside government records',
	contacts: 'Contacts',
	pictures: 'Pictures',
	hidden: 'Hidden parts of the page'
};

/** The part of the page a place on the team must cover to change each kind. Hiding needs none: any editor may hide. */
export const changeKindPart: Record<ChangeKind, PagePart | null> = {
	about: 'about',
	courts: 'courts-and-dispute-resolution',
	statements: 'statements',
	contacts: 'contacts',
	pictures: 'images',
	hidden: null
};

/** How long new contacts wait before they go live, unless a second editor approves them. */
export const contactHoldDays = 3;

/** Sections of the page that a nation's statement can stand beside. */
export const statementSections = ['recognition', 'law', 'jurisdiction'] as const;
export type StatementSection = (typeof statementSections)[number];

export const statementSectionLabels: Record<StatementSection, string> = {
	recognition: 'Recognition (in “At a glance”)',
	law: 'Laws and agreements',
	jurisdiction: 'Jurisdiction'
};

/** Sections of the page an editor can hide at once. */
export const hideableSections = ['courts', 'law', 'jurisdiction', 'contacts', 'seal', 'map'] as const;
export type HideableSection = (typeof hideableSections)[number];

export const hideableSectionLabels: Record<HideableSection, string> = {
	courts: 'Courts and dispute resolution',
	law: 'Laws and agreements',
	jurisdiction: 'Jurisdiction',
	contacts: 'Contacts',
	seal: 'The seal or emblem',
	map: 'The map'
};

export const contactKinds = ['email', 'phone', 'website', 'address'] as const;
export type ContactKind = (typeof contactKinds)[number];

export const contactKindLabels: Record<ContactKind, string> = {
	email: 'Email',
	phone: 'Phone',
	website: 'Website',
	address: 'Mailing address'
};

export interface NationContact {
	office: string;
	kind: ContactKind;
	value: string;
}

export interface NationPicture {
	identifier: string;
	/** What the picture shows, for people who cannot see it. Required. */
	alt: string;
	caption: string | null;
	credit: string | null;
	type: string;
}

/** What each kind of change holds. */
export interface ChangeContents {
	about: { text: string };
	courts: { text: string };
	statements: { statements: Partial<Record<StatementSection, string>> };
	contacts: { contacts: NationContact[] };
	pictures: { pictures: NationPicture[] };
	hidden: { sections: HideableSection[] };
}

export type ChangeContent = ChangeContents[ChangeKind];

/** The longest text in one change, and the most entries of each list. */
export const longestText = 8000;
export const mostContacts = 12;
export const mostPictures = 12;
export const largestPicture = 5 * 1024 * 1024;
export const pictureTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Pages start with no pictures: the project does not choose pictures for nations (Trevor, Nov. 23, 2026). */
export function emptyContent<K extends ChangeKind>(kind: K): ChangeContents[K] {
	const empty: ChangeContents = {
		about: { text: '' },
		courts: { text: '' },
		statements: { statements: {} },
		contacts: { contacts: [] },
		pictures: { pictures: [] },
		hidden: { sections: [] }
	};
	return empty[kind];
}

/** Who may do what with changes. */
export type ChangeAction = 'draft' | 'publish';

/**
 * Why a person may not draft or publish a change of this kind, or undefined
 * when they may. Drafters write drafts; editors and stewards publish. A place
 * limited to some parts of the page covers only those parts, except hiding,
 * which any editor may do because it is the safety lever.
 */
export function changeProblem(granter: Granter, kind: ChangeKind, action: ChangeAction): string | undefined {
	if (granter.isAdministrator) return undefined;
	if (!granter.level) return 'Only people on this nation’s team can change its page.';
	const needed = action === 'publish' || kind === 'hidden' ? 'editor' : 'drafter';
	if (!atLeastTeamLevel(granter.level, needed)) {
		return action === 'publish' || kind === 'hidden'
			? 'Only an editor or steward for this nation can publish or hide.'
			: 'Only a drafter, editor or steward for this nation can write changes.';
	}
	const part = changeKindPart[kind];
	if (part && granter.parts && !granter.parts.includes(part)) {
		return 'Your place on the team does not cover this part of the page.';
	}
	return undefined;
}

/** When a change published now goes live: contacts wait, everything else is at once. */
export function liveAt(kind: ChangeKind, time: Date = new Date()): string {
	if (kind !== 'contacts') return time.toISOString();
	return new Date(time.getTime() + contactHoldDays * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Why a person may not approve a waiting contact change early, or undefined
 * when they may: a second editor or steward for the nation, or the lead author,
 * never the person who wrote or published it.
 */
export function approvalProblem(
	granter: Granter & { personIdentifier: string },
	change: { writtenBy: string; publishedBy: string | null }
): string | undefined {
	if (granter.personIdentifier === change.writtenBy || granter.personIdentifier === change.publishedBy) {
		return 'A second editor approves the change, not the person who made it.';
	}
	if (granter.isAdministrator) return undefined;
	if (!granter.level || !atLeastTeamLevel(granter.level, 'editor')) {
		return 'Only another editor or steward for this nation can approve it early.';
	}
	if (granter.parts && !granter.parts.includes('contacts')) {
		return 'Your place on the team does not cover contacts.';
	}
	return undefined;
}

function clean(value: unknown, maximum: number): string {
	return typeof value === 'string' ? value.normalize('NFC').replace(/\r\n?/g, '\n').trim().slice(0, maximum) : '';
}

/** A link a reader can follow: https only, so no script or local addresses reach the page. */
export function safeWebLink(value: string): string | undefined {
	try {
		const url = new URL(value);
		if (url.protocol !== 'https:' || url.username || url.password) return undefined;
		return url.href;
	} catch {
		return undefined;
	}
}

const emailPattern = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/;
const phonePattern = /^[+()\d .-]{7,30}(?: ?(?:ext\.?|x) ?\d{1,6})?$/i;

/** Why a contact cannot be shown, or undefined when it can. */
export function contactProblem(contact: NationContact): string | undefined {
	if (!contact.office) return 'Name the office for each contact.';
	if (!contact.value) return 'Give a value for each contact.';
	if (contact.kind === 'email' && !emailPattern.test(contact.value)) return `“${contact.value}” is not an email address.`;
	if (contact.kind === 'phone' && !phonePattern.test(contact.value)) return `“${contact.value}” is not a phone number.`;
	if (contact.kind === 'website' && !safeWebLink(contact.value)) return `“${contact.value}” must be a full address starting with https://.`;
	return undefined;
}

/**
 * Reads a change's content from what a form or the database gave, keeping
 * only known fields with clean values. Returns the content and any problem.
 */
export function readContent<K extends ChangeKind>(kind: K, raw: unknown): { content: ChangeContents[K]; problem?: string } {
	const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
	let content: ChangeContent;
	let problem: string | undefined;
	switch (kind) {
		case 'about':
		case 'courts':
			content = { text: clean(value.text, longestText) };
			break;
		case 'statements': {
			const given = (typeof value.statements === 'object' && value.statements !== null ? value.statements : {}) as Record<string, unknown>;
			const statements: Partial<Record<StatementSection, string>> = {};
			for (const section of statementSections) {
				const text = clean(given[section], longestText);
				if (text) statements[section] = text;
			}
			content = { statements };
			break;
		}
		case 'contacts': {
			const list = Array.isArray(value.contacts) ? value.contacts : [];
			const contacts: NationContact[] = [];
			for (const entry of list.slice(0, mostContacts)) {
				const item = (entry ?? {}) as Record<string, unknown>;
				const contact = {
					office: clean(item.office, 200),
					kind: (contactKinds as readonly string[]).includes(item.kind as string) ? (item.kind as ContactKind) : 'email',
					value: clean(item.value, 500)
				};
				if (!contact.office && !contact.value) continue;
				problem ??= contactProblem(contact);
				contacts.push(contact);
			}
			content = { contacts };
			break;
		}
		case 'pictures': {
			const list = Array.isArray(value.pictures) ? value.pictures : [];
			const pictures: NationPicture[] = [];
			for (const entry of list.slice(0, mostPictures)) {
				const item = (entry ?? {}) as Record<string, unknown>;
				const identifier = clean(item.identifier, 40);
				const type = clean(item.type, 20);
				if (!/^[a-z0-9-]{8,40}$/.test(identifier) || !(pictureTypes as readonly string[]).includes(type)) continue;
				const alt = clean(item.alt, 500);
				if (!alt) problem ??= 'Describe each picture for people who cannot see it.';
				pictures.push({ identifier, alt, caption: clean(item.caption, 500) || null, credit: clean(item.credit, 200) || null, type });
			}
			content = { pictures };
			break;
		}
		case 'hidden': {
			const list = Array.isArray(value.sections) ? value.sections : [];
			content = { sections: hideableSections.filter((section) => list.includes(section)) };
			break;
		}
		default:
			throw new Error(`Unknown change kind ${String(kind)}`);
	}
	return { content: content as ChangeContents[K], problem };
}

/** Whether a change shows nothing, such as an About with no text. */
export function isEmptyContent(kind: ChangeKind, content: ChangeContent): boolean {
	switch (kind) {
		case 'about':
		case 'courts':
			return !(content as ChangeContents['about']).text;
		case 'statements':
			return Object.keys((content as ChangeContents['statements']).statements).length === 0;
		case 'contacts':
			return (content as ChangeContents['contacts']).contacts.length === 0;
		case 'pictures':
			return (content as ChangeContents['pictures']).pictures.length === 0;
		case 'hidden':
			return (content as ChangeContents['hidden']).sections.length === 0;
	}
}

/** One line saying what a change is, for the history and the activity log. */
export function describeChange(kind: ChangeKind, content: ChangeContent): string {
	if (isEmptyContent(kind, content)) {
		return kind === 'hidden' ? 'Nothing hidden' : `${changeKindLabels[kind]}: removed`;
	}
	switch (kind) {
		case 'about':
		case 'courts': {
			const text = (content as ChangeContents['about']).text;
			return `${changeKindLabels[kind]}: ${text.length > 80 ? `${text.slice(0, 77)}…` : text}`;
		}
		case 'statements':
			return `Statements beside ${Object.keys((content as ChangeContents['statements']).statements)
				.map((section) => statementSectionLabels[section as StatementSection].replace(/ \(.*\)$/, ''))
				.join(', ')}`;
		case 'contacts': {
			const count = (content as ChangeContents['contacts']).contacts.length;
			return `Contacts: ${count} ${count === 1 ? 'entry' : 'entries'}`;
		}
		case 'pictures': {
			const count = (content as ChangeContents['pictures']).pictures.length;
			return `Pictures: ${count}`;
		}
		case 'hidden':
			return `Hidden: ${(content as ChangeContents['hidden']).sections.map((section) => hideableSectionLabels[section]).join(', ')}`;
	}
}

/** The activity log's target for a nation's page. */
export function pageLogTarget(nationIdentifier: string): string {
	return `nation-page/${nationIdentifier}`;
}

/** Where a nation's picture is kept in the private bucket. */
export function pictureKey(nationIdentifier: string, pictureIdentifier: string): string {
	return `nation-pages/${nationIdentifier}/pictures/${pictureIdentifier}`;
}
