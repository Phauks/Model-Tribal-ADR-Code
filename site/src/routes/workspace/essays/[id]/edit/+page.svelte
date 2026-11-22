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
{#if data.gitConflict > 0}
	<div class="notice" role="status">
		<p>
			Git changed {data.gitConflict === 1 ? 'a paragraph' : `${data.gitConflict} paragraphs`} that were also edited
			here, so its text was not merged. Settle it on the <a href="/workspace/essays">Essays</a> page, or edit the
			paragraph here to the wording you want.
		</p>
	</div>
{/if}
<p class="small muted">Started from version {data.version}, saved {data.savedAt}. Double-click a citation to change it.</p>

{#key data.identifier}
	<EssayEditor identifier={data.identifier} text={data.text} version={data.version} canEdit={data.canEdit} />
{/key}
