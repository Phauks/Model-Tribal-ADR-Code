<script lang="ts">
	import EssayIndex from '#lib/components/essays/EssayIndex.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<EssayIndex part="back-matter" section="Back Matter" lead="Pages that close the book and help readers find their way through it, such as the index of cases by topic." essays={data.essays} />
