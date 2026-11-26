<script lang="ts">
	// The page's own controls in the masthead, after the site's name, for a
	// person who can work on the page (src/lib/page-editing.svelte.ts):
	// Reading, Commenting and Editing as three icon buttons with the current
	// one filled, whether draft changes show, History, and Publish in the
	// action color (design/header-page-controls, option A, approved by Trevor
	// on Nov. 23, 2026). A page edited elsewhere, such as a nation's page,
	// offers links instead of the three modes. Readers see none of this. The
	// Commenting button carries the number of open comments on the page
	// (design/page-comments, Nov. 26, 2026).
	import BookOpenText from '@lucide/svelte/icons/book-open-text';
	import History from '@lucide/svelte/icons/history';
	import Layers from '@lucide/svelte/icons/layers';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Send from '@lucide/svelte/icons/send';
	import Users from '@lucide/svelte/icons/users';
	import { currentPageControls, type PageMode } from '#lib/page-editing.svelte.ts';

	let { place }: { place: 'row' | 'panel' } = $props();

	const controls = $derived(currentPageControls());
	const modeNames: Record<PageMode, string> = { reading: 'Reading', commenting: 'Commenting', editing: 'Editing' };
</script>

{#if controls}
	<div class="page-controls is-{place}" role="group" aria-label="This page">
		{#if controls.modes.length > 1}
			<span class="modes" role="group" aria-label="Mode">
				{#each controls.modes as mode (mode)}
					{@const open = mode === 'commenting' ? (controls.openComments ?? 0) : 0}
					<button
						type="button"
						class="icon-button"
						aria-pressed={controls.mode === mode}
						title={open ? `${modeNames[mode]}: ${open} open ${open === 1 ? 'comment' : 'comments'}` : modeNames[mode]}
						onclick={() => controls.setMode?.(mode)}
					>
						{#if mode === 'reading'}<BookOpenText size={22} aria-hidden="true" />{:else if mode === 'commenting'}<MessageSquare size={22} aria-hidden="true" />{:else}<Pencil size={22} aria-hidden="true" />{/if}
						<span class="visually-hidden">{modeNames[mode]}{open ? `, ${open} open` : ''}</span>
						{#if open}<span class="count comments-count" aria-hidden="true">{open}</span>{/if}
					</button>
				{/each}
			</span>
		{/if}
		{#each (controls.links ?? []).filter((link) => link.icon === 'edit') as link (link.href)}
			<a class="icon-button" href={link.href} title={link.title} aria-label={link.title}><Pencil size={22} aria-hidden="true" /></a>
		{/each}
		{#if controls.drafts}
			{@const drafts = controls.drafts}
			<button
				type="button"
				class="icon-button drafts"
				class:is-on={drafts.shown}
				aria-pressed={drafts.shown}
				title={drafts.shown ? 'Showing draft changes. Click to show only the published text.' : 'Showing the published text. Click to show draft changes.'}
				onclick={() => drafts.set(!drafts.shown)}
			>
				<Layers size={22} aria-hidden="true" />
				<span class="visually-hidden">Show draft changes</span>
			</button>
		{/if}
		{#if controls.history}
			<a class="icon-button" href={controls.history.href} title={controls.history.title} aria-label="History"><History size={22} aria-hidden="true" /></a>
		{/if}
		{#each (controls.links ?? []).filter((link) => link.icon === 'team') as link (link.href)}
			<a class="icon-button" href={link.href} title={link.title} aria-label={link.title}><Users size={22} aria-hidden="true" /></a>
		{/each}
		{#if controls.publish}
			{@const publish = controls.publish}
			{#if publish.action}
				<form method="post" action={publish.action}>
					{#each Object.entries(publish.fields ?? {}) as [name, value] (name)}<input type="hidden" {name} {value} />{/each}
					<button type="submit" class="icon-button publish" title={publish.title} aria-label={publish.title}>
						<Send size={22} aria-hidden="true" />
						{#if (publish.count ?? 0) > 1}<span class="count" aria-hidden="true">{publish.count}</span>{/if}
					</button>
				</form>
			{:else if publish.onclick}
				<button type="button" class="icon-button publish" title={publish.title} aria-label={publish.title} onclick={publish.onclick}>
					<Send size={22} aria-hidden="true" />
					{#if (publish.count ?? 0) > 0}<span class="count" aria-hidden="true">{publish.count}</span>{/if}
				</button>
			{:else if publish.href}
				<a class="icon-button publish" href={publish.href} title={publish.title} aria-label={publish.title}>
					<Send size={22} aria-hidden="true" />
					{#if (publish.count ?? 0) > 1}<span class="count" aria-hidden="true">{publish.count}</span>{/if}
				</a>
			{/if}
		{/if}
	</div>
{/if}

<style>
	/* After the site's name, set off by a thin rule. */
	.page-controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-band-text);
	}

	.is-row {
		margin-left: var(--space-3);
		padding-left: var(--space-3);
		border-left: 1px solid color-mix(in srgb, var(--color-band-text) 35%, transparent);
	}

	/* In the phone's More panel the page's controls come first, on a line of their own. */
	.is-panel {
		flex-basis: 100%;
		padding-bottom: var(--space-3);
		margin-bottom: var(--space-2);
		border-bottom: 1px solid color-mix(in srgb, var(--color-band-text) 35%, transparent);
	}

	.page-controls form {
		display: contents;
	}

	.modes {
		display: inline-flex;
		gap: 2px;
		padding: 2px;
		border: 1px solid color-mix(in srgb, var(--color-band-text) 45%, transparent);
		border-radius: calc(var(--radius-control) + 2px);
	}

	.modes .icon-button {
		min-width: 2.5rem;
		min-height: 2.5rem;
	}

	/* The mode the page is in, filled. */
	.modes .icon-button[aria-pressed='true'] {
		background: var(--color-band-text);
		color: var(--color-band);
	}

	/* Draft changes showing: a bar under the icon. */
	.drafts.is-on {
		box-shadow: inset 0 -3px 0 var(--color-band-text);
	}

	.publish {
		position: relative;
		background: var(--color-action);
		color: var(--color-action-text);
	}

	.publish:hover {
		background: color-mix(in srgb, var(--color-action) 85%, var(--color-band-text));
	}

	.count {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 1.25rem;
		padding: 0 0.3em;
		border-radius: 999px;
		background: var(--color-band-text);
		color: var(--color-band);
		font-size: 0.75rem;
		font-weight: var(--font-weight-semibold);
		line-height: 1.25rem;
		text-align: center;
	}

	/* The open comments on the page, in the action color so it shows on the pressed button too (design/page-comments). */
	.modes .icon-button {
		position: relative;
	}

	.comments-count {
		top: -2px;
		right: -2px;
		min-width: 1.05rem;
		background: var(--color-action);
		color: var(--color-action-text);
		font-size: 0.68rem;
		line-height: 1.05rem;
	}

	@media (forced-colors: active) {
		.modes .icon-button[aria-pressed='true'],
		.drafts.is-on {
			outline: 2px solid ButtonText;
		}
	}
</style>
