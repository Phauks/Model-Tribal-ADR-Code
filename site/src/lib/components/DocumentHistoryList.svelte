<script lang="ts">
	// A nation's documents that have recorded versions (decision record 0018),
	// oldest version first, with how each version changed its key clauses.
	// Each version's source is listed in the page's Sources section, not beside it.
	import type { DocumentHistoryView } from '#lib/server/document-history.ts';

	let { documents }: { documents: DocumentHistoryView[] } = $props();
</script>

{#each documents as document (document.id)}
	<section class="document-history" aria-labelledby="document-{document.id}">
		<h3 id="document-{document.id}">{document.title}</h3>
		<p class="small muted">
			{document.kind}{#if document.inEffect}. In effect: {document.inEffect}{/if}.
		</p>
		{#if document.summary}
			<p>{document.summary}</p>
		{/if}
		<ol class="version-list">
			{#each document.versions as version (version.id)}
				<li>
					<p class="version-heading">
						<strong>{version.label}</strong>
						<span class="muted">({version.event}; {version.inEffect ? 'in effect' : version.status.toLocaleLowerCase('en-US')})</span>
					</p>
					{#if version.dates}<p class="small">{version.dates}.</p>{/if}
					{#if version.relation}<p class="small">{version.relation}.</p>{/if}
					{#if version.changes.length > 0}
						<ul class="small">
							{#each version.changes as change, index (index)}
								<li>
									{change.topic}: {change.change}{#if change.summary}. {change.summary}{/if}
								</li>
							{/each}
						</ul>
					{/if}
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
</style>
