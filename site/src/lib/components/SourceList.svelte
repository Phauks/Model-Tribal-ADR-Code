<script lang="ts">
	// The Sources section at the end of a page: each source once, numbered in
	// the order the page first cites it, with every fact on the page it
	// supports (src/lib/server/source-uses.ts). As on Wikipedia, the number
	// links back to the place in the text that cites the source; a source
	// cited in several places also gets a letter for each, a, b, c
	// (Trevor, Nov. 22, 2026). The glossary pages use it too, with each entry
	// in place of a fact. After z the letters go on aa, ab; the accessible
	// name keeps a space before them, so "ab" is a word of it, as WCAG 2.5.3
	// (label in name) asks.
	import { backlinkLetter, sourceAnchor } from '#lib/citation-marks.ts';
	import type { SourceEntry } from '#lib/server/source-uses.ts';
	import Collapsible from './Collapsible.svelte';

	// Trevor asked on Nov. 22, 2026 that the section carry no sentence explaining it.
	let { sources }: { sources: SourceEntry[] } = $props();
</script>

{#if sources.length > 0}
	<div class="notes" data-print-part="sources">
	<Collapsible heading="Sources" identifier="sources-heading">
		<ol class="source-list">
			{#each sources as source (source.key)}
				<li id={sourceAnchor(source.number)}>
					<span class="source-backlinks"
						>{#if source.backlinks.length > 0}<a
								class="source-number"
								href="#{source.backlinks[0]}"
								aria-label="Source {source.number}: back to {source.backlinks.length > 1
									? 'the first place'
									: 'the place'} it is cited">{source.number}.</a
							>{#if source.backlinks.length > 1}{#each source.backlinks as backlink, index (backlink)}{' '}<a
										class="source-letter"
										href="#{backlink}"
										aria-label="Back to citation {source.number} {backlinkLetter(index)}"
										>{backlinkLetter(index)}</a
									>{/each}{/if}{:else}<span class="source-number">{source.number}.</span>{/if}</span
					>
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
	</Collapsible>
	</div>
{/if}
