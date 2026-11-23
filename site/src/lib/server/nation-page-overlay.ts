/**
 * What a nation's own changes add to its page (decision record 0041,
 * "Stage 2"). Nation pages are prerendered, so the nation's changes cannot
 * be part of the build. Instead each page has empty places marked
 * data-nation-slot (src/routes/nations/[id]/+page.svelte), and this module
 * writes the HTML that goes in each. The Worker fills them before the page
 * leaves (tools/add-nation-page-changes.mjs), and the page fills them itself
 * after a move within the site (/nations/<id>/changes.json).
 *
 * Everything the nation typed is escaped here, links are https only, and
 * each addition says plainly that the nation wrote it, so a reader can tell
 * the nation's words from the facts the project cites.
 */
import {
	contactKindLabels,
	hideableSectionLabels,
	safeWebLink,
	statementSectionLabels,
	type HideableSection,
	type NationContact,
	type StatementSection
} from '../nation-page-changes.ts';
import { readableDate } from '../readable-date.ts';
import type { ChangeRow, LiveChanges } from './nation-page-changes.ts';

/** The empty places on a nation's page that changes can fill. */
export const pageSlots = ['top', 'courts', 'law', 'jurisdiction', 'glance', 'contacts'] as const;
export type PageSlot = (typeof pageSlots)[number];

export interface PageOverlay {
	/** Changes whenever what the page shows changes; part of the page's ETag. */
	stamp: string;
	slots: Partial<Record<PageSlot, string>>;
}

export function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/** Paragraphs from text typed in a box: a blank line starts a new paragraph, a single line break stays. */
export function paragraphs(text: string): string {
	return text
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll('\n', '<br>')}</p>`)
		.join('');
}

/** "the Navajo Nation", but not "the The …". */
function creditPhrase(credit: string): string {
	return /^the\s/i.test(credit) ? credit : `the ${credit}`;
}

function changeDate(change: ChangeRow): string {
	return readableDate((change.liveAt ?? change.publishedAt ?? change.writtenAt).slice(0, 10));
}

/** The line under each addition: who wrote it and when. Doubles as its citation. */
function byline(change: ChangeRow): string {
	return `<p class="nation-byline small">Written by ${escapeHtml(creditPhrase(change.credit))} · Updated ${changeDate(change)}</p>`;
}

/** Selectors of the parts of the page an editor can hide. */
const hiddenSelectors: Record<HideableSection, string> = {
	courts: 'details[data-section="courts-heading"]',
	law: 'details[data-section="law-heading"]',
	jurisdiction: 'details[data-section="jurisdiction-heading"]',
	contacts: 'details[data-section="contacts-heading"]',
	seal: '.nation-image',
	map: '.glance-map'
};

function contactValue(contact: NationContact): string {
	const value = escapeHtml(contact.value);
	switch (contact.kind) {
		case 'email':
			return `<a href="mailto:${encodeURI(contact.value)}">${value}</a>`;
		case 'phone':
			return `<a href="tel:${escapeHtml(contact.value.replace(/[^\d+]/g, ''))}">${value}</a>`;
		case 'website': {
			const link = safeWebLink(contact.value);
			return link ? `<a href="${escapeHtml(link)}" rel="noopener">${value}</a>` : value;
		}
		case 'address':
			return value.replaceAll('\n', '<br>');
	}
}

/** Who keeps the page, when people the nation chose keep it. */
export interface PageClaim {
	claimedSince: string;
}

/** The claimed line, in place of the build's "Unclaimed" line (data-build-status). */
function claimedLine(nationIdentifier: string, claim: PageClaim): string {
	const check =
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
	return `<style>[data-build-status]{display:none!important}</style><p class="nation-claim small" data-print-part="reviewStatus"><span class="visually-hidden">Who keeps this page:</span><span class="nation-claim-badge">${check}Claimed by the nation</span> <span class="muted">People the nation chose keep this page. The project confirmed them with the nation’s office on ${readableDate(claim.claimedSince.slice(0, 10))}. Problems you report go to them and to the project.</span> <a class="no-print" href="/changes?page=${encodeURIComponent(`/nations/${nationIdentifier}`)}">Changes to this page</a></p>`;
}

function slotsFor(nationIdentifier: string, live: LiveChanges, claim: PageClaim | undefined): Partial<Record<PageSlot, string>> {
	const slots: Partial<Record<PageSlot, string>> = {};
	const add = (slot: PageSlot, html: string) => {
		slots[slot] = (slots[slot] ?? '') + html;
	};

	if (claim) add('top', claimedLine(nationIdentifier, claim));

	const hidden = live.hidden?.content.sections ?? [];
	if (live.hidden && hidden.length > 0) {
		// Hidden at once by a style, since the prerendered page cannot change;
		// the project removes the part from the site's files when it follows up.
		add('top', `<style>${hidden.map((section) => hiddenSelectors[section]).join(',')}{display:none!important}</style>`);
		add(
			'top',
			`<p class="nation-hidden-note small">At the nation’s request, these parts of the page are hidden for now: ${hidden
				.map((section) => escapeHtml(hideableSectionLabels[section]))
				.join(', ')}.</p>`
		);
	}

	if (live.about && live.about.content.text) {
		add(
			'top',
			`<section class="nation-words" aria-labelledby="nation-words-heading"><h2 id="nation-words-heading">About</h2>${byline(live.about)}<div class="nation-words-text">${paragraphs(live.about.content.text)}</div></section>`
		);
	}

	const pictures = live.pictures?.content.pictures ?? [];
	if (live.pictures && pictures.length > 0) {
		const figures = pictures
			.map((picture) => {
				const caption = [picture.caption, picture.credit ? `Credit: ${picture.credit}` : null].filter(Boolean) as string[];
				return `<figure><img src="/nations/${encodeURIComponent(nationIdentifier)}/pictures/${encodeURIComponent(picture.identifier)}" alt="${escapeHtml(picture.alt)}" loading="lazy" decoding="async">${
					caption.length > 0 ? `<figcaption class="small">${caption.map(escapeHtml).join(' ')}</figcaption>` : ''
				}</figure>`;
			})
			.join('');
		add(
			'top',
			`<section class="nation-pictures" aria-labelledby="nation-pictures-heading"><h2 id="nation-pictures-heading">Pictures</h2>${byline(live.pictures)}<div class="nation-picture-grid">${figures}</div></section>`
		);
	}

	if (live.courts && live.courts.content.text) {
		add('courts', `<aside class="nation-statement" aria-label="From the nation">${byline(live.courts)}${paragraphs(live.courts.content.text)}</aside>`);
	}

	const statements = live.statements?.content.statements ?? {};
	const statementSlot: Record<StatementSection, PageSlot> = { recognition: 'glance', law: 'law', jurisdiction: 'jurisdiction' };
	for (const [section, text] of Object.entries(statements) as [StatementSection, string][]) {
		if (!text || !live.statements) continue;
		add(
			statementSlot[section],
			`<aside class="nation-statement" aria-label="The nation’s statement on ${escapeHtml(statementSectionLabels[section].replace(/ \(.*\)$/, ''))}"><p class="nation-statement-heading"><strong>The nation’s statement</strong></p>${byline(live.statements)}${paragraphs(text)}</aside>`
		);
	}

	const contacts = live.contacts?.content.contacts ?? [];
	if (live.contacts && contacts.length > 0) {
		const offices = new Map<string, NationContact[]>();
		for (const contact of contacts) offices.set(contact.office, [...(offices.get(contact.office) ?? []), contact]);
		const cards = [...offices.entries()]
			.map(
				([office, entries]) =>
					`<section class="contact-card"><h3>${escapeHtml(office)}</h3><dl>${entries
						.map((entry) => `<dt>${contactKindLabels[entry.kind]}</dt><dd>${contactValue(entry)}</dd>`)
						.join('')}</dl></section>`
			)
			.join('');
		add(
			'contacts',
			`<section class="nation-contacts" aria-labelledby="nation-contacts-heading"><h2 id="nation-contacts-heading">Contacts from the nation</h2>${byline(live.contacts)}${cards}</section>`
		);
	}

	return slots;
}

/** A short, stable fingerprint of which versions are live and whether the page is claimed. */
function stampOf(live: LiveChanges, claim: PageClaim | undefined): string {
	const text = [
		...(Object.values(live) as ChangeRow[]).map((change) => `${change.identifier}@${change.liveAt}`).sort(),
		claim ? `claimed@${claim.claimedSince}` : ''
	].join('|');
	let hash = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(36);
}

/** The overlay for a nation's page, or undefined for an unclaimed page with nothing the nation published live. */
export function pageOverlay(nationIdentifier: string, live: LiveChanges, claim?: PageClaim): PageOverlay | undefined {
	if (Object.keys(live).length === 0 && !claim) return undefined;
	return { stamp: stampOf(live, claim), slots: slotsFor(nationIdentifier, live, claim) };
}
