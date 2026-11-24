<script lang="ts">
	// "Go to" in the editor (Trevor, 2026-11-22: "instead of lines, use
	// components, words, characters. This doesn't always need to be seen
	// right away"). The counts show only here, not all the time.
	import { untrack } from 'svelte';
	import { TextSelection } from 'prosemirror-state';
	import type { EditorView } from 'prosemirror-view';
	import Dropdown from '#lib/components/Dropdown.svelte';
	import { characterPosition, components, counts, textBlocks, wordPosition } from '#lib/essays/checks.ts';

	let { view, onclose }: { view: () => EditorView | undefined; onclose: () => void } = $props();

	// Counted once, when the panel opens.
	const editor = untrack(() => view());
	const blocks = editor ? textBlocks(editor.state.doc) : [];
	const parts = editor ? components(editor.state.doc) : [];
	const totals = counts(blocks);

	// Nested components are set in under their parent.
	const componentChoices = parts.map((part, index) => ({ value: String(index), label: `${'\u2003'.repeat(part.depth)}${part.label}` }));

	let by = $state<'component' | 'word' | 'character'>('component');
	let component = $state(0);
	let number = $state(1);
	let problem = $state('');

	function go(event: SubmitEvent): void {
		event.preventDefault();
		const current = view();
		if (!current) return;
		const position =
			by === 'component' ? (parts[component]?.position ?? null) : by === 'word' ? wordPosition(blocks, number) : characterPosition(blocks, number);
		if (position === null) {
			problem = by === 'word' ? `The essay has ${totals.words.toLocaleString('en-US')} words.` : `The essay has ${totals.characters.toLocaleString('en-US')} characters.`;
			return;
		}
		const resolved = current.state.doc.resolve(Math.min(position, current.state.doc.content.size));
		current.dispatch(current.state.tr.setSelection(TextSelection.near(resolved)).scrollIntoView());
		current.focus();
		onclose();
	}
</script>

<form class="go-to" onsubmit={go}>
	<p class="small muted">
		{parts.length.toLocaleString('en-US')} components, {totals.words.toLocaleString('en-US')} words, {totals.characters.toLocaleString('en-US')} characters
	</p>
	<fieldset>
		<legend class="small">Go to</legend>
		<label class="small"><input type="radio" bind:group={by} value="component" /> Component</label>
		<label class="small"><input type="radio" bind:group={by} value="word" /> Word</label>
		<label class="small"><input type="radio" bind:group={by} value="character" /> Character</label>
	</fieldset>
	{#if by === 'component'}
		<Dropdown
			label="Component"
			hideLabel
			id="go-to-component"
			choices={componentChoices}
			bind:value={() => String(component), (index) => (component = Number(index))}
		/>
	{:else}
		<label class="small" for="go-to-number">{by === 'word' ? 'Word number' : 'Character number'}</label>
		<input id="go-to-number" type="number" min="1" bind:value={number} oninput={() => (problem = '')} />
	{/if}
	<button class="button" type="submit">Go</button>
	<button class="button button-quiet" type="button" onclick={onclose}>Close</button>
	{#if problem}<p class="small" role="alert">{problem}</p>{/if}
</form>

<style>
	.go-to {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-control);
		padding: var(--space-2) var(--space-3);
		margin: 0 0 var(--space-3);
		background: var(--color-surface);
	}

	.go-to p {
		flex-basis: 100%;
		margin: 0;
	}

	fieldset {
		display: flex;
		gap: var(--space-2);
		border: none;
		margin: 0;
		padding: 0;
	}

	legend {
		float: left;
		margin-right: var(--space-2);
	}

	.go-to :global(.dropdown) {
		margin: 0;
	}

	input[type='number'] {
		width: 8rem;
	}
</style>
