/**
 * "Show the paragraph" under each quotation in an essay (Trevor, Nov. 23,
 * 2026; mockup in the project files, design/quote-context). The essay's HTML
 * is rendered on the server (render.ts), which names each quotation's source
 * on its attribution (data-quote-source, data-quote-pinpoint). This script
 * asks once which of those sources readers can open (/quote-context/sources)
 * and adds a button under those quotations only. The button opens the
 * paragraph the quoted words come from, highlighted, with buttons for the
 * paragraph before and after (/quote-context). Cases the court cites in the
 * paragraph link to the project's page for them, with a preview on hover
 * (src/lib/case-links.ts, LinkPreviews.svelte).
 *
 * Without scripts nothing is added, and print never shows the buttons or the
 * paragraphs.
 */
import { caseMentions, type CasePreviewList } from '../case-links.ts';
import type { ContextParagraph, QuoteContext } from '../quote-context.ts';

interface Answer {
	document: {
		path: string | null;
		captured: string | null;
		format: string | null;
		opinion: boolean;
	} | null;
	context: QuoteContext | null;
}

const iconPaths: Record<string, string> = {
	open: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
	close: '<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
	before: '<path d="M5 3h14"/><path d="m18 13-6-6-6 6"/><path d="M12 7v14"/>',
	after: '<path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/>'
};

const monthNames = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

function dateText(date: string | null): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
	return match ? `${monthNames[Number(match[2]) - 1]} ${Number(match[3])}, ${match[1]}` : '';
}

function button(kind: keyof typeof iconPaths, text: string, className: string): HTMLButtonElement {
	const element = document.createElement('button');
	element.type = 'button';
	element.className = `quote-context-button ${className}`;
	element.innerHTML = `<svg class="quote-context-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${iconPaths[kind]}</svg>`;
	const label = document.createElement('span');
	label.textContent = text;
	element.append(label);
	return element;
}

function setButton(element: HTMLButtonElement, kind: keyof typeof iconPaths, text: string): void {
	element.querySelector('svg')!.innerHTML = iconPaths[kind];
	element.querySelector('span')!.textContent = text;
}

let caseList: Promise<CasePreviewList | null> | undefined;

function loadCases(): Promise<CasePreviewList | null> {
	caseList ??= fetch('/cases/previews.json')
		.then((response) => (response.ok ? (response.json() as Promise<CasePreviewList>) : null))
		.catch(() => {
			caseList = undefined;
			return null;
		});
	return caseList;
}

/**
 * A link to a whole opinion or source opens in a new tab, so the essay
 * stays where the reader was (Trevor, Nov. 23, 2026), and says so to screen
 * readers. A link to a case's box in an essay stays in the same tab.
 */
function opensInNewTab(link: HTMLAnchorElement): HTMLAnchorElement {
	link.target = '_blank';
	link.rel = 'noopener';
	link.append(Object.assign(document.createElement('span'), { className: 'visually-hidden', textContent: ' (opens in a new tab)' }));
	return link;
}

/** A paragraph with its quoted words marked and the cases it cites linked. */
function paragraphElement(paragraph: ContextParagraph, cases: CasePreviewList | null, className: string): HTMLParagraphElement {
	const element = document.createElement('p');
	element.className = className + (paragraph.heading ? ' quote-context-heading' : '');
	const { text } = paragraph;
	const mentions = cases ? caseMentions(text, cases) : [];
	const links = new Map((cases?.cases ?? []).map((entry) => [entry.id, entry.link]));
	const cuts = new Set<number>([0, text.length]);
	for (const [start, end] of paragraph.highlights) cuts.add(start).add(end);
	for (const mention of mentions) cuts.add(mention.start).add(mention.end);
	const points = [...cuts].filter((point) => point >= 0 && point <= text.length).sort((a, b) => a - b);
	let link: HTMLAnchorElement | undefined;
	let linkIdentifier: string | undefined;
	const toOpinions: HTMLAnchorElement[] = [];
	for (let index = 0; index < points.length - 1; index += 1) {
		const [start, end] = [points[index], points[index + 1]];
		if (start === end) continue;
		const marked = paragraph.highlights.some(([from, to]) => from <= start && end <= to);
		const mention = mentions.find((candidate) => candidate.start <= start && end <= candidate.end);
		let piece: Node = document.createTextNode(text.slice(start, end));
		if (marked) {
			const mark = document.createElement('mark');
			mark.append(piece);
			piece = mark;
		}
		if (mention && links.get(mention.id)) {
			if (!link || linkIdentifier !== `${mention.id}@${mention.start}`) {
				link = document.createElement('a');
				link.className = 'case-link';
				link.href = links.get(mention.id)!;
				link.dataset.case = mention.id;
				linkIdentifier = `${mention.id}@${mention.start}`;
				// A case's page or box is part of the site and opens in the same tab; an opinion elsewhere opens in a new one.
				if (!/#case-|\/cases\//.test(new URL(link.href).hash + new URL(link.href).pathname)) toOpinions.push(link);
				element.append(link);
			}
			link.append(piece);
		} else {
			link = undefined;
			linkIdentifier = undefined;
			element.append(piece);
		}
	}
	toOpinions.forEach(opensInNewTab);
	return element;
}

let panels = 0;

/** Builds the panel for one quotation, the first time it is opened. */
async function fillPanel(panel: HTMLElement, source: string, quote: string, pinpoint: string | null): Promise<void> {
	panel.setAttribute('aria-busy', 'true');
	panel.replaceChildren(Object.assign(document.createElement('p'), { className: 'quote-context-status', textContent: 'Finding the paragraph…' }));
	const [answer, cases] = await Promise.all([
		fetch(`/quote-context?${new URLSearchParams({ source, quote })}`)
			.then((response) => (response.ok ? (response.json() as Promise<Answer>) : Promise.reject(new Error(String(response.status)))))
			.catch(() => null),
		loadCases()
	]);
	panel.removeAttribute('aria-busy');
	panel.replaceChildren();
	if (!answer) {
		panel.append(Object.assign(document.createElement('p'), { className: 'quote-context-status', textContent: 'The paragraph could not be loaded. Close this and try again.' }));
		panel.dataset.failed = 'true';
		return;
	}
	const opinion = Boolean(cases?.cases.some((entry) => entry.id === source)) || (answer.document?.opinion ?? false);
	const head = document.createElement('div');
	head.className = 'quote-context-head';
	const title = document.createElement('span');
	title.className = 'quote-context-title';
	title.textContent = opinion ? 'In the opinion' : 'In the source';
	head.append(title);
	if (pinpoint) head.append(Object.assign(document.createElement('span'), { textContent: pinpoint }));
	panel.append(head);

	const context = answer.context;
	if (!context) {
		panel.append(
			Object.assign(document.createElement('p'), {
				className: 'quote-context-status',
				textContent: `These words were not found in the copy of this ${opinion ? 'opinion' : 'source'} on this site.`
			})
		);
	} else {
		const body = document.createElement('div');
		body.className = 'quote-context-text';
		const before = context.before.map((paragraph) => paragraphElement(paragraph, cases, 'quote-context-near'));
		const after = context.after.map((paragraph) => paragraphElement(paragraph, cases, 'quote-context-near'));
		for (const element of [...before, ...after]) {
			element.hidden = true;
			element.tabIndex = -1;
		}
		const reveal = (elements: HTMLParagraphElement[], control: HTMLButtonElement) => {
			for (const element of elements) element.hidden = false;
			control.remove();
			elements.find((element) => !element.classList.contains('quote-context-heading'))?.focus();
		};
		if (before.length > 0) {
			const control = button('before', 'Show the paragraph before', 'quote-context-more');
			control.addEventListener('click', () => reveal(before, control));
			panel.append(control);
		}
		body.append(...before, ...context.paragraphs.map((paragraph) => paragraphElement(paragraph, cases, 'quote-context-quoted')), ...after);
		panel.append(body);
		if (after.length > 0) {
			const control = button('after', 'Show the paragraph after', 'quote-context-more');
			control.addEventListener('click', () => reveal(after, control));
			panel.append(control);
		}
		if (context.match === 'close') {
			panel.append(
				Object.assign(document.createElement('p'), {
					className: 'quote-context-note',
					textContent: 'A few words in this copy differ from the quotation above.'
				})
			);
		}
	}

	const foot = document.createElement('div');
	foot.className = 'quote-context-foot';
	const notes: string[] = [];
	const saved = dateText(answer.document?.captured ?? null);
	notes.push(`From the copy of the ${opinion ? 'opinion' : 'source'} on this site${saved ? `, saved ${saved}` : ''}.`);
	if (answer.document?.format === 'pdf') notes.push('The text is read from the PDF and can misread a scanned page; the page itself is the authority.');
	else notes.push('Footnote numbers are left out.');
	foot.append(Object.assign(document.createElement('span'), { textContent: notes.join(' ') }));
	if (answer.document?.path) {
		foot.append(
			opensInNewTab(
				Object.assign(document.createElement('a'), {
					href: answer.document.path,
					textContent: `Read the whole ${opinion ? 'opinion' : 'source'}`
				})
			)
		);
	}
	panel.append(foot);
}

/** The quoted words an attribution belongs to: the ">" passage before it, or the other paragraphs of its quote box. */
function quotedText(attribution: HTMLElement): string {
	const words = (element: Element) => {
		const copy = element.cloneNode(true) as Element;
		for (const marker of copy.querySelectorAll('sup, .citation-marks')) marker.remove();
		return copy.textContent ?? '';
	};
	const parent = attribution.parentElement;
	if (parent?.classList.contains('essay-quote')) {
		return [...parent.children].filter((child) => child !== attribution && child.tagName === 'P').map(words).join(' ');
	}
	const previous = attribution.previousElementSibling;
	return previous?.tagName === 'BLOCKQUOTE' ? words(previous) : '';
}

/** Adds the buttons to an essay's quotations. Returns a function that takes them away again. */
export async function addQuoteContext(root: HTMLElement): Promise<() => void> {
	const attributions = [...root.querySelectorAll<HTMLElement>('.essay-attribution[data-quote-source]')].filter(
		(element) => !element.closest('.quote-context-bar')
	);
	const added: (() => void)[] = [];
	const undo = () => added.splice(0).forEach((step) => step());
	if (attributions.length === 0) return undo;
	const keys = [...new Set(attributions.map((element) => element.dataset.quoteSource!))];
	const open = await fetch(`/quote-context/sources?${new URLSearchParams({ keys: keys.join(',') })}`)
		.then((response) => (response.ok ? (response.json() as Promise<{ sources: string[] }>) : { sources: [] }))
		.then((answer) => new Set(answer.sources))
		.catch(() => new Set<string>());
	for (const attribution of attributions) {
		const source = attribution.dataset.quoteSource!;
		if (!open.has(source) || !attribution.isConnected) continue;
		const quote = quotedText(attribution).replace(/\s+/g, ' ').trim();
		if (!quote) continue;
		panels += 1;
		const id = `quote-context-${panels}`;
		const bar = document.createElement('div');
		bar.className = 'quote-context-bar';
		const toggle = button('open', 'Show the paragraph', 'quote-context-toggle no-print');
		toggle.setAttribute('aria-expanded', 'false');
		toggle.setAttribute('aria-controls', id);
		const panel = document.createElement('div');
		panel.id = id;
		panel.className = 'quote-context no-print';
		panel.setAttribute('role', 'region');
		panel.setAttribute('aria-label', 'The quotation in its paragraph');
		panel.hidden = true;
		attribution.before(bar);
		bar.append(toggle, attribution);
		bar.after(panel);
		let filled = false;
		toggle.addEventListener('click', () => {
			const opening = panel.hidden;
			panel.hidden = !opening;
			toggle.setAttribute('aria-expanded', String(opening));
			setButton(toggle, opening ? 'close' : 'open', opening ? 'Hide the paragraph' : 'Show the paragraph');
			if (opening && (!filled || panel.dataset.failed)) {
				filled = true;
				delete panel.dataset.failed;
				void fillPanel(panel, source, quote, attribution.dataset.quotePinpoint ?? null);
			}
		});
		added.push(() => {
			bar.before(attribution);
			bar.remove();
			panel.remove();
		});
	}
	return undo;
}

/**
 * The same, as a Svelte action on the element that holds the essay's HTML,
 * passed that HTML so the buttons are added again when it changes (the
 * draft view, a newer save).
 */
export function quoteContext(element: HTMLElement, _html: string): { update(html: string): void; destroy(): void } {
	let undo: (() => void) | undefined;
	let run = 0;
	const start = () => {
		const mine = (run += 1);
		undo?.();
		undo = undefined;
		// After Svelte has put the new HTML in place.
		queueMicrotask(() => {
			void addQuoteContext(element).then((remove) => {
				if (mine === run) undo = remove;
				else remove();
			});
		});
	};
	start();
	return {
		update: start,
		destroy() {
			run += 1;
			undo?.();
		}
	};
}
