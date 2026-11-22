<!--
	@component
	The markers of a fact's sources: small numbers in square brackets, as
	Wikipedia shows citations (site/DESIGN.md, section 6, "Citations"). Each
	links to its source in the page's Sources list, which links back to it.
	With scripts, CitationPopup shows the source in place instead. The HTML
	matches what src/lib/citation-marks.ts writes for Markdown citations.

	Put it right after the fact's words, with no space before it:
	{item.text}<CitationMarks marks={item.citations} />
-->
<script lang="ts">
	import { sourceAnchor, type CitationMark } from '#lib/citation-marks.ts';

	let { marks = [] }: { marks?: CitationMark[] } = $props();
</script>

{#if marks.length > 0}<sup class="citation"
		>{#each marks as mark (mark.anchor)}<a
				id={mark.anchor}
				class="note-marker"
				href="#{sourceAnchor(mark.number)}"
				aria-label="Source {mark.number}"
				data-where={mark.where}>{mark.number}</a
			>{/each}</sup
	>{/if}
