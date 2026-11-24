/**
 * The lines under each section and subsection heading in the editor, as in
 * the approved credits mockup (essay-editor/screenshots/attest-proposal-mockup.png,
 * chosen by the lead author on Nov. 24, 2026): who is reviewing the section,
 * then who wrote, edited, researched and reviewed it, and a Credits button
 * that opens the details (EssayCreditsPopover.svelte). The lines are
 * decorations, never part of the essay's text.
 *
 * When someone was asked to review the section (review-requests.ts), a line
 * says "In review with Ann and Ben, due Friday, November 27", with a "Done
 * reviewing" button for each person asked.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { creditLine, creditRoleLabels, finishedReviewers, type EssayCredits } from './credits.ts';
import { essaySections } from './sections.ts';
import { personColor, personInitials } from './person-look.ts';
import { inReviewText, openRequestsOn, waitsOn, type ReviewRequest } from './review-requests.ts';

const svgNamespace = 'http://www.w3.org/2000/svg';

/** A Lucide icon from its shapes. */
function icon(shapes: readonly (readonly [string, Record<string, string>])[], size = 16): SVGSVGElement {
	const svg = document.createElementNS(svgNamespace, 'svg');
	for (const [name, value] of Object.entries({ width: String(size), height: String(size), viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(name, value);
	for (const [tag, attributes] of shapes) {
		const element = document.createElementNS(svgNamespace, tag);
		for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
		svg.append(element);
	}
	return svg;
}

/** Lucide's inbox icon, as in the In review band of essay-editor-mockups/4 and v2-1. */
function inboxIcon(): SVGSVGElement {
	return icon([['polyline', { points: '22 12 16 12 14 15 10 15 8 12 2 12' }], ['path', { d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z' }]]);
}

/** Lucide's users icon, on the Credits button. */
function usersIcon(): SVGSVGElement {
	return icon([['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }], ['circle', { cx: '9', cy: '7', r: '4' }], ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }], ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }]], 15);
}

/** A person's initials in their color. */
export function avatar(name: string, className = 'essay-review-avatar'): HTMLElement {
	const element = document.createElement('span');
	element.className = className;
	element.style.background = personColor(name);
	element.setAttribute('aria-hidden', 'true');
	element.textContent = personInitials(name);
	return element;
}

/** Each person still asked, as their initials in their color. */
function reviewerAvatars(request: ReviewRequest): HTMLElement {
	const holder = document.createElement('span');
	holder.className = 'essay-review-people';
	for (const reviewer of request.reviewers.filter((candidate) => candidate.doneAt === null)) {
		const initials = avatar(reviewer.personName);
		initials.removeAttribute('aria-hidden');
		initials.title = reviewer.personName;
		holder.append(initials);
	}
	return holder;
}

export interface CreditLinesState {
	/** The credits from the server; null until they load, so no line claims there are none. */
	credits: EssayCredits | null;
	/** Requests to review the essay or its sections. */
	requests: ReviewRequest[];
	/** The person using the editor, for their own "Done reviewing" button. */
	you: string | null;
}

export interface CreditLineActions {
	/** Opens the Credits popover for a section, by its button. */
	openCredits: (section: { slug: string; title: string; level: 2 | 3 }, button: HTMLElement) => void;
	finishReview: (request: string) => void;
}

const emptyState: CreditLinesState = { credits: null, requests: [], you: null };

/** The "In review" lines for some open requests, each with a "Done reviewing" button for a person asked. */
export function reviewLines(requests: ReviewRequest[], you: string | null, onDone: (request: string) => void): HTMLElement[] {
	return requests.map((request) => {
		const item = document.createElement('div');
		item.className = 'essay-in-review';
		const text = document.createElement('span');
		const strong = document.createElement('strong');
		strong.textContent = 'In review';
		const rest = document.createElement('span');
		rest.className = 'essay-review-who';
		rest.textContent = inReviewText(request).replace(/^In review/, '');
		text.append(strong, rest);
		if (request.message) text.title = request.message;
		item.append(inboxIcon(), text, reviewerAvatars(request));
		if (waitsOn(request, you)) {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'button button-quiet essay-review-done';
			button.textContent = 'Done reviewing';
			button.addEventListener('click', () => onDone(request.identifier));
			item.append(button);
		}
		return item;
	});
}

/** A section's credit line, from the history, the finished reviews and the credits added by hand. */
export function sectionLine(state: CreditLinesState, slug: string) {
	const credits = state.credits;
	return creditLine(
		credits?.sections.find((section) => section.slug === slug),
		(credits?.hand ?? []).filter((credit) => credit.sectionSlug === slug),
		finishedReviewers(state.requests, slug)
	);
}

export const creditLinesKey = new PluginKey<CreditLinesState>('credit-lines');

function line(section: { slug: string; title: string; level: 2 | 3 }, state: CreditLinesState, actions: CreditLineActions): () => HTMLElement {
	return () => {
		const outer = document.createElement('div');
		outer.className = 'essay-section-lines';
		outer.contentEditable = 'false';
		outer.append(...reviewLines(openRequestsOn(state.requests, section.slug), state.you, actions.finishReview));
		if (!state.credits) return outer;
		const holder = document.createElement('div');
		holder.className = 'essay-credits';
		outer.append(holder);
		for (const credit of sectionLine(state, section.slug)) {
			for (const person of credit.people) {
				const item = document.createElement('span');
				item.className = 'essay-credit';
				const name = document.createElement('strong');
				name.textContent = person.name;
				item.append(`${creditRoleLabels[credit.role]} `, avatar(person.name), name);
				holder.append(item);
			}
		}
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'button button-quiet essay-credits-button';
		button.setAttribute('aria-haspopup', 'dialog');
		button.setAttribute('aria-label', `Credits for "${section.title}"`);
		button.append(usersIcon(), 'Credits');
		button.addEventListener('click', () => actions.openCredits(section, button));
		holder.append(button);
		return outer;
	};
}

function creditDecorations(state: EditorState, actions: CreditLineActions): DecorationSet {
	const lines = creditLinesKey.getState(state);
	if (!lines) return DecorationSet.empty;
	const sections = essaySections(state.doc);
	if (sections.length === 0) return DecorationSet.empty;
	const ends: number[] = [];
	state.doc.forEach((node, offset) => ends.push(offset + node.nodeSize));
	return DecorationSet.create(
		state.doc,
		sections.map((section) => {
			const credits = lines.credits ? sectionLine(lines, section.slug).map((credit) => `${credit.role}=${credit.people.map((person) => person.name).join('+')}`) : ['loading'];
			const reviews = openRequestsOn(lines.requests, section.slug).map(
				(request) => `${request.identifier}:${inReviewText(request)}:${waitsOn(request, lines.you)}`
			);
			return Decoration.widget(ends[section.index], line(section, lines, actions), {
				side: -1,
				key: `credits:${section.slug}:${section.level}:${section.title}:${credits.join(',')}:${reviews.join(',')}`,
				ignoreSelection: true,
				stopEvent: () => true
			});
		})
	);
}

/** Shows who is reviewing and who is credited under each heading; the actions open the Credits popover and finish a review. */
export function creditLines(actions: CreditLineActions): Plugin<CreditLinesState> {
	return new Plugin<CreditLinesState>({
		key: creditLinesKey,
		state: {
			init: () => emptyState,
			apply: (transaction, value) => (transaction.getMeta(creditLinesKey) as CreditLinesState | undefined) ?? value
		},
		props: { decorations: (state) => creditDecorations(state, actions) }
	});
}

/** Replaces the credits or the review requests the lines are drawn from. */
export function setCreditLines(view: EditorView, change: Partial<CreditLinesState>): void {
	const current = creditLinesKey.getState(view.state) ?? emptyState;
	view.dispatch(view.state.tr.setMeta(creditLinesKey, { ...current, ...change }).setMeta('addToHistory', false));
}
