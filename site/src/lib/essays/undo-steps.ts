/**
 * The undo history beside Redo (essay-editor-mockups/v2-2: "Undo history:
 * step back to any point in your own edits"). Each step a person takes is
 * named from the change it made, such as "Typed in Text 12" or "Added a
 * case", so they can click it to undo back to it.
 */
import { AddMarkStep, RemoveMarkStep, ReplaceAroundStep, ReplaceStep, type Step } from 'prosemirror-transform';
import type { Node as EditorNode, Slice } from 'prosemirror-model';
import type { Transaction } from 'prosemirror-state';
import { componentLabel, components } from './components.ts';

export interface UndoStep {
	label: string;
	/** When the step was last added to, in milliseconds. */
	at: number;
	/** How many undo steps there were once it was taken. */
	depth: number;
}

const markNames: Record<string, string> = {
	strong: 'bold',
	em: 'italic',
	underline: 'underlined',
	code: 'code',
	link: 'a link'
};

/** The component around a position, such as "Text 12". */
function componentAt(doc: EditorNode, position: number): string {
	const found = components(doc).find((component) => position >= component.from && position <= component.to);
	return found ? `${found.label} ${found.number}` : 'the text';
}

/** The kind of the first block a slice adds, such as "case", or null when it adds only words. */
function addedBlock(slice: Slice): string | null {
	let found: string | null = null;
	slice.content.forEach((node) => {
		if (!found && node.isBlock && node.type.name !== 'paragraph') found = componentLabel(node).toLowerCase();
	});
	return found;
}

function describeStep(step: Step, doc: EditorNode): string {
	if (step instanceof AddMarkStep || step instanceof RemoveMarkStep) {
		const name = markNames[step.mark.type.name] ?? step.mark.type.name;
		const where = componentAt(doc, step.from);
		if (step.mark.type.name === 'link') return step instanceof AddMarkStep ? `Added a link in ${where}` : `Took out a link in ${where}`;
		return step instanceof AddMarkStep ? `Made words ${name} in ${where}` : `Made words not ${name} in ${where}`;
	}
	if (step instanceof ReplaceAroundStep) return `Changed the style of ${componentAt(doc, step.from)}`;
	if (step instanceof ReplaceStep) {
		const where = componentAt(doc, step.from);
		const block = addedBlock(step.slice);
		if (block) return `Added ${/^[aeiou]/.test(block) ? 'an' : 'a'} ${block}`;
		if (step.slice.size === 0) return `Deleted words in ${where}`;
		if (step.from === step.to) return `Typed in ${where}`;
		return `Changed words in ${where}`;
	}
	return 'Changed the text';
}

/** A name for the change a transaction made, from its first step. */
export function describeChange(transaction: Transaction): string {
	const step = transaction.steps[0];
	return step ? describeStep(step, transaction.docs[0] ?? transaction.doc) : 'Changed the text';
}

/**
 * The steps list after a transaction: a new step when the undo history grew,
 * the newest one renewed when the change joined it, and steps undone taken
 * off.
 */
export function nextSteps(steps: UndoStep[], transaction: Transaction, depthBefore: number, depthAfter: number, now = Date.now()): UndoStep[] {
	let kept = steps.filter((step) => step.depth <= depthAfter);
	if (!transaction.docChanged || depthAfter === 0) return kept;
	if (depthAfter > depthBefore) kept = [{ label: describeChange(transaction), at: now, depth: depthAfter }, ...kept].slice(0, 40);
	else if (kept[0]?.depth === depthAfter && depthAfter === depthBefore) kept = [{ ...kept[0], at: now }, ...kept.slice(1)];
	return kept;
}

/** How long ago, as in the mockup: "now", "2 min", "1 hr". */
export function agoText(at: number, now = Date.now()): string {
	const minutes = Math.floor((now - at) / 60_000);
	if (minutes < 1) return 'now';
	if (minutes < 60) return `${minutes} min`;
	return `${Math.floor(minutes / 60)} hr`;
}
