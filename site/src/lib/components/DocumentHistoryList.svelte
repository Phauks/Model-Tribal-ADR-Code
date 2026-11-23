<script lang="ts">
	// A nation's documents that have recorded versions (decision record 0018),
	// oldest version first, with what each version did to the ones before it.
	// No clause summaries or comparisons are shown (Trevor, Nov. 22, 2026).
	// Each version's name links to a public copy of its text where the source
	// has one, and its label ends with the markers of its sources. A heading
	// given by the page, such as "Gaming compact with Arizona", already says
	// what kind of document it is, so the kind is not repeated under it, and a
	// status the sources do not record is left out rather than shown as "Unknown".
	import type { DocumentHistoryView } from '#lib/server/document-history.ts';
	import CitationMarks from './CitationMarks.svelte';

	let { documents }: { documents: (DocumentHistoryView & { heading?: string })[] } = $props();
</script>

{#each documents as document (document.id)}
	<section class="document-history" aria-labelledby="document-{document.id}">
		<h3 id="document-{document.id}">{document.heading ?? document.title}</h3>
		{#if document.heading}
			{#if document.inEffect}<p class="small muted">In effect: {document.inEffect}.</p>{/if}
		{:else}
			<p class="small muted">
				{document.kind}{#if document.inEffect}. In effect: {document.inEffect}{/if}.
			</p>
		{/if}
		<ol class="version-list">
			{#each document.versions as version (version.id)}
				<li>
					<p class="version-heading">
						<strong>{#if version.link}<a href={version.link}>{version.label}</a>{:else}{version.label}{/if}</strong
						><CitationMarks marks={version.citations} />
						{#if version.inEffect || version.status !== 'Unknown'}
							<span class="version-status" class:in-effect={version.inEffect}
								>{version.inEffect ? 'In effect' : version.status}</span
							>
						{/if}
						<span class="muted small">{version.event}</span>
					</p>
					{#if version.dates}<p class="small">{version.dates}.</p>{/if}
					{#if version.relation}<p class="small">{version.relation}.</p>{/if}
				</li>
			{/each}
		</ol>
	</section>
{/each}

<style>
	.version-list {
		padding-left: var(--space-5);
	}

	.version-list > li + li {
		margin-top: var(--space-3);
	}

	.version-list p {
		margin: 0;
	}

	/* "In effect" is filled; other statuses are outlined, so color is not the only cue. */
	.version-status {
		display: inline-block;
		margin: 0 var(--space-1);
		padding: 0 var(--space-2);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		line-height: 1.5;
		color: var(--color-ink-muted);
	}

	.version-status.in-effect {
		background: var(--color-link);
		border-color: var(--color-link);
		color: var(--color-paper);
	}
</style>
