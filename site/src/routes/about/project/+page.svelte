<script lang="ts">
	// The About the Project page, edited on the website like the essays (content/about/about.md); it left /about, which became the section's own page, on Nov. 28, 2026.
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<EssayArticle {...data} />
