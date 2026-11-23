<script lang="ts">
	import { enhance } from '$app/forms';
	import { dateTime } from '#lib/change-dates.ts';
	import { hideReasons, pageKindLabels } from '#lib/page-history.ts';
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
	<fieldset>
		<legend>What to hide</legend>
		<label class="check">
			<input type="checkbox" name="text" checked={hidden ? hidden.hideText : true} />
			<span><strong>The text of this version</strong><br /><span class="small muted">No one can read it or compare it with another version, here or in Recent changes. Its size is hidden too.</span></span>
		</label>
		<label class="check">
			<input type="checkbox" name="summary" checked={hidden?.hideSummary ?? false} />
			<span><strong>The summary</strong><br /><span class="small muted">Use this when the summary itself names what was removed.</span></span>
		</label>
		<label class="check">
			<input type="checkbox" name="person" checked={hidden?.hidePerson ?? false} />
			<span><strong>Who made it</strong><br /><span class="small muted">Readers see “name hidden”.</span></span>
		</label>
	</fieldset>
	<div class="field">
		<label for="hide-reason">Reason readers see</label>
		<select id="hide-reason" name="reason">
			{#each Object.entries(hideReasons) as [value, label] (value)}
				<option {value} selected={hidden ? hidden.reason === value : value === 'nation-request'}>{label}</option>
			{/each}
		</select>
	</div>
	<div class="field">
		<label for="hide-note">Private note for the activity log (optional)</label>
		<input id="hide-note" name="note" maxlength="500" placeholder="For example, the request this answers" />
	</div>
	<p class="small muted">
		The change stays in the list with a line through what is hidden. The activity log records who hid it and why, and it
		can be shown again here.
	</p>
	<button type="submit" class="button">{hidden ? 'Change what is hidden' : 'Hide'}</button>
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
	fieldset {
		border: 0;
		padding: 0;
	}

	legend {
		font-weight: var(--font-weight-semibold);
	}

	.check {
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		padding: var(--space-2) var(--space-3);
		margin-block: var(--space-2);
		max-width: var(--layout-measure);
	}

	.field {
		margin-block: var(--space-3);
	}

	.field label {
		display: block;
		font-weight: var(--font-weight-semibold);
	}

	.show-form {
		margin-top: var(--space-6);
	}
</style>
