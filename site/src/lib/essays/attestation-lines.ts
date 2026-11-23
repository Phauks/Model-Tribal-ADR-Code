/**
 * The line under each section and subsection heading in the editor that says
 * who attested to it (attestations.ts): "Written by Trevor ✓ Nov. 21, 2026",
 * or "text changed since" when the section no longer matches what was
 * attested, and an Attest button. The lines are decorations, never part of
 * the essay's text.
 *
 * When someone was asked to review the section (review-requests.ts), a line
 * above says "In review with Ann and Ben, due Friday, November 27", with a
 * "Done reviewing" button for each person asked.
 *
 * The editor computes each section's SHA-256 after the text changes and
 * hands it here with the attestations (setAttestationLines), since hashing
 * in the browser does not answer at once.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { attestationRoleLabels, currentAttestations, essaySections, type Attestation } from './attestations.ts';
import { essayDate } from './dates.ts';
import { inReviewText, openRequestsOn, waitsOn, type ReviewRequest } from './review-requests.ts';

export interface AttestationLinesState {
	attestations: Attestation[];
	/** Each section's SHA-256 as the text stands, by heading id. */
	hashes: Record<string, string>;
	/** False until the attestations have loaded, so no line claims there are none. */
	loaded: boolean;
	/** Requests to review the essay or its sections. */
	requests: ReviewRequest[];
	/** The person using the editor, for their own "Done reviewing" button. */
	you: string | null;
}

export interface AttestationLineActions {
	attest: (slug: string) => void;
	finishReview: (request: string) => void;
}

const emptyState: AttestationLinesState = { attestations: [], hashes: {}, loaded: false, requests: [], you: null };

/** The "In review" lines for some open requests, each with a "Done reviewing" button for a person asked. */
export function reviewLines(requests: ReviewRequest[], you: string | null, onDone: (request: string) => void): HTMLElement[] {
	return requests.map((request) => {
		const item = document.createElement('div');
		item.className = 'essay-in-review';
		const text = document.createElement('span');
		const strong = document.createElement('strong');
		strong.textContent = 'In review';
		text.append(strong, inReviewText(request).replace(/^In review/, ''));
		if (request.message) text.title = request.message;
		item.append(text);
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

export const attestationLinesKey = new PluginKey<AttestationLinesState>('attestation-lines');

function line(section: { slug: string; title: string; level: number }, state: AttestationLinesState, actions: AttestationLineActions): () => HTMLElement {
	return () => {
		const outer = document.createElement('div');
		outer.className = 'essay-section-lines';
		outer.contentEditable = 'false';
		outer.append(...reviewLines(openRequestsOn(state.requests, section.slug), state.you, actions.finishReview));
		const holder = document.createElement('div');
		holder.className = 'essay-attestations';
		outer.append(holder);
		const shown = currentAttestations(state.attestations, section.slug);
		if (shown.length === 0) {
			const none = document.createElement('span');
			none.className = 'essay-attestation-none';
			none.textContent = `No one has attested to this ${section.level === 2 ? 'section' : 'subsection'} yet.`;
			holder.append(none);
		}
		for (const attestation of shown) {
			const changed = state.hashes[section.slug] !== undefined && state.hashes[section.slug] !== attestation.sectionSha256;
			const item = document.createElement('span');
			item.className = changed ? 'essay-attestation is-changed' : 'essay-attestation';
			const name = document.createElement('strong');
			name.textContent = attestation.personName;
			const when = document.createElement('span');
			when.className = 'essay-attestation-date';
			when.textContent = changed ? `${essayDate(attestation.createdAt)}, text changed since` : `✓ ${essayDate(attestation.createdAt)}`;
			if (attestation.note) item.title = attestation.note;
			item.append(`${attestationRoleLabels[attestation.role]} `, name, ' ', when);
			holder.append(item);
		}
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'button button-quiet essay-attest-button';
		button.textContent = 'Attest';
		button.setAttribute('aria-label', `Attest to "${section.title}"`);
		button.addEventListener('click', () => actions.attest(section.slug));
		holder.append(button);
		return outer;
	};
}

function attestationDecorations(state: EditorState, actions: AttestationLineActions): DecorationSet {
	const lines = attestationLinesKey.getState(state);
	if (!lines?.loaded) return DecorationSet.empty;
	const sections = essaySections(state.doc);
	if (sections.length === 0) return DecorationSet.empty;
	const ends: number[] = [];
	state.doc.forEach((node, offset) => ends.push(offset + node.nodeSize));
	const decorations = sections.map((section) => {
		const shown = currentAttestations(lines.attestations, section.slug).map(
			(attestation) => `${attestation.identifier}:${lines.hashes[section.slug] === attestation.sectionSha256}`
		);
		const reviews = openRequestsOn(lines.requests, section.slug).map(
			(request) => `${request.identifier}:${inReviewText(request)}:${waitsOn(request, lines.you)}`
		);
		return Decoration.widget(ends[section.index], line(section, lines, actions), {
			side: -1,
			key: `attest:${section.slug}:${section.level}:${section.title}:${shown.join(',')}:${reviews.join(',')}`,
			ignoreSelection: true,
			stopEvent: () => true
		});
	});
	return DecorationSet.create(state.doc, decorations);
}

/** Shows who attested to each section under its heading, and open review requests; the actions open the Attest dialog and finish a review. */
export function attestationLines(actions: AttestationLineActions): Plugin<AttestationLinesState> {
	return new Plugin<AttestationLinesState>({
		key: attestationLinesKey,
		state: {
			init: () => emptyState,
			apply: (transaction, value) => (transaction.getMeta(attestationLinesKey) as AttestationLinesState | undefined) ?? value
		},
		props: { decorations: (state) => attestationDecorations(state, actions) }
	});
}

/** Replaces the attestations or the hashes the lines are drawn from. */
export function setAttestationLines(view: EditorView, change: Partial<AttestationLinesState>): void {
	const current = attestationLinesKey.getState(view.state) ?? emptyState;
	view.dispatch(view.state.tr.setMeta(attestationLinesKey, { ...current, ...change }).setMeta('addToHistory', false));
}
