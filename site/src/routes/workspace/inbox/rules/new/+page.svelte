<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import RuleEditor from '../RuleEditor.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const draft = $derived(form && 'values' in form && form.values ? form.values : data.draft);
	const preview = $derived(form && 'preview' in form ? form.preview : null);
</script>

<svelte:head>
	<title>New rule · Inbox · Workspace · Tribal Law Project</title>
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Workspace', href: '/workspace' },
		{ label: 'Inbox', href: '/workspace/inbox' },
		{ label: 'Auto-sort rules', href: '/workspace/inbox/rules' }
	]}
/>
<h1>New rule</h1>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}

{#key form}
	<RuleEditor {draft} {preview} folders={data.mailFolders} tags={data.tags} people={data.people} isNew={true} />
{/key}
