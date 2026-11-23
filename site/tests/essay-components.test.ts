import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { essaySchema as schema, parseEssay } from '../src/lib/essays/document.ts';
import { componentFrames, components, componentLabel } from '../src/lib/essays/components.ts';

const body = [
	'## The Cherokee Cases',
	'',
	'First paragraph.',
	'',
	'Second paragraph.',
	'',
	'- one',
	'- two',
	'',
	'### Worcester',
	'',
	'::: analysis',
	'Why it matters.',
	':::',
	'',
	'Third paragraph.',
	''
].join('\n');

describe('essay components', () => {
	it('labels every top-level block and numbers each kind', () => {
		const doc = parseEssay(body);
		const found = components(doc).map((component) => `${component.label} ${component.number}`);
		expect(found).toEqual(['Section heading 1', 'Text 1', 'Text 2', 'List 1', 'Subsection heading 1', 'Analysis 1', 'Text 3']);
	});

	it('leaves a box that labels itself without an outer label', () => {
		const doc = parseEssay(body);
		const analysis = components(doc).find((component) => component.label === 'Analysis');
		expect(analysis?.labeledInside).toBe(true);
		expect(componentLabel(schema.node('paragraph'))).toBe('Text');
	});

	it('frames each block and marks the one the cursor is in, with its number', () => {
		const doc = parseEssay(body);
		const second = components(doc)[2];
		let state = EditorState.create({ doc, plugins: [componentFrames()] });
		state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, second.from + 2)));
		const plugin = state.plugins[0];
		const set = plugin.props.decorations!.call(plugin, state);
		const found = (set as unknown as { find(): { from: number; spec: unknown; type: { attrs: Record<string, string> } }[] }).find();
		expect(found).toHaveLength(7);
		const current = found.filter((decoration) => decoration.type.attrs.class.includes('is-current'));
		expect(current).toHaveLength(1);
		expect(current[0].from).toBe(second.from);
		expect(current[0].type.attrs['data-component']).toBe('Text · 2');
		const analysis = found.find((decoration) => decoration.type.attrs.class.includes('essay-component-boxed'));
		expect(analysis?.type.attrs['data-component']).toBeUndefined();
	});
});
