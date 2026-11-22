<script lang="ts">
	import ProjectDocumentPage from '#lib/components/ProjectDocumentPage.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<ProjectDocumentPage {...data} />
