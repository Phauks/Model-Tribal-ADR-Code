<!--
	Links to one source's documents (src/lib/essays/source-documents.ts): the
	copy this site keeps first, then the original and an archived copy. Each
	opens in a new tab, so the essay stays open in the editor.
-->
<script lang="ts">
	import type { SourceDocuments } from '#lib/essays/source-documents.ts';

	let { documents, loading = false }: { documents: SourceDocuments | undefined; loading?: boolean } = $props();
</script>

{#if loading}
	<span class="muted">Looking up its documents…</span>
{:else if documents?.copy || documents?.original || documents?.archived}
	<span class="source-document-links">
		{#if documents.copy}<a href={documents.copy.href} target="_blank" rel="noopener">{documents.copy.label}</a>{/if}
		{#if documents.original}<a href={documents.original.href} target="_blank" rel="noopener noreferrer">Original: {documents.original.label}</a>{/if}
		{#if documents.archived}<a href={documents.archived.href} target="_blank" rel="noopener noreferrer">{documents.archived.label}</a>{/if}
	</span>
{:else}
	<span class="muted">No document link in this source's record.</span>
{/if}

<style>
	.source-document-links {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-3);
	}
</style>
