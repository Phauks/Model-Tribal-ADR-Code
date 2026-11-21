<script lang="ts">
	// The Sources section at the end of a nation page: each source once, with
	// every fact on the page it supports, so each fact stays traceable without
	// a citation beside it (src/lib/server/source-uses.ts).
	import type { SourceEntry } from '#lib/server/source-uses.ts';

	let { sources }: { sources: SourceEntry[] } = $props();
</script>

{#if sources.length > 0}
	<section class="notes" aria-labelledby="sources-heading">
		<h2 id="sources-heading">Sources</h2>
		<p>Each source below is followed by the facts on this page that come from it.</p>
		<ol>
			{#each sources as source (source.key)}
				<li id="source-{source.number}">
					{@html source.html}
					<ul class="source-uses">
						{#each source.groups as group, index (index)}
							<li>
								<span class="source-use-section">{group.section}</span>{#if group.where}{' '}<span
										class="muted">({group.where})</span
									>{/if}: {group.facts.join('; ')}
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ol>
	</section>
{/if}
