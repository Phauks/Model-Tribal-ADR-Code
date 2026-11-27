<script lang="ts">
	// Outreach's left column, laid out as the inbox's (inbox/+layout.svelte;
	// design/outreach-redesign, approved by Trevor on Nov. 27, 2026): New
	// batch, the views with their counts, the templates with a + to write
	// one, and the do-not-email list and settings under a rule. On a phone
	// the views are a row of chips above the page and New batch is a floating
	// button; the templates and tools fold away under them.
	import { onMount, type Component } from 'svelte';
	import CountBadge from '#lib/components/CountBadge.svelte';
	import { page } from '$app/state';
	import Ban from '@lucide/svelte/icons/ban';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import FilePen from '@lucide/svelte/icons/file-pen';
	import FileText from '@lucide/svelte/icons/file-text';
	import Layers from '@lucide/svelte/icons/layers';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Reply from '@lucide/svelte/icons/reply';
	import Send from '@lucide/svelte/icons/send';
	import Settings from '@lucide/svelte/icons/settings';
	import SquarePen from '@lucide/svelte/icons/square-pen';
	import { outreachBase as base, outreachViews, viewLink, type OutreachView } from './views.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const icons: Record<OutreachView, Component> = {
		all: Layers,
		sending: Send,
		scheduled: CalendarClock,
		drafts: FilePen,
		done: CircleCheck,
		replies: Reply,
		follow: BellRing
	};

	const onList = $derived(page.url.pathname === base);
	const currentView = $derived.by((): OutreachView | null => {
		if (onList) return (outreachViews.find((view) => view.key === page.url.searchParams.get('view'))?.key ?? 'all') as OutreachView;
		// A batch's own page belongs to the view it shows in.
		const stage = (page.data as { batch?: { stage?: string } }).batch?.stage;
		if (stage === 'sending' || stage === 'scheduled' || stage === 'done') return stage;
		if (stage === 'draft' || stage === 'paused') return stage === 'draft' ? 'drafts' : 'all';
		return null;
	});
	const countOf = (key: string | null): number => (key ? ((data.outreachCounts as Record<string, number>)[key] ?? 0) : 0);

	let open = $state(true);
	onMount(() => {
		// Folded on a phone, so the batches come first.
		if (window.matchMedia('(max-width: 49.99rem)').matches) open = false;
	});
</script>

<div class="mail">
	<nav class="view-chips" aria-label="Outreach views">
		<ul>
			{#each outreachViews as view (view.key)}
				{#if view.key !== 'follow' || countOf(view.count)}
					<li>
						<a href={viewLink(view.key)} aria-current={currentView === view.key ? 'page' : undefined}
							>{view.label}{#if countOf(view.count)}<span class="chip-count">{countOf(view.count)}</span>{/if}</a
						>
					</li>
				{/if}
			{/each}
		</ul>
	</nav>
	<details class="mail-nav" bind:open>
		<summary><ChevronDown size={18} aria-hidden="true" class="fold" />Templates and tools</summary>
		<nav aria-label="Outreach">
			<a class="button compose" href="{base}/new"><SquarePen size={18} aria-hidden="true" /> New batch</a>
			<ul class="nav-list views">
				{#each outreachViews as view (view.key)}
					{@const Icon = icons[view.key]}
					<li>
						<a href={viewLink(view.key)} aria-current={currentView === view.key ? 'page' : undefined}>
							<Icon size={18} aria-hidden="true" />
							<span class="name">{view.label}</span>
							{#if countOf(view.count)}<CountBadge count={countOf(view.count)} label={view.key === 'replies' ? 'unread' : view.key === 'follow' ? 'due' : 'batches'} />{/if}
						</a>
					</li>
				{/each}
			</ul>

			<div class="section-head">
				<h2>Templates</h2>
				<a class="icon-button small-icon" href="{base}/templates/new" aria-label="Write a template" title="Write a template"><Plus size={16} aria-hidden="true" /></a>
			</div>
			{#if data.outreachTemplates.length}
				<ul class="nav-list">
					{#each data.outreachTemplates as template (template.identifier)}
						<li>
							<a href="{base}/templates/{template.identifier}" aria-current={page.url.pathname === `${base}/templates/${template.identifier}` ? 'page' : undefined} title={template.name}>
								<FileText size={18} aria-hidden="true" />
								<span class="name">{template.name}</span>
								<span class="version">v{template.version}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="empty small muted">No templates yet.</p>
			{/if}

			<ul class="nav-list tools">
				<li>
					<a href="{base}/do-not-email" aria-current={page.url.pathname === `${base}/do-not-email` ? 'page' : undefined}>
						<Ban size={18} aria-hidden="true" /><span class="name">Do-not-email list</span>
						{#if data.outreachCounts.doNotEmail}<CountBadge count={data.outreachCounts.doNotEmail} label="addresses" />{/if}
					</a>
				</li>
				<li>
					<a href="{base}/settings" aria-current={page.url.pathname === `${base}/settings` ? 'page' : undefined}>
						<Settings size={18} aria-hidden="true" /><span class="name">Outreach settings</span>
					</a>
				</li>
			</ul>
		</nav>
	</details>

	<div class="mail-main">
		{@render children()}
	</div>
	{#if onList}
		<a class="button write" href="{base}/new"><Pencil size={18} aria-hidden="true" /> New batch</a>
	{/if}
</div>

<style>
	/* The same layout and sizes as the inbox's left column (inbox/+layout.svelte). */
	.mail {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-5);
		align-items: start;
	}
	.mail-nav > summary {
		font-weight: var(--font-weight-semibold);
		min-height: var(--layout-target-minimum);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		list-style: none;
	}
	.mail-nav > summary::-webkit-details-marker {
		display: none;
	}
	.mail-nav:not([open]) > summary :global(.fold) {
		transform: rotate(-90deg);
	}
	.view-chips ul {
		display: flex;
		gap: var(--space-2);
		margin: 0;
		padding: 0 0 var(--space-1);
		list-style: none;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.view-chips a {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		min-height: var(--layout-target-minimum);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: 999px;
		color: var(--color-ink);
		text-decoration: none;
		white-space: nowrap;
	}
	.view-chips a[aria-current='page'] {
		background: var(--color-band);
		border-color: var(--color-band);
		color: var(--color-band-text);
		font-weight: var(--font-weight-semibold);
	}
	.chip-count {
		margin-left: var(--space-1);
		font-variant-numeric: tabular-nums;
	}
	.write {
		position: fixed;
		right: var(--space-4);
		bottom: var(--space-4);
		z-index: 5;
		gap: var(--space-2);
		border-radius: 999px;
		padding-inline: var(--space-5);
		box-shadow: 0 var(--space-1) var(--space-3) color-mix(in srgb, var(--color-ink) 30%, transparent);
	}
	@media (max-width: 49.99rem) {
		.mail {
			gap: var(--space-3);
		}
		.compose,
		.nav-list.views {
			display: none;
		}
		.mail-main {
			padding-bottom: calc(var(--layout-target-minimum) + var(--space-5));
		}
	}
	@media (min-width: 50rem) {
		.mail {
			grid-template-columns: 15rem minmax(0, 1fr);
		}
		.view-chips,
		.write {
			display: none;
		}
		.mail-nav {
			grid-column: 1;
			grid-row: 1;
			position: sticky;
			top: var(--space-4);
		}
		.mail-main {
			grid-column: 2;
			grid-row: 1;
		}
		.mail-nav > summary {
			display: none;
		}
	}
	.compose {
		width: 100%;
		justify-content: center;
		gap: var(--space-2);
		margin-bottom: var(--space-4);
		border-radius: 999px;
		box-shadow: 0 1px 3px color-mix(in srgb, var(--color-ink) 20%, transparent);
	}
	.nav-list {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
	}
	.nav-list a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 2.5rem;
		padding: 0 var(--space-3) 0 var(--space-2);
		border-radius: 0 999px 999px 0;
		color: var(--color-ink);
		text-decoration: none;
	}
	.nav-list a:hover {
		background: var(--color-surface);
	}
	.nav-list a[aria-current='page'] {
		background: color-mix(in srgb, var(--color-link) 16%, transparent);
		font-weight: var(--font-weight-semibold);
		box-shadow: inset 3px 0 0 var(--color-link);
	}
	.nav-list :global(svg) {
		flex: none;
		color: var(--color-ink-muted);
	}
	.nav-list a[aria-current='page'] :global(svg) {
		color: var(--color-link);
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.version {
		font-size: var(--font-size-small);
		color: var(--color-ink-muted);
	}
	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: var(--space-4) 0 var(--space-1);
		padding-left: var(--space-2);
	}
	.section-head h2 {
		margin: 0;
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-semibold);
		color: var(--color-ink-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.empty {
		padding-left: var(--space-2);
		margin: 0 0 var(--space-3);
	}
	.tools {
		border-top: 1px solid var(--color-line);
		padding-top: var(--space-3);
		margin-top: var(--space-4);
	}
	.mail-main {
		min-width: 0;
	}
</style>
