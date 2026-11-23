<script lang="ts">
	// Topics, methods and other short tags as badges, one per word or phrase,
	// everywhere the site lists them (Trevor, Nov. 23, 2026). A badge with a
	// link opens the page that lists everything else with that tag.
	let { topics, label }: { topics: { text: string; link?: string }[]; label?: string } = $props();
</script>

<ul class="topic-badges" aria-label={label}>
	{#each topics as topic (topic.text)}
		<li>{#if topic.link}<a class="topic-badge" href={topic.link}>{topic.text}</a>{:else}<span class="topic-badge">{topic.text}</span>{/if}</li>
	{/each}
</ul>
