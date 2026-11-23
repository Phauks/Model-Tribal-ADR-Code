<script lang="ts">
	// The About page, edited on the website like the essays (content/about/about.md).
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<EssayArticle {...data} />
