<script lang="ts">
	import type { Note } from '#lib/server/markdown.ts';

	let { notes }: { notes: Note[] } = $props();
</script>

{#if notes.length > 0}
	<section class="notes" aria-labelledby="notes-heading">
		<h2 id="notes-heading">Notes</h2>
		<ol>
			{#each notes as note (note.number)}
				<li id="note-{note.number}">{@html note.html}</li>
			{/each}
		</ol>
	</section>
{/if}
