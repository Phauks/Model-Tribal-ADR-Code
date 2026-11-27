<script lang="ts">
	import EssayHistory from '#lib/components/essays/EssayHistory.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<EssayHistory section="News" sectionLink="/news" {...data} />
