<script lang="ts">
	import PageChangesView from '#lib/components/PageChangesView.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PageChangesView {data} />
