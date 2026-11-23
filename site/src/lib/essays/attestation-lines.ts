/**
 * The line under each section and subsection heading in the editor that says
 * who attested to it (attestations.ts): "Written by Trevor ✓ Nov. 21, 2026",
 * or "text changed since" when the section no longer matches what was
 * attested, and an Attest button. The lines are decorations, never part of
 * the essay's text.
 *
 * The editor computes each section's SHA-256 after the text changes and
 * hands it here with the attestations (setAttestationLines), since hashing
 * in the browser does not answer at once.
 */
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import { attestationRoleLabels, currentAttestations, essaySections, type Attestation } from './attestations.ts';
import { essayDate } from './dates.ts';

export interface AttestationLinesState {
	attestations: Attestation[];
	/** Each section's SHA-256 as the text stands, by heading id. */
	hashes: Record<string, string>;
	/** False until the attestations have loaded, so no line claims there are none. */
	loaded: boolean;
}

export const attestationLinesKey = new PluginKey<AttestationLinesState>('attestation-lines');

function line(section: { slug: string; title: string; level: number }, state: AttestationLinesState, onAttest: (slug: string) => void): () => HTMLElement {
	return () => {
		const holder = document.createElement('div');
		holder.className = 'essay-attestations';
		holder.contentEditable = 'false';
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
		button.addEventListener('click', () => onAttest(section.slug));
		holder.append(button);
		return holder;
	};
}

function attestationDecorations(state: EditorState, onAttest: (slug: string) => void): DecorationSet {
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
		return Decoration.widget(ends[section.index], line(section, lines, onAttest), {
			side: -1,
			key: `attest:${section.slug}:${section.level}:${section.title}:${shown.join(',')}`,
			ignoreSelection: true,
			stopEvent: () => true
		});
	});
	return DecorationSet.create(state.doc, decorations);
}

/** Shows who attested to each section under its heading; `onAttest` opens the Attest dialog for a section. */
export function attestationLines(onAttest: (slug: string) => void): Plugin<AttestationLinesState> {
	return new Plugin<AttestationLinesState>({
		key: attestationLinesKey,
		state: {
			init: () => ({ attestations: [], hashes: {}, loaded: false }),
			apply: (transaction, value) => (transaction.getMeta(attestationLinesKey) as AttestationLinesState | undefined) ?? value
		},
		props: { decorations: (state) => attestationDecorations(state, onAttest) }
	});
}

/** Replaces the attestations or the hashes the lines are drawn from. */
export function setAttestationLines(view: EditorView, change: Partial<AttestationLinesState>): void {
	const current = attestationLinesKey.getState(view.state) ?? { attestations: [], hashes: {}, loaded: false };
	view.dispatch(view.state.tr.setMeta(attestationLinesKey, { ...current, ...change }).setMeta('addToHistory', false));
}
