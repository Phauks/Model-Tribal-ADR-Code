<script lang="ts">
	import EssayEditor from '#lib/components/essays/EssayEditor.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.canEdit ? 'Edit' : 'Read'}: {data.title} · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/workspace/essays">Essays</a> › <a href="/workspace/essays/{data.identifier}">{data.title}</a> › {data.canEdit ? 'Edit' : 'Read'}
</nav>

<h1 class="visually-hidden">{data.canEdit ? 'Edit' : 'Read'} {data.title}</h1>
<p class="small muted">Started from version {data.version}, saved {data.savedAt}. Double-click a citation to change it.</p>

{#key data.identifier}
	<EssayEditor identifier={data.identifier} text={data.text} version={data.version} canEdit={data.canEdit} />
{/key}
