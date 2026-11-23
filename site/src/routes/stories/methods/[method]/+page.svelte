<script lang="ts">
	import StoryTagPage from '#lib/components/StoryTagPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<StoryTagPage kind={data.kind} tag={data.tag} provisions={data.provisions} />
