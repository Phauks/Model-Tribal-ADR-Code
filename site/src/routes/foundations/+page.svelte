<script lang="ts">
	import EssayIndex from '#lib/components/essays/EssayIndex.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<EssayIndex part="foundations" section="Foundations" lead="Background for the model code: the history of federal Indian law and Tribal justice, the court cases a drafter must know, and the model codes and frameworks that came before." essays={data.essays} />
