<script lang="ts">
	import Breadcrumbs from '#lib/components/Breadcrumbs.svelte';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Lock from '@lucide/svelte/icons/lock';
	import { enhance } from '$app/forms';
	import ChangeComparison from '#lib/components/changes/ChangeComparison.svelte';
	import HideChangeFields from '#lib/components/changes/HideChangeFields.svelte';
	import Modal from '#lib/components/Modal.svelte';
	import { dateTime } from '#lib/change-dates.ts';
	import { pageChangesLink, pageKindLabels, sizeChangeText, type ChangeView } from '#lib/page-history.ts';
	import { readSignedInHint } from '#lib/signed-in-hint.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const change = $derived(data.change);
	const pageName = $derived(change.title ?? 'A page no longer on this site');
	const historyLink = $derived(pageChangesLink(change.address));

	// The lead author can hide parts of a change from the workspace; the link shows when the signed-in hint says they can open it.
	let canHide = $state(false);
	$effect(() => {
		canHide = readSignedInHint(document.cookie).workspacePageNames.includes('changes');
	});

	// "Hide part of this change" opens a dialog over the change (approved mockup 6, design/recent-changes). It posts to the
	// workspace page /workspace/changes/<change>, which the link opens by itself without scripts.
	interface Hiding {
		hidden: { hideText: boolean; hideSummary: boolean; hidePerson: boolean; reason: string } | undefined;
		requests: { reference: string; kind: string }[];
	}
	let hideDialog: Modal<string> | undefined = $state();
	let hideOpener: HTMLAnchorElement | undefined;
	let hiding = $state<Hiding | undefined>();
	let hideProblem = $state('');
	let hideBusy = $state(false);

	async function openHide(event: MouseEvent & { currentTarget: HTMLAnchorElement }): Promise<void> {
		event.preventDefault();
		hideOpener = event.currentTarget;
		const response = await fetch(`/workspace/changes/${change.id}/hiding.json`).catch(() => undefined);
		if (!response?.ok) {
			// Signed out since, or the network failed: the workspace page explains.
			window.location.href = hideOpener.href;
			return;
		}
		hiding = (await response.json()) as Hiding;
		hideProblem = '';
		hideDialog?.open();
	}

	function describe(view: ChangeView): string {
		const who = view.whoHidden ? 'name hidden' : view.who;
		return `${dateTime(view.madeAt)}, ${who}`;
	}
</script>

<svelte:head>
	<title>Change to {pageName} · Recent changes · Tribal Law Project</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<Breadcrumbs
	trail={[
		{ label: 'Recent changes', href: '/changes' },
		{ label: `History of ${pageName}`, href: historyLink }
	]}
	current="Change to {pageName}"
/>

<h1>
	{#if change.change === 'new'}New page:{:else if change.change === 'removed'}Page removed:{:else if change.change === 'published'}Published:{:else if change.change === 'restored'}Restored an earlier version:{:else}Change to{/if}
	{#if change.title && change.change !== 'removed'}<a href={change.address}>{change.title}</a>{:else}{pageName}{/if}
</h1>

<p class="meta">
	<span class="kind">{pageKindLabels[change.kind]}</span> ·
	<time datetime={change.madeAt}>{dateTime(change.madeAt)}</time> ·
	{#if change.whoHidden}<span class="hidden-part">name hidden</span>{:else}{change.who}{/if}
	{#if change.sizeChange !== undefined} · {sizeChangeText(change.sizeChange)} bytes{/if}
</p>
{#if change.summaryHidden}
	<p><span class="hidden-part">summary hidden</span></p>
{:else if change.summary}
	<p class="summary">{change.summary}</p>
{/if}
{#if change.hiddenReason}
	<p class="notice"><EyeOff size={16} aria-hidden="true" /> {change.hiddenReason}. What is hidden is not shown here or in Recent changes.</p>
{/if}

<nav class="steps" aria-label="Other changes to this page">
	{#if data.older}<a class="button-quiet" href="/changes/{data.older}"><ChevronLeft size={16} aria-hidden="true" />Older change</a>{/if}
	{#if data.newer}<a class="button-quiet" href="/changes/{data.newer}">Newer change<ChevronRight size={16} aria-hidden="true" /></a>{/if}
	<a href={historyLink}>Every change to this page</a>
	{#if canHide}<a href="/workspace/changes/{change.id}" onclick={openHide}>Hide part of this change</a>{/if}
</nav>

{#if canHide}
	<Modal bind:this={hideDialog} title="Hide part of this change" fitContent actionsAtEnd onclose={() => hideOpener?.focus()}>
		<p class="hide-about">{pageName}, {dateTime(change.madeAt)}{#if change.who}, by {change.who}{/if}</p>
		{#if hideProblem}<p class="field-error" role="alert">{hideProblem}</p>{/if}
		{#if hiding}
			<form
				id="hide-change-form"
				method="post"
				action="/workspace/changes/{change.id}?/hide"
				use:enhance={() => {
					hideBusy = true;
					return async ({ result }) => {
						hideBusy = false;
						if (result.type === 'success') {
							hideDialog?.close();
							// The change's page is cached for a minute: fetch it fresh into the cache, then show it.
							await fetch(window.location.href, { cache: 'reload' }).catch(() => undefined);
							window.location.reload();
						} else if (result.type === 'failure') {
							hideProblem = String(result.data?.problem ?? 'The change could not be hidden.');
						} else {
							hideProblem = 'The change could not be hidden. Try again from the workspace.';
						}
					};
				}}
			>
				<HideChangeFields prefix="hide-dialog" hidden={hiding.hidden} requests={hiding.requests} />
			</form>
		{/if}
		{#snippet actions()}
			<button type="button" class="button button-quiet" onclick={() => hideDialog?.close()}>Cancel</button>
			<button type="submit" form="hide-change-form" class="button hide-button" disabled={hideBusy}><EyeOff size={18} aria-hidden="true" />Hide</button>
		{/snippet}
	</Modal>
{/if}

{#if data.comparison.kind === 'parts'}
	{#if change.textHidden}
		<p><span class="hidden-part">parts hidden</span></p>
	{:else if change.change === 'new'}
		<p>The page was added to the site.</p>
	{:else if change.change === 'removed'}
		<p>The page was taken off the site.</p>
	{:else if change.parts && change.parts.length > 0}
		<h2>Parts of the page that changed</h2>
		<ul class="parts">
			{#each change.parts as part (part)}<li>{part}</li>{/each}
		</ul>
	{/if}
	<p class="notice">
		<Lock size={16} aria-hidden="true" />
		Earlier wording of {change.kind === 'story' ? 'stories' : 'nation pages'} is not shown on this site.
	</p>
{:else if data.comparison.kind === 'hidden'}
	<p>The text of this version is hidden, so it cannot be compared.</p>
{:else if data.comparison.kind === 'earlier-hidden'}
	<p>The version before this change is hidden, so the two cannot be compared.</p>
{:else if data.comparison.kind === 'missing'}
	<p>The text of this version is not available to compare.</p>
{:else if data.comparison.kind === 'compared'}
	<ChangeComparison
		blocks={data.comparison.blocks}
		beforeLabel={data.before ? `Before: ${describe(data.before)}` : 'Before: no earlier version'}
		afterLabel={`After: ${describe(change)}`}
	/>
	{#if change.comparable}
		<p class="small after-comparison"><a href="/changes/{change.id}/version">Read the page as this change left it</a></p>
	{/if}
{/if}

<style>
	.meta {
		color: var(--color-ink-muted);
	}

	.kind {
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-size: var(--font-size-small);
	}

	.summary {
		font-style: italic;
	}

	.hidden-part {
		color: var(--color-ink-muted);
		text-decoration: line-through;
	}

	.notice {
		background: var(--color-notice-background);
		border-radius: var(--radius-panel);
		padding: var(--space-3) var(--space-4);
		max-width: var(--layout-measure);
	}

	.after-comparison {
		margin-top: var(--space-3);
	}

	.steps {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
		align-items: center;
		margin-block: var(--space-3);
	}

	.hide-about {
		margin-top: 0;
		color: var(--color-ink-muted);
	}

	.hide-button {
		gap: var(--space-2);
		background: transparent;
		color: var(--color-action);
	}

	.steps a {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
</style>
