<!--
	The sources an essay cites, in the order it first cites them, each with
	links to its documents, so a writer can open the source behind a passage
	without leaving the editor. Choosing a source's name moves the cursor to
	where the essay first cites it.
-->
<script lang="ts">
	import type { EditorView } from 'prosemirror-view';
	import { TextSelection } from 'prosemirror-state';
	import { citationReferences } from '#lib/essays/syntax.ts';
	import { citationWithoutAddress, citedKeys, type SourceDocuments } from '#lib/essays/source-documents.ts';
	import EssaySourceLinks from './EssaySourceLinks.svelte';

	let {
		view,
		revision,
		library,
		documents,
		loadDocuments
	}: {
		view: () => EditorView | undefined;
		revision: number;
		library: { sources: [string, string][] } | null;
		documents: Record<string, SourceDocuments>;
		loadDocuments: (keys: string[]) => Promise<void>;
	} = $props();

	const labels = $derived(new Map((library?.sources ?? []).map(([key, label]) => [key, citationWithoutAddress(label)])));
	const keys = $derived.by(() => {
		void revision;
		const editor = view();
		return editor ? citedKeys(editor.state.doc) : [];
	});

	$effect(() => {
		void loadDocuments(keys);
	});

	/** Moves the cursor to the first place the essay cites a source. */
	function goTo(key: string): void {
		const editor = view();
		if (!editor) return;
		let found = -1;
		editor.state.doc.descendants((node, position) => {
			if (found >= 0) return false;
			const cites =
				(node.type.name === 'citation' && citationReferences(String(node.attrs.text)).some((reference) => reference.key === key)) ||
				((node.type.name === 'case_block' || node.type.name === 'law_block') && node.attrs.source === key);
			if (cites) found = node.isInline ? position : position + 1;
			return found < 0;
		});
		if (found < 0) return;
		const selection = TextSelection.near(editor.state.doc.resolve(found));
		editor.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
		editor.focus();
	}
</script>

<section class="essay-sources-panel" aria-labelledby="essay-sources-heading">
	<h2 id="essay-sources-heading" class="small">Sources cited ({keys.length})</h2>
	{#if !library}
		<p class="small muted">Loading the list of sources…</p>
	{:else if keys.length === 0}
		<p class="small muted">This essay cites no sources yet.</p>
	{:else}
		<ol class="small">
			{#each keys as key (key)}
				<li>
					<button type="button" class="link-button" onclick={() => goTo(key)} title="Go to where the essay first cites it">
						{labels.get(key) ?? key}
					</button>
					<EssaySourceLinks documents={documents[key]} loading={!(key in documents)} />
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.essay-sources-panel {
		max-height: 40vh;
		overflow-y: auto;
		padding: var(--space-3);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		background: var(--color-surface);
	}

	h2 {
		margin: 0 0 var(--space-2);
	}

	ol {
		margin: 0;
		padding-left: var(--space-5);
		display: grid;
		gap: var(--space-2);
	}

	.link-button {
		display: block;
		width: 100%;
		overflow-wrap: anywhere;
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--color-link);
		text-decoration: underline;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
</style>
