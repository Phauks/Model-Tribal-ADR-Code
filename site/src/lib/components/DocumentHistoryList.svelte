<script lang="ts">
	// A nation's documents that have recorded versions (decision record 0018),
	// oldest version first, with what each version did to the ones before it.
	// No clause summaries or comparisons are shown (Trevor, Nov. 22, 2026).
	// Each version's name links to a public copy of its text where the source
	// has one, and its label ends with the markers of its sources.
	import type { DocumentHistoryView } from '#lib/server/document-history.ts';
	import CitationMarks from './CitationMarks.svelte';
	import DocumentTimeline from './DocumentTimeline.svelte';

	let { documents }: { documents: DocumentHistoryView[] } = $props();
</script>

{#each documents as document (document.id)}
	<section class="document-history" aria-labelledby="document-{document.id}">
		<h3 id="document-{document.id}">{document.title}</h3>
		<p class="small muted">
			{document.kind}{#if document.inEffect}. In effect: {document.inEffect}{/if}.
		</p>
		<DocumentTimeline versions={document.versions} />
		<ol class="version-list">
			{#each document.versions as version (version.id)}
				<li>
					<p class="version-heading">
						<strong>{#if version.link}<a href={version.link}>{version.label}</a>{:else}{version.label}{/if}</strong>
						<span class="muted">({version.event}; {version.inEffect ? 'in effect' : version.status.toLocaleLowerCase('en-US')})</span
						><CitationMarks marks={version.citations} />
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
</style>
