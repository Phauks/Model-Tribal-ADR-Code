<script lang="ts">
	import EssayArticle from '#lib/components/essays/EssayArticle.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<EssayArticle section="Back Matter" sectionLink="/back-matter" {...data} />
