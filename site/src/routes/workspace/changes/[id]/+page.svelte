<script lang="ts">
	import { enhance } from '$app/forms';
	import { dateTime } from '#lib/change-dates.ts';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import HideChangeFields from '#lib/components/changes/HideChangeFields.svelte';
	import { pageKindLabels } from '#lib/page-history.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const change = $derived(data.change);
	const hidden = $derived(data.hidden);
</script>

<svelte:head>
	<title>Hide part of a change · Workspace · Model Tribal ADR Code</title>
</svelte:head>

<nav aria-label="Breadcrumb" class="small">
	<a href="/workspace/changes">Hidden changes</a> › {change.id}
</nav>

<h1>Hide part of this change</h1>
<p>
	<strong>{change.title ?? change.address}</strong> ({pageKindLabels[change.kind]}), {dateTime(change.madeAt)}, {change.who}.
	{#if change.summary}<br /><em>{change.summary}</em>{/if}
	<br /><a href="/changes/{change.id}">See the change as readers see it</a>
</p>

{#if form?.problem}<p class="notice notice-problem" role="alert">{form.problem}</p>{/if}
{#if form?.done}<p class="notice" role="status">{form.done}</p>{/if}

<form method="post" action="?/hide" use:enhance class="hide-form">
	<HideChangeFields prefix="hide" {hidden} requests={data.requests} />
	<p class="actions">
		<a class="button button-quiet" href="/changes/{change.id}">Cancel</a>
		<button type="submit" class="button hide-button"><EyeOff size={18} aria-hidden="true" />{hidden ? 'Change what is hidden' : 'Hide'}</button>
	</p>
</form>

{#if hidden}
	<form method="post" action="?/show" use:enhance class="show-form">
		<h2>Show it again</h2>
		<p class="small muted">Hidden {dateTime(hidden.hiddenAt)}{#if hidden.hiddenBy} by {hidden.hiddenBy}{/if}.</p>
		<input type="hidden" name="note" value="" />
		<button type="submit" class="button-quiet">Show this change again</button>
	</form>
{/if}

<style>
	.hide-form {
		max-width: var(--layout-popover);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		margin-top: var(--space-4);
	}

	.hide-button {
		gap: var(--space-2);
		background: transparent;
		color: var(--color-action);
	}

	.show-form {
		margin-top: var(--space-6);
	}
</style>
