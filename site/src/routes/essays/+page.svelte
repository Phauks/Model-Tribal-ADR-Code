<script lang="ts">
	import EssayIndex from '#lib/components/essays/EssayIndex.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<EssayIndex part="essays" section="Essays" lead="Essays on the design choices behind the model code." essays={data.essays} />
