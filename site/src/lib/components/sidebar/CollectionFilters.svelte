<!--
	@component
	A browsed collection's find box and filters, in the side column under the
	collection's name (src/lib/collection-browser.ts; Trevor chose this for the
	executive orders on Nov. 27, 2026, design/federal-navigation/mockups/C2-*.png).
	The filters move only within the collection: the section bar's menus move
	between collections. Each value is a link to the page with that value
	chosen or no longer chosen, so the filters work without scripts and any
	view can be shared.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Search from '@lucide/svelte/icons/search';
	import type { FilterColumn } from '#lib/collection-browser.ts';

	let { filters, idSuffix }: { filters: FilterColumn; idSuffix: string } = $props();
</script>

<form class="find" method="get" action={filters.action} role="search">
	<label class="visually-hidden" for="collection-find-{idSuffix}">{filters.findLabel}</label>
	<Search size={16} aria-hidden="true" />
	<input id="collection-find-{idSuffix}" type="search" name="q" value={filters.find} placeholder={filters.findLabel} autocomplete="off" />
	{#each filters.kept as field (`${field.name}=${field.value}`)}<input type="hidden" name={field.name} value={field.value} />{/each}
</form>

{#each filters.facets as facet (facet.key)}
	{#if facet.options.length > 0}
		<p class="facet-label" id="facet-{facet.key}-{idSuffix}">{facet.label}</p>
		<ul class="options" aria-labelledby="facet-{facet.key}-{idSuffix}">
			{#each facet.options as option (option.value)}
				<li>
					<a class="option" class:chosen={option.chosen} href={option.href} data-sveltekit-noscroll data-sveltekit-keepfocus>
						<span class="box" aria-hidden="true">{#if option.chosen}<Check size={12} strokeWidth={3} />{/if}</span>
						<span class="name">{option.label}{#if option.chosen}<span class="visually-hidden">, chosen</span>{/if}</span>
						<span class="count"><span class="visually-hidden">, </span>{option.count.toLocaleString('en-US')}</span>
					</a>
				</li>
			{/each}
		</ul>
		{#if facet.more}<a class="more" href={facet.more.href} data-sveltekit-noscroll>{facet.more.label}</a>{/if}
		{#if facet.fewer}<a class="more" href={facet.fewer} data-sveltekit-noscroll>Fewer</a>{/if}
	{/if}
{/each}

<style>
	.find {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: var(--space-1) 0 var(--space-4);
		padding: 0 var(--space-3);
		border: 1px solid var(--color-control-border);
		border-radius: var(--radius-control);
		background: var(--color-surface-raised);
		color: var(--color-ink-muted);
	}

	.find:focus-within {
		outline: 3px solid var(--color-focus-ring);
		outline-offset: 2px;
	}

	.find input {
		flex: 1;
		min-width: 0;
		min-height: 2.5rem;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--color-ink);
		font: inherit;
		outline: none;
	}

	.facet-label {
		margin: var(--space-4) 0 var(--space-1);
		padding-left: var(--space-3);
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-weight: var(--font-weight-bold);
	}

	.options {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 2.25rem;
		padding: 0.15rem var(--space-2) 0.15rem var(--space-3);
		border-radius: var(--radius-control);
		color: var(--color-ink);
		text-decoration: none;
	}

	.option:hover {
		background: var(--color-surface);
	}

	.box {
		display: inline-grid;
		flex: none;
		place-items: center;
		width: 1.1rem;
		height: 1.1rem;
		border: 1.5px solid var(--color-control-border);
		border-radius: 3px;
		background: var(--color-surface-raised);
	}

	.chosen .box {
		border-color: var(--color-link);
		background: var(--color-link);
		color: var(--color-paper);
	}

	.name {
		flex: 1;
		min-width: 0;
	}

	.count {
		flex: none;
		color: var(--color-ink-muted);
		font-size: var(--font-size-small);
		font-variant-numeric: tabular-nums;
	}

	.more {
		display: inline-block;
		margin: var(--space-1) 0 0 calc(1.1rem + var(--space-2) + var(--space-3));
		color: var(--color-link);
		font-size: var(--font-size-small);
		text-decoration: none;
	}

	.more:hover {
		text-decoration: underline;
	}
</style>
