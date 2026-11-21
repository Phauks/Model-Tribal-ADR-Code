<script lang="ts">
	let { numbers }: { numbers: number[] } = $props();
	const unique = $derived([...new Set(numbers)]);
</script>

{#if unique.length > 0}<sup
		>{#each unique as number, index (number)}{#if index > 0},
			{/if}<a href="#note-{number}" class="note-marker" aria-label="Note {number}">{number}</a
			>{/each}</sup
	>{/if}
