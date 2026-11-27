<script lang="ts">
	import NewsIndex from '#lib/components/essays/NewsIndex.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<NewsIndex posts={data.posts} />
