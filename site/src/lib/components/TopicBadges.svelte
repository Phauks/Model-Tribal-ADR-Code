<script lang="ts">
	// Topics, methods and other short tags as badges, one per word or phrase,
	// everywhere the site lists them (Trevor, Nov. 23, 2026).
	let { topics, label }: { topics: string[]; label?: string } = $props();
</script>

<ul class="topic-badges" aria-label={label}>
	{#each topics as topic (topic)}
		<li class="topic-badge">{topic}</li>
	{/each}
</ul>
