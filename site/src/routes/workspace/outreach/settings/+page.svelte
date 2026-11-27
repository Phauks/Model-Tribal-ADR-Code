<script lang="ts">
	// Outreach settings (design/outreach-redesign): what the outreach mailbox needs, where replies go, and templates put away.
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { outreachBase as base } from '../views.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Outreach settings · Outreach · Workspace · Tribal Law Project</title>
</svelte:head>

<h1>Outreach settings</h1>

<h2>The outreach mailbox</h2>
{#if data.problems.length}
	<p>Batches can be written and scheduled now. Nothing goes out until these are set up in the site’s environment:</p>
	<ul class="checks">
		{#each data.problems as problem (problem)}<li><CircleAlert size={18} aria-hidden="true" />{problem}</li>{/each}
	</ul>
{:else}
	<p class="ready"><CircleCheck size={18} aria-hidden="true" />Set up. Letters go from {data.mailbox?.from} through {data.mailbox?.host}.</p>
{/if}

<h2>Replies</h2>
<p>
	{#if data.replyInbox}
		Unless a batch chooses another inbox, replies arrive in {data.replyInbox.name}{data.replyTo ? ` (${data.replyTo})` : ''}.
	{:else}
		No reply address is set; each batch chooses its inbox under Replies to.
	{/if}
	Each letter carries the signature of the inbox its replies go to. <a href="/workspace/inbox/settings">Signatures and saved replies</a>
</p>

<h2>Templates put away</h2>
{#if data.archived.length}
	<ul>
		{#each data.archived as template (template.identifier)}
			<li><a href="{base}/templates/{template.identifier}">{template.name}</a> <span class="small muted">v{template.version}</span></li>
		{/each}
	</ul>
{:else}
	<p class="muted">None.</p>
{/if}

<style>
	.checks {
		list-style: none;
		padding: 0;
	}
	.checks li,
	.ready {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.checks :global(svg) {
		flex: none;
		margin-top: 0.2em;
		color: var(--color-action);
	}
	.ready :global(svg) {
		flex: none;
		margin-top: 0.2em;
		color: var(--color-link);
	}
</style>
