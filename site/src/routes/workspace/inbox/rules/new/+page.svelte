<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import RuleEditor from '../RuleEditor.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const draft = $derived(form && 'values' in form && form.values ? form.values : data.draft);
	const preview = $derived(form && 'preview' in form ? form.preview : null);
</script>

<svelte:head>
	<title>New rule · Inbox · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<div class="head">
	<a class="icon-button" href="/workspace/inbox/rules" aria-label="Back to the rules" title="Back to the rules"><ArrowLeft size={20} aria-hidden="true" /></a>
	<h1>New rule</h1>
</div>

{#if form && 'problem' in form}
	<div class="notice notice-problem" role="alert"><p>{form.problem}</p></div>
{/if}

{#key form}
	<RuleEditor {draft} {preview} folders={data.mailFolders} tags={data.tags} people={data.people} isNew={true} />
{/key}

<style>
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}
	.head h1 {
		margin: 0;
	}
</style>
