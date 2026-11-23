import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Command } from 'prosemirror-state';
import { essaySchema, parseEssay, serializeEssay } from '#lib/essays/document.ts';
import { addAfterCurrent, addSection, moveCurrent } from '#lib/essays/placement.ts';

const body = `## One

First.

### One A

In one A.

## Two

Second.
`;

/** Runs a command with the cursor at the start of the text `at`, and answers the essay as Markdown. */
function run(text: string, at: string, command: Command): string {
	const doc = parseEssay(text);
	let position = -1;
	doc.descendants((node, offset) => {
		if (position < 0 && node.isText && node.text!.includes(at)) position = offset + node.text!.indexOf(at);
		return position < 0;
	});
	let state = EditorState.create({ doc, selection: TextSelection.create(doc, position) });
	const done = command(state, (transaction) => (state = state.apply(transaction)));
	expect(done).toBe(true);
	return serializeEssay(state.doc);
}

describe('adding blocks where they belong', () => {
	it('adds a section after the section the cursor is in, subsections included', () => {
		expect(run(body, 'First', addSection(essaySchema, 2))).toBe(
			'## One\n\nFirst.\n\n### One A\n\nIn one A.\n\n## New section\n\n## Two\n\nSecond.\n'
		);
	});

	it('adds a subsection after the subsection the cursor is in', () => {
		expect(run(body, 'In one A', addSection(essaySchema, 3))).toBe(
			'## One\n\nFirst.\n\n### One A\n\nIn one A.\n\n### New subsection\n\n## Two\n\nSecond.\n'
		);
	});

	it('adds a box after the paragraph, not inside it, and in place of an empty paragraph', () => {
		const box = essaySchema.node('analysis_block', { title: '' }, [essaySchema.node('paragraph', null, essaySchema.text('Reading.'))]);
		expect(run('Alpha beta.\n\nGamma.\n', 'beta', addAfterCurrent(box))).toBe('Alpha beta.\n\n::: analysis\nReading.\n\n:::\n\nGamma.\n');
	});
});

describe('moving blocks', () => {
	it('moves a paragraph up past the block before it', () => {
		expect(run('A.\n\nB.\n\nC.\n', 'C', moveCurrent('up'))).toBe('A.\n\nC.\n\nB.\n');
	});

	it('moves a whole section down past the next section of its level', () => {
		expect(run(body, 'One', moveCurrent('down'))).toBe('## Two\n\nSecond.\n\n## One\n\nFirst.\n\n### One A\n\nIn one A.\n');
	});

	it('keeps a subsection inside its section', () => {
		const doc = parseEssay(body);
		let position = -1;
		doc.descendants((node, offset) => {
			if (position < 0 && node.isText && node.text === 'One A') position = offset;
			return position < 0;
		});
		const state = EditorState.create({ doc, selection: TextSelection.create(doc, position) });
		expect(moveCurrent('down')(state)).toBe(false);
		expect(moveCurrent('up')(state)).toBe(false);
	});
});
